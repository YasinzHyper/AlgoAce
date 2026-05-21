from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase_client import supabase
from google import genai
from config import GEMINI_API_KEY
import json
import pandas as pd
from datetime import datetime, timezone
from google.genai import types

router = APIRouter()
client = genai.Client(api_key=GEMINI_API_KEY)

# Minimum seconds between roadmap-level feedback regenerations. Prevents
# accidental Gemini spam from the UI; the client also enforces this but the
# server is authoritative. Override with `?force=true` for admin/debug use.
ROADMAP_FEEDBACK_COOLDOWN_SECONDS = 5 * 60

FEEDBACK_SYSTEM_INSTRUCTION = (
    "You are an expert DSA interview coach providing personalized, evidence-based "
    "feedback on a learner's progress. You ONLY respond with valid JSON (no markdown "
    "fences, no prose outside the JSON object). Be specific: reference the user's goal, "
    "deadline, named topics and problem titles where relevant. Keep each text field to "
    "2-4 concise sentences and keep `focus_areas` to at most 4 entries."
)

# Lightweight lookup for a problem's primary topic so we can satisfy the
# NOT NULL `topic_name` column on `problem_completions` without changing the
# request contract of the complete endpoint.
try:
    _pc_problems_df = pd.read_csv(
        "dataset/leetcode-problems.csv", usecols=["id", "title", "difficulty", "related_topics"]
    ).set_index("id")
except Exception as e:
    print(f"[progress] Error loading dataset for topic lookup: {str(e)}")
    _pc_problems_df = pd.DataFrame()


def _primary_topic_for(problem_id: int) -> str:
    try:
        if not _pc_problems_df.empty and problem_id in _pc_problems_df.index:
            raw = _pc_problems_df.loc[problem_id, "related_topics"]
            if pd.notna(raw) and str(raw).strip():
                return str(raw).split(",")[0].strip()
    except Exception:
        pass
    return "General"


def _problem_meta(problem_id: int) -> dict:
    """Lightweight {title, difficulty, topics[]} lookup for feedback prompts."""
    try:
        if not _pc_problems_df.empty and problem_id in _pc_problems_df.index:
            row = _pc_problems_df.loc[problem_id]
            topics_raw = row.get("related_topics")
            topics = (
                [t.strip() for t in str(topics_raw).split(",") if t.strip()]
                if pd.notna(topics_raw)
                else []
            )
            return {
                "id": problem_id,
                "title": str(row.get("title") or f"Problem #{problem_id}"),
                "difficulty": str(row.get("difficulty") or "Unknown"),
                "topics": topics,
            }
    except Exception:
        pass
    return {"id": problem_id, "title": f"Problem #{problem_id}", "difficulty": "Unknown", "topics": []}


def _record_completion_event(
    *, user_id: str, roadmap_id: int, task_id: int, item_type: str, item_id: str, completed: bool
) -> None:
    """
    Mirror a progress toggle into the append-only problem_completions /
    topic_completions tables and refresh the cached streak. Failures here are
    logged but never block the primary progress update.
    """
    try:
        if item_type == "problem":
            table = "problem_completions"
            problem_id = int(item_id)
            match = (
                supabase.table(table)
                .select("id")
                .eq("user_id", user_id)
                .eq("task_id", task_id)
                .eq("problem_id", problem_id)
            )
            if completed:
                existing = match.execute()
                if not existing.data:
                    supabase.table(table).insert({
                        "user_id": user_id,
                        "roadmap_id": roadmap_id,
                        "task_id": task_id,
                        "problem_id": problem_id,
                        "topic_name": _primary_topic_for(problem_id),
                    }).execute()
            else:
                (
                    supabase.table(table)
                    .delete()
                    .eq("user_id", user_id)
                    .eq("task_id", task_id)
                    .eq("problem_id", problem_id)
                    .execute()
                )
        elif item_type in ("topic", "os_item", "dbms_item"):
            table = "topic_completions"
            topic_name = item_id
            if item_type == "os_item":
                try:
                    from dataset.os_loader import get_os_item_by_id

                    meta = get_os_item_by_id(int(item_id))
                    if meta:
                        topic_name = meta.get("topic", item_id)
                except Exception:
                    topic_name = item_id
            elif item_type == "dbms_item":
                try:
                    from dataset.dbms_loader import get_dbms_item_by_id

                    meta = get_dbms_item_by_id(int(item_id))
                    if meta:
                        topic_name = meta.get("topic", item_id)
                except Exception:
                    topic_name = item_id
            match = (
                supabase.table(table)
                .select("id")
                .eq("user_id", user_id)
                .eq("task_id", task_id)
                .eq("topic_name", topic_name)
            )
            if completed:
                existing = match.execute()
                if not existing.data:
                    supabase.table(table).insert({
                        "user_id": user_id,
                        "roadmap_id": roadmap_id,
                        "task_id": task_id,
                        "topic_name": topic_name,
                    }).execute()
            else:
                (
                    supabase.table(table)
                    .delete()
                    .eq("user_id", user_id)
                    .eq("task_id", task_id)
                    .eq("topic_name", topic_name)
                    .execute()
                )

        # Recompute cached streak via the DB helper function.
        supabase.rpc("refresh_user_streak", {"p_user_id": user_id}).execute()
    except Exception as e:
        print(f"[progress] completion event sync failed (non-fatal): {str(e)}")

def extract_json_str(feedback:str) -> json:
        try:
        # Extract JSON from potential code block
            if '```json' in feedback:
                start = feedback.find('```json') + len('```json')
                end = feedback.find('```', start)
                if end == -1:
                    end = len(feedback)
                json_str = feedback[start:end].strip()
            else:
                json_str = feedback.strip()
            # Debug output
            print(f"Gemini response feedback (cleaned): {json_str}")
            # Parse and return the JSON object directly
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            error_message = {"error": f"Invalid JSON: {str(e)}"}
            print(error_message)
            return error_message
        except Exception as e:
            error_message = {"error": f"Failed to process feedback: {str(e)}"}
            print(error_message)
            return error_message

async def get_current_user(authorization: str = Header(...)):
    """
    Extract and validate Supabase token from Authorization header.
    """
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        token = authorization[len("Bearer "):]
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

class CompleteItem(BaseModel):
    type: str  # "problem", "topic", "os_item", or "dbms_item"
    id: str
    completed: bool

@router.get("/task/{task_id}")
async def get_progress_by_task(task_id: int, user=Depends(get_current_user)):
    """
    Retrieve progress for a specific task.
    """
    try:
        task_response = supabase.table("tasks").select("roadmap_id").eq("id", task_id).execute()
        if not task_response.data:
            raise HTTPException(status_code=404, detail="Task not found")
        roadmap_id = task_response.data[0]["roadmap_id"]
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=403, detail="Not authorized to access this task")

        progress_response = supabase.table("progress").select("*").eq("task_id", task_id).eq("user_id", user.user.id).execute()
        if not progress_response.data:
            raise HTTPException(status_code=404, detail="Progress not found for this task")
        return progress_response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching progress: {str(e)}")

@router.get("/roadmap/{roadmap_id}")
async def get_progress_by_roadmap(roadmap_id: int, user=Depends(get_current_user)):
    """
    Retrieve all progress entries for a roadmap.
    """
    try:
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")

        progress_response = supabase.table("progress").select("*").eq("roadmap_id", roadmap_id).eq("user_id", user.user.id).execute()
        return {"progress_entries": progress_response.data if progress_response.data else []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching progress: {str(e)}")

@router.put("/task/{task_id}/complete")
async def complete_item(task_id: int, item: CompleteItem, user=Depends(get_current_user)):
    """
    Update completion status of a problem or topic in a task's progress.
    """
    try:
        task_response = supabase.table("tasks").select("roadmap_id").eq("id", task_id).execute()
        if not task_response.data:
            raise HTTPException(status_code=404, detail="Task not found")
        roadmap_id = task_response.data[0]["roadmap_id"]
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=403, detail="Not authorized to access this task")

        progress_response = supabase.table("progress").select("*").eq("task_id", task_id).eq("user_id", user.user.id).execute()
        if not progress_response.data:
            raise HTTPException(status_code=404, detail="Progress not found for this task")
        progress = progress_response.data[0]

        completed = progress["completed"]
        if "os_items" not in completed:
            completed["os_items"] = {}
        if "dbms_items" not in completed:
            completed["dbms_items"] = {}

        if item.type == "problem":
            if str(item.id) in completed.get("problems", {}):
                completed["problems"][str(item.id)] = item.completed
            else:
                raise HTTPException(status_code=400, detail="Problem ID not found in task")
        elif item.type == "topic":
            if item.id in completed.get("topics", {}):
                completed["topics"][item.id] = item.completed
            else:
                raise HTTPException(status_code=400, detail="Topic not found in task")
        elif item.type == "os_item":
            if str(item.id) in completed["os_items"]:
                completed["os_items"][str(item.id)] = item.completed
            else:
                raise HTTPException(status_code=400, detail="OS item ID not found in task")
        elif item.type == "dbms_item":
            if str(item.id) in completed["dbms_items"]:
                completed["dbms_items"][str(item.id)] = item.completed
            else:
                raise HTTPException(status_code=400, detail="DBMS item ID not found in task")
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid type. Must be 'problem', 'topic', 'os_item', or 'dbms_item'",
            )

        completed_problem_count = sum(1 for v in completed["problems"].values() if v)
        total_problem_count = progress["total_problem_count"]
        completion_percentage = int((completed_problem_count / total_problem_count * 100) if total_problem_count > 0 else 0)

        update_data = {
            "completed": completed,
            "completed_problem_count": completed_problem_count,
            "completion_percentage": completion_percentage
        }
        update_response = supabase.table("progress").update(update_data).eq("id", progress["id"]).execute()
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update progress")

        # Mirror into analytics tables + refresh streak (non-blocking on failure).
        _record_completion_event(
            user_id=user.user.id,
            roadmap_id=roadmap_id,
            task_id=task_id,
            item_type=item.type,
            item_id=str(item.id),
            completed=item.completed,
        )

        return {"message": "Progress updated successfully", "progress": update_response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating progress: {str(e)}")

def _build_task_feedback_prompt(*, roadmap: dict, task: dict, progress: dict) -> str:
    user_input = roadmap.get("user_input") or {}
    week = task.get("week")
    total_weeks = user_input.get("weeks") or "?"
    completed_map = (progress.get("completed") or {})
    problems = completed_map.get("problems", {}) or {}
    topics = completed_map.get("topics", {}) or {}

    solved, unsolved = [], []
    for pid_str, done in problems.items():
        try:
            meta = _problem_meta(int(pid_str))
        except Exception:
            meta = {"title": f"Problem #{pid_str}", "difficulty": "Unknown", "topics": []}
        label = f"{meta['title']} ({meta['difficulty']}; {', '.join(meta['topics'][:2]) or 'General'})"
        (solved if done else unsolved).append(label)

    return f"""
The learner is preparing for: "{user_input.get('goal', 'a technical interview')}".
Target company: {roadmap.get('company') or 'not specified'}.
Plan length: {total_weeks} weeks. Deadline: {user_input.get('deadline') or 'not specified'}.
This is feedback for WEEK {week} of {total_weeks}.

Week {week} problem completion: {progress.get('completed_problem_count', 0)}/{progress.get('total_problem_count', 0)} ({progress.get('completion_percentage', 0)}%).
Solved problems this week:
{json.dumps(solved, indent=2) if solved else '  (none yet)'}
Still pending this week:
{json.dumps(unsolved, indent=2) if unsolved else '  (all done!)'}
Additional study topics for this week ({sum(1 for v in topics.values() if v)}/{len(topics)} done): {list(topics.keys()) or 'none'}.

Respond with ONLY a JSON object of the form:
{{
  "positive": "...",
  "negative": "...",
  "focus_areas": ["topic or problem to prioritise", ...]
}}
Reference specific problem titles or topics from the lists above. If everything is solved, the
`negative` field should suggest stretch goals for the next week instead of criticism.
""".strip()


@router.post("/task/{task_id}/feedback")
async def generate_feedback(task_id: int, user=Depends(get_current_user)):
    """
    Generate AI-driven feedback for a single week (task) using the user's goal,
    timeline and the actual problem set assigned for that week. Persists
    `positive_feedback` / `negative_feedback` on the progress row (existing
    contract) and additionally returns `focus_areas`.
    """
    try:
        progress_response = (
            supabase.table("progress").select("*").eq("task_id", task_id).eq("user_id", user.user.id).execute()
        )
        if not progress_response.data:
            raise HTTPException(status_code=404, detail="Progress not found for this task")
        progress = progress_response.data[0]

        task_response = supabase.table("tasks").select("*").eq("id", task_id).execute()
        if not task_response.data:
            raise HTTPException(status_code=404, detail="Task not found")
        task = task_response.data[0]

        roadmap_response = (
            supabase.table("roadmaps")
            .select("*")
            .eq("id", task["roadmap_id"])
            .eq("user_id", user.user.id)
            .execute()
        )
        if not roadmap_response.data:
            raise HTTPException(status_code=403, detail="Not authorized to access this task")
        roadmap = roadmap_response.data[0]

        prompt = _build_task_feedback_prompt(roadmap=roadmap, task=task, progress=progress)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=FEEDBACK_SYSTEM_INSTRUCTION,
                temperature=0.6,
                response_mime_type="application/json",
            ),
        )
        feedback_text = response.text.strip()

        feedback = extract_json_str(feedback_text)
        if not isinstance(feedback, dict) or "error" in feedback:
            print(f"[feedback] unparsable model output, falling back: {feedback_text}")
            feedback = {}
        positive = str(feedback.get("positive") or "Good effort on your tasks this week!")
        negative = str(feedback.get("negative") or "Try to complete more of the pending problems before moving on.")
        focus_areas = feedback.get("focus_areas") or []
        if not isinstance(focus_areas, list):
            focus_areas = [str(focus_areas)]
        focus_areas = [str(f) for f in focus_areas][:4]

        update_data = {"positive_feedback": positive, "negative_feedback": negative}
        update_response = supabase.table("progress").update(update_data).eq("id", progress["id"]).execute()
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update feedback")

        return {
            "message": "Feedback generated successfully",
            "progress": update_response.data[0],
            "focus_areas": focus_areas,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating feedback: {str(e)}")


@router.get("/roadmap/{roadmap_id}/feedback")
async def get_roadmap_feedback(roadmap_id: int, user=Depends(get_current_user)):
    """
    Return the most recently generated roadmap-level feedback without regenerating.
    Returns `{"feedback": null}` if none exists yet (or the table hasn't been
    migrated on this deployment).
    """
    try:
        roadmap_response = (
            supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        )
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")

        try:
            fb_resp = (
                supabase.table("roadmap_feedback")
                .select("*")
                .eq("roadmap_id", roadmap_id)
                .eq("user_id", user.user.id)
                .order("generated_at", desc=True)
                .limit(1)
                .execute()
            )
            return {"feedback": fb_resp.data[0] if fb_resp.data else None}
        except Exception as e:
            print(f"[feedback] roadmap_feedback lookup skipped: {str(e)}")
            return {"feedback": None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching feedback: {str(e)}")


@router.post("/roadmap/{roadmap_id}/feedback")
async def generate_roadmap_feedback(
    roadmap_id: int, force: bool = False, user=Depends(get_current_user)
):
    """
    Generate roadmap-level AI coaching feedback. Aggregates every task's progress,
    derives pace vs the user's timeline and strong/weak topics, then asks the
    model for a structured review. The result is persisted to `roadmap_feedback`
    so it can be re-read cheaply; if that table doesn't exist yet the endpoint
    still returns the generated feedback (persistence failure is non-fatal).

    Rate-limited to one regeneration per `ROADMAP_FEEDBACK_COOLDOWN_SECONDS`;
    pass `?force=true` to bypass (intended for debugging only).
    """
    try:
        from routers.analytics_router import _compute_roadmap_progress

        user_id = user.user.id
        now = datetime.now(timezone.utc)

        roadmap_response = (
            supabase.table("roadmaps").select("*").eq("id", roadmap_id).eq("user_id", user_id).execute()
        )
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")
        roadmap = roadmap_response.data[0]

        # ---- Cooldown guard ---------------------------------------------------
        if not force:
            try:
                last_resp = (
                    supabase.table("roadmap_feedback")
                    .select("generated_at")
                    .eq("roadmap_id", roadmap_id)
                    .eq("user_id", user_id)
                    .order("generated_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if last_resp.data:
                    last_at = datetime.fromisoformat(
                        str(last_resp.data[0]["generated_at"]).replace("Z", "+00:00")
                    )
                    elapsed = (now - last_at).total_seconds()
                    if elapsed < ROADMAP_FEEDBACK_COOLDOWN_SECONDS:
                        retry_after = int(ROADMAP_FEEDBACK_COOLDOWN_SECONDS - elapsed)
                        raise HTTPException(
                            status_code=429,
                            detail={
                                "message": "Feedback was generated recently; please wait before regenerating.",
                                "retry_after_seconds": retry_after,
                            },
                        )
            except HTTPException:
                raise
            except Exception as e:
                # Table may not exist on older deployments; skip the guard.
                print(f"[feedback] cooldown check skipped: {str(e)}")

        tasks_resp = supabase.table("tasks").select("*").eq("roadmap_id", roadmap_id).execute()
        progress_resp = (
            supabase.table("progress").select("*").eq("roadmap_id", roadmap_id).eq("user_id", user_id).execute()
        )
        snapshot = _compute_roadmap_progress(
            roadmap, tasks_resp.data or [], progress_resp.data or [], now
        )

        # Fold the latest mock-interview result into the coaching prompt so the
        # AI Coach references it (Plan §7). Degrades silently if the table is
        # missing on this deployment.
        interview_line = ""
        try:
            iv_resp = (
                supabase.table("interview_sessions")
                .select("interview_type,overall_score,feedback,completed_at")
                .eq("user_id", user_id)
                .eq("status", "completed")
                .order("completed_at", desc=True)
                .limit(1)
                .execute()
            )
            if iv_resp.data:
                iv = iv_resp.data[0]
                fb = iv.get("feedback") or {}
                imps = [str(i) for i in (fb.get("improvements") or [])][:3]
                interview_line = (
                    f"\nLatest mock interview ({iv.get('interview_type')}): scored "
                    f"{iv.get('overall_score')}/100. Key improvements flagged: "
                    f"{'; '.join(imps) or 'none'}."
                )
        except Exception as e:
            print(f"[feedback] interview context skipped: {str(e)}")

        weeks_summary = [
            f"Week {w['week']}: {w['completed']}/{w['total']} problems ({w['percentage']}%)"
            for w in snapshot["weeks"]
        ]
        strong = [f"{t['name']} ({t['percentage']}%)" for t in snapshot["strong_topics"]]
        weak = [
            f"{t['name']} ({t['completed']}/{t['total']}, {t['percentage']}%)"
            for t in snapshot["weak_topics"]
        ]
        diff = [
            f"{d['name']}: {d['completed']}/{d['total']}"
            for d in snapshot["difficulty_breakdown"]
            if d["total"] > 0
        ]
        pace = snapshot["pace"]

        prompt = f"""
The learner's goal: "{snapshot.get('goal') or 'technical interview prep'}".
Target company: {snapshot.get('company') or 'not specified'}.
Plan: {snapshot['total_weeks']} weeks (started {snapshot.get('created_at')}). Deadline: {snapshot.get('deadline') or 'not specified'}.

Overall progress: {snapshot['overall']['completed']}/{snapshot['overall']['total']} problems ({snapshot['overall']['percentage']}%).
Pace: currently in week {pace['elapsed_weeks']} of {snapshot['total_weeks']}; expected ~{pace['expected_percentage']}% by now -> learner is {pace['status'].replace('_', ' ')} ({pace['delta']:+d}%).
{f"Days until deadline: {pace['days_remaining']}." if pace.get('days_remaining') is not None else ''}

Per-week breakdown:
{json.dumps(weeks_summary, indent=2)}

Difficulty coverage: {', '.join(diff) or 'no problems assigned'}.
Strongest topics so far: {', '.join(strong) or 'none yet'}.
Topics needing attention: {', '.join(weak) or 'none identified yet'}.{interview_line}

Respond with ONLY a JSON object:
{{
  "summary": "1-2 sentence headline on how the learner is tracking toward their goal",
  "positive": "what's going well, citing specific topics/weeks",
  "negative": "what's at risk and why, citing specific topics/weeks",
  "focus_areas": [
    {{"topic": "<topic or week>", "reason": "<why>", "action": "<one concrete next step>"}}
  ]
}}
Ground every claim in the data above. If overall progress is 0%, focus on a gentle kick-off plan.
""".strip()

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=FEEDBACK_SYSTEM_INSTRUCTION,
                temperature=0.6,
                response_mime_type="application/json",
            ),
        )
        feedback_text = response.text.strip()
        parsed = extract_json_str(feedback_text)
        if not isinstance(parsed, dict) or "error" in parsed:
            print(f"[feedback] unparsable roadmap model output: {feedback_text}")
            parsed = {}

        summary = str(parsed.get("summary") or "Progress snapshot generated.")
        positive = str(parsed.get("positive") or "Keep up the consistent effort.")
        negative = str(parsed.get("negative") or "Revisit the weeks that are falling behind schedule.")
        raw_focus = parsed.get("focus_areas") or []
        focus_areas: list[dict] = []
        if isinstance(raw_focus, list):
            for item in raw_focus[:4]:
                if isinstance(item, dict):
                    focus_areas.append({
                        "topic": str(item.get("topic") or item.get("area") or "General"),
                        "reason": str(item.get("reason") or ""),
                        "action": str(item.get("action") or ""),
                    })
                else:
                    focus_areas.append({"topic": str(item), "reason": "", "action": ""})

        record = {
            "user_id": user_id,
            "roadmap_id": roadmap_id,
            "summary": summary,
            "positive_feedback": positive,
            "negative_feedback": negative,
            "focus_areas": focus_areas,
            "completion_percentage": snapshot["overall"]["percentage"],
            "pace_status": pace["status"],
            "generated_at": now.isoformat(),
        }

        persisted = record
        try:
            insert_resp = supabase.table("roadmap_feedback").insert(record).execute()
            if insert_resp.data:
                persisted = insert_resp.data[0]
        except Exception as e:
            # Table may not exist yet on older DBs; surface the feedback anyway.
            print(f"[feedback] roadmap_feedback persist skipped: {str(e)}")

        return {
            "message": "Feedback generated successfully",
            "feedback": persisted,
            "snapshot": {
                "overall": snapshot["overall"],
                "pace": snapshot["pace"],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating roadmap feedback: {str(e)}")
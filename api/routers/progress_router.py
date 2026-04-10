from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase_client import supabase
from google import genai
from config import GEMINI_API_KEY
import json
import pandas as pd
from google.genai import types

router = APIRouter()
client = genai.Client(api_key=GEMINI_API_KEY)

# Lightweight lookup for a problem's primary topic so we can satisfy the
# NOT NULL `topic_name` column on `problem_completions` without changing the
# request contract of the complete endpoint.
try:
    _pc_problems_df = pd.read_csv("dataset/leetcode-problems.csv", usecols=["id", "related_topics"]).set_index("id")
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
        elif item_type == "topic":
            table = "topic_completions"
            match = (
                supabase.table(table)
                .select("id")
                .eq("user_id", user_id)
                .eq("task_id", task_id)
                .eq("topic_name", item_id)
            )
            if completed:
                existing = match.execute()
                if not existing.data:
                    supabase.table(table).insert({
                        "user_id": user_id,
                        "roadmap_id": roadmap_id,
                        "task_id": task_id,
                        "topic_name": item_id,
                    }).execute()
            else:
                (
                    supabase.table(table)
                    .delete()
                    .eq("user_id", user_id)
                    .eq("task_id", task_id)
                    .eq("topic_name", item_id)
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
    type: str  # "problem" or "topic"
    id: str    # problem_id (as string) or topic name
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
        if item.type == "problem":
            if str(item.id) in completed["problems"]:
                completed["problems"][str(item.id)] = item.completed
            else:
                raise HTTPException(status_code=400, detail="Problem ID not found in task")
        elif item.type == "topic":
            if item.id in completed["topics"]:
                completed["topics"][item.id] = item.completed
            else:
                raise HTTPException(status_code=400, detail="Topic not found in task")
        else:
            raise HTTPException(status_code=400, detail="Invalid type. Must be 'problem' or 'topic'")

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

@router.post("/task/{task_id}/feedback")
async def generate_feedback(task_id: int, user=Depends(get_current_user)):
    """
    Generate AI-driven positive and negative feedback based on task progress using Gemini API.
    """
    try:
        # Fetch progress and task data
        progress_response = supabase.table("progress").select("*").eq("task_id", task_id).eq("user_id", user.user.id).execute()
        if not progress_response.data:
            raise HTTPException(status_code=404, detail="Progress not found for this task")
        progress = progress_response.data[0]

        task_response = supabase.table("tasks").select("week").eq("id", task_id).execute()
        if not task_response.data:
            raise HTTPException(status_code=404, detail="Task not found")
        week = task_response.data[0]["week"]

        # Extract progress details
        completed = progress["completed"]
        problems = completed.get("problems", {})
        topics = completed.get("topics", {})
        total_problems = len(problems)
        completed_problems = sum(1 for v in problems.values() if v)
        total_topics = len(topics)
        completed_topics = sum(1 for v in topics.values() if v)
        completion_percentage = progress["completion_percentage"]

        # Construct detailed prompt for Gemini API
        prompt = f"""
        Analyze the user's progress for week {week} of their roadmap:
        - Total problems assigned: {total_problems}
        - Problems completed: {completed_problems}
        - Total topics assigned: {total_topics}
        - Topics completed: {completed_topics}
        - Completion percentage for problems: {completion_percentage}%

        Provide detailed feedback in JSON format with keys 'positive' and 'negative':
        - 'positive': Highlight specific achievements (e.g., problem completion rate, topic coverage) and encourage continued effort.
        - 'negative': Identify areas for improvement (e.g., incomplete problems/topics, pace) and suggest actionable steps.
        Ensure the feedback is constructive, specific, and tailored to the user's progress.
        """

        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction="You are an expert tutor providing personalized feedback on learning progress.",
                temperature=0.7,
            )
        )
        feedback_text = response.text.strip()

        # Parse feedback JSON
        try:
            feedback = extract_json_str(feedback_text)
            positive = feedback.get("positive", "Great work on your progress this week!")
            negative = feedback.get("negative", "Consider spending more time on unfinished tasks.")
        except json.JSONDecodeError:
            positive = "Good effort on your tasks this week!"
            negative = "Try to complete more problems and topics next time."
            print(f"Warning: Failed to parse Gemini response: {feedback_text}")

        # Update progress with feedback
        update_data = {
            "positive_feedback": positive,
            "negative_feedback": negative
        }
        update_response = supabase.table("progress").update(update_data).eq("id", progress["id"]).execute()
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update feedback")

        return {"message": "Feedback generated successfully", "progress": update_response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating feedback: {str(e)}")
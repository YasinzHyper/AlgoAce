from fastapi import APIRouter, Depends, HTTPException, Header
from supabase_client import supabase
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import pandas as pd

router = APIRouter()

# Load the LeetCode dataset once at startup for joining problem metadata
# (title, difficulty, related_topics) onto completion rows.
try:
    _problems_df = pd.read_csv("dataset/leetcode-problems.csv")
    _problems_df = _problems_df.set_index("id", drop=False)
except Exception as e:
    print(f"[analytics] Error loading dataset: {str(e)}")
    _problems_df = pd.DataFrame()


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


def _lookup_problem(problem_id: int) -> dict:
    """Return {title, difficulty, related_topics[]} for a problem id, with safe defaults."""
    if _problems_df.empty or problem_id not in _problems_df.index:
        return {"title": f"Problem #{problem_id}", "difficulty": "Unknown", "related_topics": []}
    row = _problems_df.loc[problem_id]
    topics_raw = row.get("related_topics")
    if pd.isna(topics_raw) or not topics_raw:
        topics = []
    else:
        topics = [t.strip() for t in str(topics_raw).split(",") if t.strip()]
    difficulty = row.get("difficulty")
    return {
        "title": str(row.get("title") or f"Problem #{problem_id}"),
        "difficulty": str(difficulty) if pd.notna(difficulty) else "Unknown",
        "related_topics": topics,
    }


def _start_of_week(d: datetime) -> datetime:
    """Monday 00:00 UTC for the week containing d."""
    d = d.astimezone(timezone.utc)
    monday = d - timedelta(days=d.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/summary")
async def get_analytics_summary(user=Depends(get_current_user)):
    """
    Aggregate a user's analytics from problem_completions, topic_completions and
    user_streaks, enriched with the LeetCode dataset for difficulty / topic tags.

    Returned shape is consumed by both the Analytics dashboard and the Profile page.
    """
    try:
        user_id = user.user.id
        now = datetime.now(timezone.utc)

        # ---- Raw rows ---------------------------------------------------------------
        pc_resp = (
            supabase.table("problem_completions")
            .select("problem_id, completed_at, topic_name")
            .eq("user_id", user_id)
            .order("completed_at", desc=True)
            .execute()
        )
        completions = pc_resp.data or []

        tc_resp = (
            supabase.table("topic_completions")
            .select("topic_name, completed_at")
            .eq("user_id", user_id)
            .order("completed_at", desc=True)
            .execute()
        )
        topic_completions = tc_resp.data or []

        streak_resp = (
            supabase.table("user_streaks")
            .select("current_streak, longest_streak, last_activity_date")
            .eq("user_id", user_id)
            .execute()
        )
        streak_row = streak_resp.data[0] if streak_resp.data else {
            "current_streak": 0,
            "longest_streak": 0,
            "last_activity_date": None,
        }

        # ---- Enrich problem completions with dataset metadata -----------------------
        enriched = []
        for c in completions:
            meta = _lookup_problem(int(c["problem_id"]))
            try:
                completed_at = datetime.fromisoformat(str(c["completed_at"]).replace("Z", "+00:00"))
            except Exception:
                completed_at = now
            enriched.append({
                "problem_id": int(c["problem_id"]),
                "completed_at": completed_at,
                "completed_at_iso": completed_at.isoformat(),
                "title": meta["title"],
                "difficulty": meta["difficulty"],
                "related_topics": meta["related_topics"],
                "topic_name": c.get("topic_name") or (meta["related_topics"][0] if meta["related_topics"] else "General"),
            })

        # Distinct problems solved (a problem may be completed in multiple roadmaps/tasks)
        distinct_ids = {e["problem_id"] for e in enriched}
        total_solved = len(distinct_ids)

        seven_days_ago = now - timedelta(days=7)
        solved_this_week_ids = {e["problem_id"] for e in enriched if e["completed_at"] >= seven_days_ago}
        solved_this_week = len(solved_this_week_ids)

        # ---- Difficulty distribution (distinct problems) ----------------------------
        difficulty_counts: dict[str, int] = defaultdict(int)
        seen_for_difficulty: set[int] = set()
        for e in enriched:
            if e["problem_id"] in seen_for_difficulty:
                continue
            seen_for_difficulty.add(e["problem_id"])
            difficulty_counts[e["difficulty"]] += 1
        difficulty_distribution = [
            {"name": "Easy", "value": difficulty_counts.get("Easy", 0)},
            {"name": "Medium", "value": difficulty_counts.get("Medium", 0)},
            {"name": "Hard", "value": difficulty_counts.get("Hard", 0)},
        ]

        # ---- Topic mastery (distinct problems, exploded by related_topics) ----------
        topic_counts: dict[str, int] = defaultdict(int)
        seen_for_topics: set[int] = set()
        for e in enriched:
            if e["problem_id"] in seen_for_topics:
                continue
            seen_for_topics.add(e["problem_id"])
            tags = e["related_topics"] or ([e["topic_name"]] if e["topic_name"] else [])
            for t in tags:
                topic_counts[t] += 1
        topic_mastery = sorted(
            [{"name": k, "value": v} for k, v in topic_counts.items()],
            key=lambda x: x["value"],
            reverse=True,
        )

        # ---- Weekly progress (last 12 calendar weeks, cumulative distinct solved) ---
        weeks_window = 12
        this_week_start = _start_of_week(now)
        week_starts = [this_week_start - timedelta(weeks=(weeks_window - 1 - i)) for i in range(weeks_window)]

        first_solve_at: dict[int, datetime] = {}
        for e in enriched:
            pid = e["problem_id"]
            if pid not in first_solve_at or e["completed_at"] < first_solve_at[pid]:
                first_solve_at[pid] = e["completed_at"]

        weekly_progress = []
        for ws in week_starts:
            we = ws + timedelta(weeks=1)
            solved_in_week = sum(1 for ts in first_solve_at.values() if ws <= ts < we)
            cumulative = sum(1 for ts in first_solve_at.values() if ts < we)
            weekly_progress.append({
                "week_start": ws.date().isoformat(),
                "label": ws.strftime("%b %d"),
                "problems": solved_in_week,
                "cumulative": cumulative,
            })

        # ---- Daily activity (last 365 days, for contribution calendar) --------------
        daily_counts: dict[str, int] = defaultdict(int)
        for e in enriched:
            daily_counts[e["completed_at"].date().isoformat()] += 1
        for tc in topic_completions:
            try:
                d = datetime.fromisoformat(str(tc["completed_at"]).replace("Z", "+00:00")).date().isoformat()
                daily_counts[d] += 1
            except Exception:
                pass

        start_date = (now - timedelta(days=364)).date()
        daily_activity = []
        for i in range(365):
            d = (start_date + timedelta(days=i)).isoformat()
            count = daily_counts.get(d, 0)
            level = 0 if count == 0 else 1 if count == 1 else 2 if count == 2 else 3 if count <= 4 else 4
            daily_activity.append({"date": d, "count": count, "level": level})

        # ---- Recent activity (problems + topics, newest first, limit 10) -----------
        recent: list[dict] = []
        for e in enriched:
            recent.append({
                "type": "problem",
                "problem_id": e["problem_id"],
                "title": e["title"],
                "topic": e["topic_name"],
                "difficulty": e["difficulty"],
                "completed_at": e["completed_at_iso"],
            })
        for tc in topic_completions:
            recent.append({
                "type": "topic",
                "problem_id": None,
                "title": tc["topic_name"],
                "topic": tc["topic_name"],
                "difficulty": None,
                "completed_at": str(tc["completed_at"]),
            })
        recent.sort(key=lambda r: r["completed_at"], reverse=True)
        recent = recent[:10]

        return {
            "totals": {
                "problems_solved": total_solved,
                "solved_this_week": solved_this_week,
                "topics_completed": len(topic_completions),
                "current_streak": streak_row.get("current_streak", 0) or 0,
                "longest_streak": streak_row.get("longest_streak", 0) or 0,
                "last_activity_date": streak_row.get("last_activity_date"),
            },
            "difficulty_distribution": difficulty_distribution,
            "topic_mastery": topic_mastery,
            "weekly_progress": weekly_progress,
            "daily_activity": daily_activity,
            "recent_activity": recent,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building analytics: {str(e)}")


def _compute_roadmap_progress(roadmap: dict, tasks: list[dict], progress_entries: list[dict], now: datetime) -> dict:
    """
    Shared helper that derives per-week + overall completion, pace status and
    topic strength for a single roadmap. Kept separate so the feedback endpoint
    in progress_router can reuse the exact same numbers the UI renders.
    """
    progress_by_task = {p["task_id"]: p for p in progress_entries if p.get("task_id")}
    tasks_sorted = sorted(tasks, key=lambda t: t.get("week") or 0)

    weeks: list[dict] = []
    overall_completed = 0
    overall_total = 0
    topic_totals: dict[str, dict] = defaultdict(lambda: {"completed": 0, "total": 0})
    diff_counts: dict[str, dict] = {
        "Easy": {"completed": 0, "total": 0},
        "Medium": {"completed": 0, "total": 0},
        "Hard": {"completed": 0, "total": 0},
    }

    for t in tasks_sorted:
        prog = progress_by_task.get(t["id"])
        problems_map: dict[str, bool] = (prog or {}).get("completed", {}).get("problems", {}) or {}
        topics_map: dict[str, bool] = (prog or {}).get("completed", {}).get("topics", {}) or {}
        lc_ids = t.get("lc_problem_ids") or []
        total = (prog or {}).get("total_problem_count") or len(lc_ids)
        completed = (prog or {}).get("completed_problem_count") or sum(1 for v in problems_map.values() if v)
        pct = int(round((completed / total) * 100)) if total > 0 else 0
        overall_completed += completed
        overall_total += total

        # Topic + difficulty rollup using the dataset so the feedback agent can
        # speak about *which* concepts are lagging, not just counts.
        for pid in lc_ids:
            try:
                meta = _lookup_problem(int(pid))
            except Exception:
                meta = {"difficulty": "Unknown", "related_topics": []}
            done = bool(problems_map.get(str(pid)))
            difficulty = meta["difficulty"] if meta["difficulty"] in diff_counts else None
            if difficulty:
                diff_counts[difficulty]["total"] += 1
                if done:
                    diff_counts[difficulty]["completed"] += 1
            tags = meta["related_topics"] or ["General"]
            for tag in tags:
                topic_totals[tag]["total"] += 1
                if done:
                    topic_totals[tag]["completed"] += 1

        weeks.append({
            "week": t.get("week"),
            "task_id": t["id"],
            "completed": completed,
            "total": total,
            "percentage": pct,
            "topics_completed": sum(1 for v in topics_map.values() if v),
            "topics_total": len(topics_map),
            "positive_feedback": (prog or {}).get("positive_feedback"),
            "negative_feedback": (prog or {}).get("negative_feedback"),
        })

    overall_pct = int(round((overall_completed / overall_total) * 100)) if overall_total > 0 else 0

    # ---- Pace: where *should* the user be relative to created_at + total weeks ----
    user_input = roadmap.get("user_input") or {}
    total_weeks = user_input.get("weeks") or len(weeks) or 1
    try:
        created_at = datetime.fromisoformat(str(roadmap.get("created_at")).replace("Z", "+00:00"))
    except Exception:
        created_at = now
    elapsed_days = max(0, (now - created_at).days)
    # +1 so day-0 counts as "in week 1"; clamp to plan length.
    elapsed_weeks = min(total_weeks, (elapsed_days // 7) + 1)
    expected_pct = int(round((elapsed_weeks / total_weeks) * 100)) if total_weeks > 0 else 0
    delta = overall_pct - expected_pct
    if overall_total == 0:
        status = "no_data"
    elif delta >= 10:
        status = "ahead"
    elif delta <= -10:
        status = "behind"
    else:
        status = "on_track"

    deadline = user_input.get("deadline")
    days_remaining = None
    if deadline:
        try:
            deadline_dt = datetime.fromisoformat(str(deadline).replace("Z", "+00:00"))
            if deadline_dt.tzinfo is None:
                deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
            days_remaining = (deadline_dt - now).days
        except Exception:
            days_remaining = None

    # ---- Topic strength (>=2 assigned to be meaningful) -------------------------
    topic_strength = []
    for name, c in topic_totals.items():
        if c["total"] < 2:
            continue
        pct = int(round((c["completed"] / c["total"]) * 100)) if c["total"] > 0 else 0
        topic_strength.append({"name": name, "completed": c["completed"], "total": c["total"], "percentage": pct})
    topic_strength.sort(key=lambda x: (x["percentage"], x["completed"]), reverse=True)
    strong_topics = [t for t in topic_strength if t["percentage"] >= 60][:5]
    weak_topics = sorted(
        [t for t in topic_strength if t["percentage"] < 60],
        key=lambda x: (x["percentage"], -x["total"]),
    )[:5]

    difficulty_breakdown = [
        {"name": k, "completed": v["completed"], "total": v["total"]}
        for k, v in diff_counts.items()
    ]

    return {
        "roadmap_id": roadmap["id"],
        "goal": user_input.get("goal"),
        "company": roadmap.get("company"),
        "created_at": roadmap.get("created_at"),
        "deadline": deadline,
        "total_weeks": total_weeks,
        "overall": {
            "completed": overall_completed,
            "total": overall_total,
            "percentage": overall_pct,
        },
        "weeks": weeks,
        "pace": {
            "elapsed_weeks": elapsed_weeks,
            "expected_percentage": expected_pct,
            "delta": delta,
            "status": status,
            "days_remaining": days_remaining,
        },
        "strong_topics": strong_topics,
        "weak_topics": weak_topics,
        "difficulty_breakdown": difficulty_breakdown,
    }


@router.get("/roadmaps")
async def get_all_roadmap_analytics(user=Depends(get_current_user)):
    """
    Lightweight overview of every roadmap's overall completion + pace status,
    keyed by roadmap_id. Used by the roadmap list page so each card can show a
    progress bar without N round-trips. Per-week / topic detail is omitted —
    use `/roadmap/{id}` for the full snapshot.
    """
    try:
        user_id = user.user.id
        now = datetime.now(timezone.utc)

        roadmaps_resp = (
            supabase.table("roadmaps").select("*").eq("user_id", user_id).execute()
        )
        roadmaps = roadmaps_resp.data or []
        if not roadmaps:
            return {"roadmaps": {}}

        roadmap_ids = [r["id"] for r in roadmaps]
        tasks_resp = (
            supabase.table("tasks").select("*").in_("roadmap_id", roadmap_ids).execute()
        )
        progress_resp = (
            supabase.table("progress")
            .select("*")
            .in_("roadmap_id", roadmap_ids)
            .eq("user_id", user_id)
            .execute()
        )

        tasks_by_roadmap: dict[int, list[dict]] = defaultdict(list)
        for t in tasks_resp.data or []:
            tasks_by_roadmap[t["roadmap_id"]].append(t)
        progress_by_roadmap: dict[int, list[dict]] = defaultdict(list)
        for p in progress_resp.data or []:
            progress_by_roadmap[p["roadmap_id"]].append(p)

        result: dict[int, dict] = {}
        for roadmap in roadmaps:
            rid = roadmap["id"]
            snap = _compute_roadmap_progress(
                roadmap, tasks_by_roadmap.get(rid, []), progress_by_roadmap.get(rid, []), now
            )
            result[rid] = {
                "roadmap_id": rid,
                "overall": snap["overall"],
                "pace": snap["pace"],
                "total_weeks": snap["total_weeks"],
                "weak_topics": [t["name"] for t in snap["weak_topics"][:3]],
            }
        return {"roadmaps": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building roadmap overview: {str(e)}")


@router.get("/roadmap/{roadmap_id}")
async def get_roadmap_analytics(roadmap_id: int, user=Depends(get_current_user)):
    """
    Per-roadmap progress dashboard: per-week completion, overall %, pace vs plan,
    strong/weak topics and the most recently generated AI feedback (if any).
    """
    try:
        user_id = user.user.id
        now = datetime.now(timezone.utc)

        roadmap_resp = (
            supabase.table("roadmaps")
            .select("*")
            .eq("id", roadmap_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not roadmap_resp.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")
        roadmap = roadmap_resp.data[0]

        tasks_resp = supabase.table("tasks").select("*").eq("roadmap_id", roadmap_id).execute()
        tasks = tasks_resp.data or []

        progress_resp = (
            supabase.table("progress")
            .select("*")
            .eq("roadmap_id", roadmap_id)
            .eq("user_id", user_id)
            .execute()
        )
        progress_entries = progress_resp.data or []

        result = _compute_roadmap_progress(roadmap, tasks, progress_entries, now)

        # Attach the latest cached feedback so the UI can render it without a
        # second round-trip. Table may not exist yet on older deployments.
        try:
            fb_resp = (
                supabase.table("roadmap_feedback")
                .select("*")
                .eq("roadmap_id", roadmap_id)
                .eq("user_id", user_id)
                .order("generated_at", desc=True)
                .limit(1)
                .execute()
            )
            result["last_feedback"] = fb_resp.data[0] if fb_resp.data else None
        except Exception as e:
            print(f"[analytics] roadmap_feedback lookup skipped: {str(e)}")
            result["last_feedback"] = None

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building roadmap analytics: {str(e)}")

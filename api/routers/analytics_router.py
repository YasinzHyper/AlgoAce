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

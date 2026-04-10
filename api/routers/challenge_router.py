from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase_client import supabase
from datetime import datetime, timezone
from typing import Optional
import random
import pandas as pd

router = APIRouter()

# Points awarded per solved problem when scoring a challenge / leaderboard.
DIFFICULTY_POINTS = {"Easy": 10, "Medium": 25, "Hard": 50}

try:
    _ch_problems_df = pd.read_csv(
        "dataset/leetcode-problems.csv",
        usecols=["id", "title", "difficulty", "related_topics", "acceptance_rate", "companies"],
    ).set_index("id", drop=False)
except Exception as e:
    print(f"[challenges] Error loading dataset: {str(e)}")
    _ch_problems_df = pd.DataFrame()


async def get_current_user(authorization: str = Header(...)):
    """Extract and validate Supabase token from Authorization header."""
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        token = authorization[len("Bearer "):]
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def _problem_detail(problem_id: int) -> Optional[dict]:
    if _ch_problems_df.empty or problem_id not in _ch_problems_df.index:
        return None
    row = _ch_problems_df.loc[problem_id]
    topics_raw = row.get("related_topics")
    companies_raw = row.get("companies")
    return {
        "id": int(row["id"]),
        "title": str(row.get("title") or f"Problem #{problem_id}"),
        "difficulty": str(row.get("difficulty") or "Unknown"),
        "related_topics": (
            [t.strip() for t in str(topics_raw).split(",") if t.strip()]
            if pd.notna(topics_raw)
            else []
        ),
        "companies": (
            [c.strip() for c in str(companies_raw).split(",") if c.strip()]
            if pd.notna(companies_raw)
            else []
        ),
        "acceptance_rate": float(row.get("acceptance_rate") or 0),
    }


def _select_problems(
    *,
    focus_topics: list[str],
    difficulty: Optional[str],
    count: int,
    exclude_ids: set[int],
) -> list[int]:
    """
    Pick `count` problem ids from the dataset that match the focus topics /
    difficulty, excluding ids the user has already solved (so a "weak topic"
    challenge surfaces fresh practice). Falls back progressively if there
    aren't enough strict matches.
    """
    if _ch_problems_df.empty:
        return []

    df = _ch_problems_df
    pool = df[~df["id"].isin(exclude_ids)].copy()

    def topic_match(row_topics: object) -> bool:
        if not focus_topics:
            return True
        if pd.isna(row_topics):
            return False
        tags = {t.strip().lower() for t in str(row_topics).split(",")}
        return any(ft.lower() in tags for ft in focus_topics)

    candidates = pool
    if focus_topics:
        candidates = candidates[candidates["related_topics"].apply(topic_match)]
    if difficulty and difficulty.lower() != "mixed":
        candidates = candidates[candidates["difficulty"].str.lower() == difficulty.lower()]

    ids = candidates["id"].tolist()
    random.shuffle(ids)
    selected = ids[:count]

    # Fallback 1: drop the difficulty constraint.
    if len(selected) < count and difficulty and difficulty.lower() != "mixed":
        extra = pool[pool["related_topics"].apply(topic_match)]
        extra_ids = [i for i in extra["id"].tolist() if i not in selected]
        random.shuffle(extra_ids)
        selected += extra_ids[: count - len(selected)]

    # Fallback 2: drop the topic constraint.
    if len(selected) < count:
        extra_ids = [i for i in pool["id"].tolist() if i not in selected]
        random.shuffle(extra_ids)
        selected += extra_ids[: count - len(selected)]

    return [int(i) for i in selected[:count]]


def _score_challenge(
    *, problem_ids: list[int], solved_ids: list[int], duration_minutes: int, elapsed_seconds: int
) -> dict:
    """Compute a deterministic score: difficulty-weighted solves + time bonus."""
    base = 0
    for pid in solved_ids:
        meta = _problem_detail(pid)
        diff = (meta or {}).get("difficulty", "Medium")
        base += DIFFICULTY_POINTS.get(diff, DIFFICULTY_POINTS["Medium"])

    total_seconds = max(1, duration_minutes * 60)
    remaining = max(0, total_seconds - max(0, elapsed_seconds))
    # Up to +50% of base points if finished instantly; 0 bonus if time ran out.
    time_bonus = int(round(base * 0.5 * (remaining / total_seconds))) if base > 0 else 0

    return {
        "score": base + time_bonus,
        "base_points": base,
        "time_bonus": time_bonus,
        "solved": len(solved_ids),
        "total": len(problem_ids),
    }


def _hydrate_challenge(row: dict) -> dict:
    """Attach problem metadata + derived fields to a raw `challenges` row."""
    problem_ids = row.get("problem_ids") or []
    solved_ids = set(row.get("solved_problem_ids") or [])
    problems = []
    for pid in problem_ids:
        meta = _problem_detail(int(pid)) or {
            "id": int(pid),
            "title": f"Problem #{pid}",
            "difficulty": "Unknown",
            "related_topics": [],
            "companies": [],
            "acceptance_rate": 0,
        }
        meta["solved"] = int(pid) in solved_ids
        problems.append(meta)

    started_at = row.get("started_at")
    expires_at = None
    if started_at and row.get("duration_minutes"):
        try:
            sa = datetime.fromisoformat(str(started_at).replace("Z", "+00:00"))
            expires_at = sa.timestamp() + int(row["duration_minutes"]) * 60
        except Exception:
            expires_at = None

    return {
        **row,
        "problems": problems,
        "solved_count": len(solved_ids),
        "total_count": len(problem_ids),
        "expires_at_epoch": expires_at,
    }


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class GenerateChallengeRequest(BaseModel):
    roadmap_id: Optional[int] = None
    difficulty: Optional[str] = "mixed"  # easy | medium | hard | mixed
    duration_minutes: int = 30
    problem_count: int = 4
    focus_topics: Optional[list[str]] = None


class SolveProblemRequest(BaseModel):
    problem_id: int
    solved: bool = True


class CompleteChallengeRequest(BaseModel):
    elapsed_seconds: Optional[int] = None
    abandoned: bool = False


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("")
async def list_challenges(limit: int = 20, user=Depends(get_current_user)):
    """List the authenticated user's challenges, newest first."""
    try:
        try:
            resp = (
                supabase.table("challenges")
                .select("*")
                .eq("user_id", user.user.id)
                .order("created_at", desc=True)
                .limit(max(1, min(limit, 100)))
                .execute()
            )
        except Exception as e:
            # Table may not exist yet on older deployments.
            print(f"[challenges] list skipped: {str(e)}")
            return {"challenges": []}
        return {"challenges": [_hydrate_challenge(r) for r in (resp.data or [])]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing challenges: {str(e)}")


@router.get("/recommended")
async def get_recommended_challenge(
    roadmap_id: Optional[int] = None, user=Depends(get_current_user)
):
    """
    Suggest a challenge configuration (without persisting it) based on the
    user's weakest topics in the given roadmap — or their most recent roadmap
    if none is supplied. Consumed by the practice dashboard "Recommended" card.
    """
    try:
        from routers.analytics_router import _compute_roadmap_progress

        user_id = user.user.id
        now = datetime.now(timezone.utc)

        if roadmap_id is None:
            rm_resp = (
                supabase.table("roadmaps")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if not rm_resp.data:
                return {"recommendation": None}
            roadmap = rm_resp.data[0]
            roadmap_id = roadmap["id"]
        else:
            rm_resp = (
                supabase.table("roadmaps")
                .select("*")
                .eq("id", roadmap_id)
                .eq("user_id", user_id)
                .execute()
            )
            if not rm_resp.data:
                raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")
            roadmap = rm_resp.data[0]

        tasks_resp = supabase.table("tasks").select("*").eq("roadmap_id", roadmap_id).execute()
        progress_resp = (
            supabase.table("progress")
            .select("*")
            .eq("roadmap_id", roadmap_id)
            .eq("user_id", user_id)
            .execute()
        )
        snap = _compute_roadmap_progress(
            roadmap, tasks_resp.data or [], progress_resp.data or [], now
        )

        focus_topics = [t["name"] for t in snap["weak_topics"][:3]] or [
            t["name"] for t in snap["strong_topics"][:2]
        ]
        # Scale difficulty with overall completion so early users aren't thrown Hards.
        pct = snap["overall"]["percentage"]
        difficulty = "easy" if pct < 25 else "medium" if pct < 70 else "hard"

        return {
            "recommendation": {
                "roadmap_id": roadmap_id,
                "goal": snap.get("goal"),
                "focus_topics": focus_topics,
                "difficulty": difficulty,
                "duration_minutes": 30,
                "problem_count": 4,
                "pace_status": snap["pace"]["status"],
                "reason": (
                    f"Targets your weakest areas ({', '.join(focus_topics)})"
                    if snap["weak_topics"]
                    else "Reinforces your current roadmap topics"
                ),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building recommendation: {str(e)}")


@router.post("/generate")
async def generate_challenge(body: GenerateChallengeRequest, user=Depends(get_current_user)):
    """
    Create a new timed challenge. Problems are selected from the LeetCode
    dataset to match `focus_topics` (or the roadmap's weak topics) and
    `difficulty`, excluding problems the user has already solved so the
    challenge always surfaces fresh practice.
    """
    try:
        from routers.analytics_router import _compute_roadmap_progress

        user_id = user.user.id
        now = datetime.now(timezone.utc)

        problem_count = max(1, min(body.problem_count or 4, 10))
        duration_minutes = max(5, min(body.duration_minutes or 30, 180))

        roadmap = None
        if body.roadmap_id is not None:
            rm_resp = (
                supabase.table("roadmaps")
                .select("*")
                .eq("id", body.roadmap_id)
                .eq("user_id", user_id)
                .execute()
            )
            if not rm_resp.data:
                raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")
            roadmap = rm_resp.data[0]

        # Derive focus topics from the roadmap's weak areas when not supplied.
        focus_topics = [t for t in (body.focus_topics or []) if t][:5]
        if not focus_topics and roadmap is not None:
            tasks_resp = (
                supabase.table("tasks").select("*").eq("roadmap_id", roadmap["id"]).execute()
            )
            progress_resp = (
                supabase.table("progress")
                .select("*")
                .eq("roadmap_id", roadmap["id"])
                .eq("user_id", user_id)
                .execute()
            )
            snap = _compute_roadmap_progress(
                roadmap, tasks_resp.data or [], progress_resp.data or [], now
            )
            focus_topics = [t["name"] for t in snap["weak_topics"][:3]]

        # Exclude already-solved problems so practice stays novel.
        solved_resp = (
            supabase.table("problem_completions")
            .select("problem_id")
            .eq("user_id", user_id)
            .execute()
        )
        exclude_ids = {int(r["problem_id"]) for r in (solved_resp.data or [])}

        problem_ids = _select_problems(
            focus_topics=focus_topics,
            difficulty=body.difficulty,
            count=problem_count,
            exclude_ids=exclude_ids,
        )
        if not problem_ids:
            raise HTTPException(status_code=503, detail="Problem dataset unavailable")

        topic_label = ", ".join(focus_topics[:2]) if focus_topics else "Mixed"
        diff_label = (body.difficulty or "mixed").title()
        title = f"{topic_label} · {diff_label} · {duration_minutes}m"

        record = {
            "user_id": user_id,
            "roadmap_id": roadmap["id"] if roadmap else None,
            "title": title,
            "problem_ids": problem_ids,
            "focus_topics": focus_topics,
            "difficulty": (body.difficulty or "mixed").lower(),
            "duration_minutes": duration_minutes,
            "status": "active",
            "solved_problem_ids": [],
            "started_at": now.isoformat(),
        }

        try:
            insert_resp = supabase.table("challenges").insert(record).execute()
        except Exception as e:
            print(f"[challenges] insert failed (table missing?): {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Challenges table not available. Apply the latest migration in api/schema.md.",
            )
        if not insert_resp.data:
            raise HTTPException(status_code=500, detail="Failed to create challenge")

        return {"challenge": _hydrate_challenge(insert_resp.data[0])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating challenge: {str(e)}")


@router.get("/{challenge_id}")
async def get_challenge(challenge_id: int, user=Depends(get_current_user)):
    try:
        resp = (
            supabase.table("challenges")
            .select("*")
            .eq("id", challenge_id)
            .eq("user_id", user.user.id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Challenge not found")
        return {"challenge": _hydrate_challenge(resp.data[0])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching challenge: {str(e)}")


@router.put("/{challenge_id}/solve")
async def mark_problem_solved(
    challenge_id: int, body: SolveProblemRequest, user=Depends(get_current_user)
):
    """Toggle a problem's solved state within an active challenge."""
    try:
        resp = (
            supabase.table("challenges")
            .select("*")
            .eq("id", challenge_id)
            .eq("user_id", user.user.id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Challenge not found")
        challenge = resp.data[0]
        if challenge.get("status") != "active":
            raise HTTPException(status_code=400, detail="Challenge is not active")

        problem_ids = [int(p) for p in (challenge.get("problem_ids") or [])]
        if int(body.problem_id) not in problem_ids:
            raise HTTPException(status_code=400, detail="Problem not part of this challenge")

        solved = set(int(p) for p in (challenge.get("solved_problem_ids") or []))
        if body.solved:
            solved.add(int(body.problem_id))
        else:
            solved.discard(int(body.problem_id))

        update_resp = (
            supabase.table("challenges")
            .update({"solved_problem_ids": sorted(solved)})
            .eq("id", challenge_id)
            .execute()
        )
        if not update_resp.data:
            raise HTTPException(status_code=500, detail="Failed to update challenge")
        return {"challenge": _hydrate_challenge(update_resp.data[0])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating challenge: {str(e)}")


@router.post("/{challenge_id}/complete")
async def complete_challenge(
    challenge_id: int, body: CompleteChallengeRequest, user=Depends(get_current_user)
):
    """
    Finalise a challenge: compute the score, mark it completed/abandoned, and
    mirror solved problems into `problem_completions` so they count toward
    analytics, streaks and the leaderboard.
    """
    try:
        user_id = user.user.id
        now = datetime.now(timezone.utc)

        resp = (
            supabase.table("challenges")
            .select("*")
            .eq("id", challenge_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Challenge not found")
        challenge = resp.data[0]
        if challenge.get("status") != "active":
            return {"challenge": _hydrate_challenge(challenge), "result": None}

        problem_ids = [int(p) for p in (challenge.get("problem_ids") or [])]
        solved_ids = [int(p) for p in (challenge.get("solved_problem_ids") or [])]
        duration_minutes = int(challenge.get("duration_minutes") or 30)

        elapsed_seconds = body.elapsed_seconds
        if elapsed_seconds is None:
            try:
                sa = datetime.fromisoformat(str(challenge["started_at"]).replace("Z", "+00:00"))
                elapsed_seconds = int((now - sa).total_seconds())
            except Exception:
                elapsed_seconds = duration_minutes * 60
        elapsed_seconds = max(0, elapsed_seconds)

        result = _score_challenge(
            problem_ids=problem_ids,
            solved_ids=solved_ids,
            duration_minutes=duration_minutes,
            elapsed_seconds=elapsed_seconds,
        )
        status = "abandoned" if body.abandoned and result["solved"] == 0 else "completed"

        update_resp = (
            supabase.table("challenges")
            .update(
                {
                    "status": status,
                    "score": result["score"],
                    "completed_at": now.isoformat(),
                }
            )
            .eq("id", challenge_id)
            .execute()
        )
        if not update_resp.data:
            raise HTTPException(status_code=500, detail="Failed to finalise challenge")

        # Mirror solves into problem_completions (idempotent) so they feed
        # analytics + streaks + the points-based leaderboard. task_id/roadmap_id
        # are nullable for challenge-sourced rows.
        if solved_ids:
            try:
                existing_resp = (
                    supabase.table("problem_completions")
                    .select("problem_id")
                    .eq("user_id", user_id)
                    .in_("problem_id", solved_ids)
                    .execute()
                )
                existing = {int(r["problem_id"]) for r in (existing_resp.data or [])}
                rows = []
                for pid in solved_ids:
                    if pid in existing:
                        continue
                    meta = _problem_detail(pid) or {}
                    topics = meta.get("related_topics") or []
                    rows.append(
                        {
                            "user_id": user_id,
                            "roadmap_id": challenge.get("roadmap_id"),
                            "task_id": None,
                            "problem_id": pid,
                            "topic_name": topics[0] if topics else "General",
                            "source": "challenge",
                        }
                    )
                if rows:
                    supabase.table("problem_completions").insert(rows).execute()
                supabase.rpc("refresh_user_streak", {"p_user_id": user_id}).execute()
            except Exception as e:
                # Older DBs may still have NOT NULL on task_id; non-fatal.
                print(f"[challenges] completion mirror skipped: {str(e)}")

        return {"challenge": _hydrate_challenge(update_resp.data[0]), "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error completing challenge: {str(e)}")


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------
@router.get("/leaderboard/")
async def get_leaderboard(
    period: str = "week", limit: int = 10, user=Depends(get_current_user)
):
    """
    Points-based leaderboard backed by the `public.get_leaderboard` SQL
    function (see schema.md). Points = difficulty-weighted problem solves +
    challenge scores within the period. Returns the top `limit` plus the
    caller's own rank if they fall outside the top N.
    """
    try:
        period = period if period in {"week", "month", "all"} else "week"
        limit = max(1, min(limit, 50))
        try:
            resp = supabase.rpc(
                "get_leaderboard", {"p_period": period, "p_limit": 500}
            ).execute()
        except Exception as e:
            print(f"[leaderboard] RPC unavailable: {str(e)}")
            return {"period": period, "entries": [], "me": None}

        rows = resp.data or []
        user_id = user.user.id
        for idx, row in enumerate(rows):
            row["rank"] = idx + 1
            row["is_me"] = row.get("user_id") == user_id

        top = rows[:limit]
        me = next((r for r in rows if r.get("is_me")), None)
        # If the caller isn't in the top N, append their row so the UI can pin it.
        if me and not any(r.get("is_me") for r in top):
            top = top + [me]

        return {"period": period, "entries": top, "me": me}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building leaderboard: {str(e)}")

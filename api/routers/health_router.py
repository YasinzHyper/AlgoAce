"""Health routes: is the API up, and can it reach the database?

Both routes are public and return no data. Deploy checks call them, so they
stay cheap: `/health` looks only at what this process has in memory, and
`/health/db` makes one read of at most one id, which it does not return.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from routers import (
    analytics_router,
    challenge_router,
    interview_router,
    problem_router,
    progress_router,
)
from supabase_client import supabase

router = APIRouter()

# Each router loads its own copy of the LeetCode dataset when it is imported.
# All but problem_router fall back to an empty frame when that fails, so an
# app that started can still be missing the dataset.
_DATASETS = {
    "problems": (problem_router, "problems_df"),
    "analytics": (analytics_router, "_problems_df"),
    "challenges": (challenge_router, "_ch_problems_df"),
    "interviews": (interview_router, "_iv_problems_df"),
    "progress": (progress_router, "_pc_problems_df"),
}


def _unavailable(reason: str) -> JSONResponse:
    return JSONResponse(status_code=503, content={"status": "error", "reason": reason})


@router.get("/health")
async def health():
    """200 once the app has started and every router has the problem dataset."""
    missing = [name for name, (module, attr) in _DATASETS.items() if getattr(module, attr).empty]
    if missing:
        print(f"[health] Problem dataset not loaded for: {', '.join(missing)}")
        return _unavailable("problem dataset not loaded")
    return {"status": "ok"}


# A plain def, so FastAPI runs it in its thread pool: the Supabase client is
# synchronous, and a slow database must not hold up every other request.
@router.get("/health/db")
def health_db():
    """200 when one trivial read through the shared Supabase client succeeds."""
    try:
        supabase.table("roadmaps").select("id").limit(1).execute()
    except Exception as e:
        print(f"[health] Database read failed: {e!r}")
        return _unavailable("database read failed")
    return {"status": "ok"}

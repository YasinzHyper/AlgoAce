"""
One-off backfill: mirror historical `progress.completed` flags into
`problem_completions` / `topic_completions` so existing users appear in
analytics without having to re-toggle every problem.

Idempotent: skips rows that already exist for the same (user, task, item).
Uses each progress row's `updated_at` (falling back to `created_at`) as the
synthetic `completed_at` so streak/weekly charts are roughly accurate.

Run from the `api/` directory:
    python -m scripts.backfill_completions
"""
from __future__ import annotations

import sys
import pandas as pd

sys.path.append(".")  # allow `python -m scripts.backfill_completions` from api/

from supabase_client import supabase  # noqa: E402

try:
    _df = pd.read_csv("dataset/leetcode-problems.csv", usecols=["id", "related_topics"]).set_index("id")
except Exception as e:  # pragma: no cover - dataset must exist in prod
    print(f"[backfill] dataset load failed: {e}")
    _df = pd.DataFrame()


def _primary_topic(problem_id: int) -> str:
    try:
        if not _df.empty and problem_id in _df.index:
            raw = _df.loc[problem_id, "related_topics"]
            if pd.notna(raw) and str(raw).strip():
                return str(raw).split(",")[0].strip()
    except Exception:
        pass
    return "General"


def _exists(table: str, **filters) -> bool:
    q = supabase.table(table).select("id")
    for k, v in filters.items():
        q = q.eq(k, v)
    return bool(q.limit(1).execute().data)


def main() -> None:
    progress_rows = supabase.table("progress").select("*").execute().data or []
    print(f"[backfill] scanning {len(progress_rows)} progress rows")

    pc_inserted = tc_inserted = skipped = 0
    touched_users: set[str] = set()

    for row in progress_rows:
        user_id = row.get("user_id")
        roadmap_id = row.get("roadmap_id")
        task_id = row.get("task_id")
        if not (user_id and roadmap_id and task_id):
            continue
        completed = row.get("completed") or {}
        ts = row.get("updated_at") or row.get("created_at")

        for pid_str, done in (completed.get("problems") or {}).items():
            if not done:
                continue
            try:
                pid = int(pid_str)
            except (TypeError, ValueError):
                continue
            if _exists("problem_completions", user_id=user_id, task_id=task_id, problem_id=pid):
                skipped += 1
                continue
            supabase.table("problem_completions").insert({
                "user_id": user_id,
                "roadmap_id": roadmap_id,
                "task_id": task_id,
                "problem_id": pid,
                "topic_name": _primary_topic(pid),
                "completed_at": ts,
            }).execute()
            pc_inserted += 1
            touched_users.add(user_id)

        for topic, done in (completed.get("topics") or {}).items():
            if not done:
                continue
            if _exists("topic_completions", user_id=user_id, task_id=task_id, topic_name=topic):
                skipped += 1
                continue
            supabase.table("topic_completions").insert({
                "user_id": user_id,
                "roadmap_id": roadmap_id,
                "task_id": task_id,
                "topic_name": topic,
                "completed_at": ts,
            }).execute()
            tc_inserted += 1
            touched_users.add(user_id)

    for uid in touched_users:
        try:
            supabase.rpc("refresh_user_streak", {"p_user_id": uid}).execute()
        except Exception as e:  # pragma: no cover
            print(f"[backfill] streak refresh failed for {uid}: {e}")

    print(
        f"[backfill] done. problem_completions+{pc_inserted} "
        f"topic_completions+{tc_inserted} skipped={skipped} users_refreshed={len(touched_users)}"
    )


if __name__ == "__main__":
    main()

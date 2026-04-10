# Database Reference

All persistence is in **Supabase Postgres**. This document narrates *what each table is for* and how they relate.

```
auth.users ──┬── public.users (profile: goal, deadline, weekly_hours, display_name…)
             ├── user_streaks (1:1 cache, refreshed by refresh_user_streak())
             ├── roadmaps ──┬── tasks (1 per week; lc_problem_ids[], other_topics[])
             │              ├── progress (1 per task; completed JSON, %, week feedback)
             │              └── roadmap_feedback (history of AI Coach generations)
             ├── problem_completions (every solve, any source)
             ├── topic_completions   (every non-DSA topic tick)
             ├── challenges          (timed sessions)
             └── interview_sessions  (voice mock interviews)
```

---

## Core tables

### `public.users`
Profile row keyed on `auth.users.id`. Stores the inputs used to seed roadmap generation: `goal`, `deadline`, `weekly_hours`, `weeks`, `current_knowledge json`, plus `display_name` (optional public leaderboard handle).

### `roadmaps`
One per generated study plan. `roadmap_data jsonb[]` is the week-by-week topic plan returned by `RoadmapTool`; `user_input json` is the exact payload that produced it (for regeneration); `company` is extracted from the goal if mentioned.

### `tasks`
One row per `(roadmap, week)`. `lc_problem_ids bigint[]` are the recommended LeetCode IDs; `other_topics text[]` are non-DSA study items for that week.

### `progress`
One row per task. `completed json` = `{problems: {<id>: bool}, topics: {<name>: bool}}` drives the checkbox UI; `completion_percentage`, `total_problem_count`, `completed_problem_count` are derived caches; `positive_feedback` / `negative_feedback` hold the last week-level AI feedback text.

---

## Analytics tables

### `problem_completions`
Append-only log of every solved problem: `(user_id, problem_id, topic_name, completed_at, source)`. `roadmap_id` / `task_id` are **nullable** so non-roadmap solves can be recorded. `source` ∈ `roadmap | challenge | interview`. This is the single source of truth for the heatmap, streaks, topic mastery, and leaderboard.

### `topic_completions`
Same idea for non-DSA `other_topics` ticks.

### `user_streaks`
Per-user cache `{current_streak, longest_streak, last_activity_date}`. **Never written directly** — always via `refresh_user_streak(user_id)` (see below), which every solve-recording code path calls.

### `roadmap_feedback`
History of roadmap-level AI Coach generations: `summary`, `positive_feedback`, `negative_feedback`, `focus_areas jsonb`, plus the `completion_percentage` / `pace_status` snapshot at generation time. Newest row per roadmap is what the UI shows.

---

## Practice tables

### `challenges`
Timed problem-set sessions. `problem_ids[]` is fixed at creation; `solved_problem_ids[]` is mutated during play; `status` ∈ `active | completed | abandoned`; `score` is set on completion (difficulty-weighted + time bonus). `roadmap_id` is optional and only used so `/recommended` can derive weak topics.

### `interview_sessions`
Voice mock interviews. Key columns:
- `interview_type` (`technical | behavioral | system_design`), `difficulty`, `duration_minutes`, `status`
- `context_snapshot jsonb` — the *exact* persona/goal/strong-weak-topic snapshot + system prompt fed to Gemini Live (kept for replay/debug)
- `problem_ids[]` — LC problems actually asked (technical only)
- `transcript jsonb` — `[{role, text, at_ms}]`, appended turn-by-turn via `/event`
- `rubric_scores jsonb`, `overall_score int`, `feedback jsonb` — written by `/complete`

---

## Functions / RPCs

### `refresh_user_streak(p_user_id uuid) → void`
Recomputes current + longest streak from the union of distinct active days in `problem_completions` ∪ `topic_completions` and upserts `user_streaks`. Called after every completion insert/delete (roadmap ticks, challenge completion, interview completion, backfill script).

### `get_leaderboard(p_period text, p_limit int) → table(...)`
`SECURITY DEFINER` so it can join `auth.users` for display names while remaining callable with the anon key. Aggregates, per user within the period window:
```
points = (distinct problems solved × 25) + Σ challenges.score
```
Returns `(user_id, display_name, problems_solved, challenge_points, points)` ordered by `points DESC`. Display name resolves `users.display_name → auth metadata full_name/name → email local-part → 'Anonymous'`.

# REST API Reference

Base URL: `http://localhost:8000` · All routes (except where noted) require `Authorization: Bearer <supabase_access_token>`.

The interactive Swagger UI at `/docs` is generated from the FastAPI app and is always authoritative for exact request/response shapes; this file explains **purpose and behaviour**.

---

## `/api/user` — `routers/user_router.py`

| Method & Path | Purpose |
|---|---|
| `GET /api/user/` | Return the caller's `public.users` profile row (goal, deadline, weekly_hours, current_knowledge, display_name). |
| `POST /api/user/update` | Upsert the profile row. Body: `UserData` (`models/schema.py`). |

---

## `/api/roadmap` — `routers/roadmap_router.py`

| Method & Path | Purpose |
|---|---|
| `GET /api/roadmap/` | List all roadmaps owned by the caller. |
| `GET /api/roadmap/{id}` | Fetch one roadmap (404 if not owned). |
| `POST /api/roadmap/generate` | Body: `UserInput` `{goal, deadline?, weekly_hours?, current_knowledge?, weeks?}`. Runs `RoadmapTool` (Gemini) → inserts `roadmaps` row → runs `ProblemRecommendationTool` to create one `tasks` row per week and bootstrap matching `progress` rows. Returns the saved roadmap. |
| `DELETE /api/roadmap/{id}` | Delete a roadmap (cascades to tasks/progress). |

---

## `/api/problems` — `routers/problem_router.py`

| Method & Path | Purpose |
|---|---|
| `GET /api/problems/explanation?problem_id=` | **No auth.** Hydrates the problem from `leetcode-problems.csv` and asks Gemini for a structured explanation (intuition, approach, complexity). |
| `POST /api/problems/recommend/{roadmap_id}` | Re-run problem recommendation for an existing roadmap (replaces its `tasks` + `progress` rows). |
| `GET /api/problems/{roadmap_id}` | All tasks for a roadmap, with each `lc_problem_id` hydrated to `{id, title, difficulty, related_topics, companies, acceptance_rate, url}`. |
| `GET /api/problems/{roadmap_id}/week/{week}` | Same, scoped to one week. |
| `PUT /api/problems/{roadmap_id}/week/{week}` | Replace the problem list for a week. |
| `DELETE /api/problems/{roadmap_id}` | Delete all tasks for a roadmap. |
| `DELETE /api/problems/{roadmap_id}/week/{week}` | Delete one week's task. |

---

## `/api/progress` — `routers/progress_router.py`

| Method & Path | Purpose |
|---|---|
| `GET /api/progress/task/{task_id}` | Progress row for one week (completed map, %, cached feedback). |
| `GET /api/progress/roadmap/{roadmap_id}` | All progress rows for a roadmap. |
| `PUT /api/progress/task/{task_id}/complete` | Toggle a problem/topic's completed flag. Mirrors the change into `problem_completions` / `topic_completions`, recomputes %, and calls `refresh_user_streak()`. |
| `POST /api/progress/task/{task_id}/feedback` | **Week-level AI feedback.** Builds a goal-aware prompt (week N of M, named solved vs pending problems with difficulty + tags) → Gemini JSON → persists `positive_feedback` / `negative_feedback` on the progress row. Returns `{message, progress, focus_areas}`. |
| `GET /api/progress/roadmap/{roadmap_id}/feedback` | Latest cached **roadmap-level** feedback row, or `{feedback: null}`. |
| `POST /api/progress/roadmap/{roadmap_id}/feedback` | **Roadmap-level "AI Coach".** Uses `_compute_roadmap_progress()` so the model sees the exact numbers the UI renders, folds in the user's latest completed interview score, asks Gemini for `{summary, positive, negative, focus_areas:[{topic,reason,action}]}`, persists to `roadmap_feedback` (skipped + logged if the table is missing). |

---

## `/api/analytics` — `routers/analytics_router.py`

| Method & Path | Purpose |
|---|---|
| `GET /api/analytics/summary` | Everything the `/analytics` page needs: activity heatmap buckets, current/longest streak, difficulty distribution, topic-mastery list (from the LeetCode tag join), weekly solve counts. |
| `GET /api/analytics/dashboard` | Compact payload for the `/dashboard` overview cards: totals, streak, closest-deadline roadmap with pace status, challenge points, last interview score. |
| `GET /api/analytics/roadmaps` | Lightweight progress snapshot for *every* roadmap (used to show inline % on roadmap cards). |
| `GET /api/analytics/roadmap/{id}` | Full per-roadmap snapshot via `_compute_roadmap_progress()`: per-week completion, overall %, **pace vs plan** (`expected_percentage`, `delta`, `status`, `days_remaining`), strong/weak topics, difficulty breakdown, plus the most recent `roadmap_feedback` row as `last_feedback`. |

---

## `/api/challenges` — `routers/challenge_router.py`

| Method & Path | Purpose |
|---|---|
| `GET /api/challenges` | List the caller's challenges (all statuses). Lazily finalises stale `active` rows → `abandoned`. |
| `GET /api/challenges/recommended` | Suggest a challenge config (focus topics, difficulty, duration) derived from the caller's roadmap weak topics. Does **not** create anything. |
| `GET /api/challenges/stats` | `{completed, active, abandoned, best_score, total_points, avg_accuracy, active_challenge}` — `active_challenge` is fully hydrated so the practice hub can render a Resume card without a second round-trip. |
| `POST /api/challenges/generate` | Body: `{roadmap_id?, focus_topics?, difficulty, problem_count, duration_minutes}`. Selects matching problems from the dataset (excluding already-solved), inserts a `challenges` row with `status='active'`, returns it hydrated. |
| `GET /api/challenges/{id}` | One challenge, problems hydrated, plus derived `expires_at_epoch`. |
| `PUT /api/challenges/{id}/solve` | Body: `{problem_id, solved}`. Toggle a problem in `solved_problem_ids` while the challenge is active. |
| `POST /api/challenges/{id}/complete` | Body: `{abandoned?: bool}`. Finalises: computes difficulty-weighted score (Easy×10 / Medium×25 / Hard×50) with up to +50% time bonus, sets `status`, mirrors solved problems into `problem_completions` with `source='challenge'`, refreshes streak. Idempotent. |
| `GET /api/challenges/leaderboard/?period=&limit=` | Calls the `get_leaderboard(period, limit)` Postgres RPC. `period` ∈ `week\|month\|all`. Returns ranked entries + the caller's own entry (`me`) even if outside the limit. |

---

## `/api/interviews` — `routers/interview_router.py`

| Method & Path | Purpose |
|---|---|
| `GET /api/interviews` | List sessions (lazy-finalises stale `active` → `abandoned`). |
| `GET /api/interviews/stats` | `{completed, active, best_score, avg_score, last, active_session}` for dashboard / practice hub. |
| `POST /api/interviews/start` | Body: `{roadmap_id?, interview_type, difficulty, duration_minutes, voice_model?}`. Builds a context snapshot (goal, company, pace, days-remaining, strong/weak topics, recent solves as exclusion list), picks warm-up + main problems for technical interviews, persists the row with the full system prompt baked into `context_snapshot`. |
| `POST /api/interviews/{id}/token` | Mints a **single-use ephemeral Gemini Live token** (`v1alpha auth_tokens.create`) with model, system instruction, voice, input/output transcription, the `end_interview` tool, and context-window compression all locked server-side. Two voice models selectable (`native` / `fast`, env-overridable). The browser never sees `GEMINI_API_KEY`. |
| `GET /api/interviews/{id}` | Hydrated session (problems + `expires_at_epoch`). |
| `POST /api/interviews/{id}/event` | Body: `{turns: [{role, text, at_ms}]}`. Append finalised transcript turns. Called by the client on every committed turn so the DB transcript survives socket drops. |
| `POST /api/interviews/{id}/complete` | Body: `{abandoned?: bool}`. Grades the stored transcript with non-live Gemini against the per-type rubric (technical: problem_solving 35% / coding 25% / communication 20% / complexity 10% / independence 10%), persists `rubric_scores`, `overall_score` (0–100), and `feedback {summary, strengths, improvements, focus_areas}`. Mirrors asked problems into `problem_completions` with `source='interview'` when problem_solving ≥ 3/5. Refreshes streak. Sessions with <2 turns finalise as `abandoned`. Idempotent. |

---

## Error model

- `401` — missing/invalid `Authorization` header or token rejected by Supabase.
- `404` — row not found **or** not owned by the caller (ownership and existence are not distinguished).
- `500` — wrapped exception; `detail` contains the message. Gemini failures surface here.

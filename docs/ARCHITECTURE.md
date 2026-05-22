# Architecture

This document explains how AlgoAce's pieces fit together so a new contributor can trace any feature from button-click to database row.

---

## 1. High-level topology

```
┌────────────┐  Bearer JWT   ┌────────────┐  supabase-py  ┌────────────┐
│  Next.js   │──────────────▶│  FastAPI   │──────────────▶│  Supabase  │
│  client/   │◀──────────────│  api/      │◀──────────────│  Postgres  │
└─────┬──────┘     JSON      └─────┬──────┘               └────────────┘
      │                            │
      │ @google/genai (WS,         │ google-genai (HTTPS)
      │  ephemeral token)          ▼
      │                     ┌──────────────┐       ┌───────────────────────┐
      └────────────────────▶│ Gemini Live  │       │ dataset/leetcode-     │
                            │ (voice)      │       │ problems.csv (pandas) │
                            └──────────────┘       └───────────────────────┘
```

There is **no server-side session** in FastAPI — every request is independently authenticated with the Supabase JWT the browser already holds.

---

## 2. Authentication flow

| Step | Where | What happens |
|---|---|---|
| 1 | `client/src/app/{login,signup}/actions.ts` | Server actions call Supabase Auth; cookies are set by `@supabase/ssr`. |
| 2 | `client/src/middleware.ts` | On every request, refreshes the session cookie and redirects unauthenticated users away from the `(dashboard)` route group. |
| 3 | `client/src/hooks/*` | Before each `fetch`, the hook reads `supabase.auth.getSession()` and sets `Authorization: Bearer <access_token>`. |
| 4 | `api/routers/*.py → get_current_user()` | Each router declares this FastAPI dependency: it strips `Bearer `, calls `supabase.auth.get_user(token)`, and 401s on failure. The resulting `user.user.id` is used as the row-ownership filter for every query. |

There is no role/permission system beyond "is this row's `user_id` yours?". The leaderboard is the one cross-user surface and it goes through a `SECURITY DEFINER` Postgres function (`get_leaderboard`) so the anon key can read aggregated data without exposing raw rows.

---

## 3. The data layer (client)

All backend communication is funnelled through **typed hooks** in `client/src/hooks/`. Pages never call `fetch` directly. The convention for each hook:

```ts
const { data, loading, error, refresh, ...actions } = useThing(args)
```

| Hook | Wraps | Notable behaviour |
|---|---|---|
| `use-dashboard.ts` | `GET /api/analytics/dashboard` | Single payload that powers the `/dashboard` overview cards. |
| `use-analytics.ts` | `GET /api/analytics/summary` | Heatmap + topic mastery + difficulty distribution for `/analytics`. |
| `use-roadmap-progress.ts` | `GET /api/analytics/roadmap/{id}` + `GET/POST /api/progress/roadmap/{id}/feedback` | Drives the **AI Coach** panel. Manages a 5-min regenerate cooldown timer locally. |
| `use-challenges.ts` | `/api/challenges/*` | `useChallenges()` (list/generate/recommended), `useChallenge(id)` (markSolved/complete with optimistic updates), `useChallengeStats()`. |
| `use-leaderboard.ts` | `GET /api/challenges/leaderboard/` | Period tabs; pins current user's row if outside top N. |
| `use-interview.ts` | `/api/interviews/*` | `useInterviews()` (list/stats/start), `useInterviewSession(id)` (mintToken/appendTurns/complete), `useInterviewStats()`. |
| `use-live-interview.ts` | Gemini Live WS | The full voice pipeline — see §6. |
| `use-shake-detector.ts` | `getUserMedia` video | Computes inter-frame pixel delta on a hidden `<canvas>` to nudge fidgety interviewees. |

---

## 4. The router layer (server)

`api/main.py` mounts seven routers under `/api/*`. Each router is self-contained: it declares its own `get_current_user` dependency, imports the shared `supabase` client, and (where needed) loads `dataset/leetcode-problems.csv` into a module-level pandas DataFrame at import time.

| Prefix | Module | Responsibility |
|---|---|---|
| `/api/user` | `user_router.py` | Read/update the `public.users` profile row (goal, deadline, weekly_hours, current_knowledge). |
| `/api/roadmap` | `roadmap_router.py` | CRUD roadmaps. `POST /generate` runs `RoadmapTool` (Gemini) → inserts `roadmaps` row → calls `services.problem_service.generate_and_save_recommendations()` to populate `tasks` + bootstrap `progress` rows. |
| `/api/problems` | `problem_router.py` | Per-roadmap/per-week task CRUD, re-recommend, and the AI explanation endpoint (hydrates the problem from the CSV, asks Gemini for an approach walkthrough). |
| `/api/progress` | `progress_router.py` | Mark problems/topics complete (mirrors into `problem_completions`/`topic_completions` and refreshes streaks). Week-level and roadmap-level **AI feedback** generation. |
| `/api/analytics` | `analytics_router.py` | `/summary` (heatmap, streak, topic mastery, difficulty mix), `/dashboard` (headline cards), `/roadmaps` + `/roadmap/{id}` (pace-vs-plan, strong/weak topics, last cached feedback). Home of `_compute_roadmap_progress()`, reused by the feedback + interview routers. |
| `/api/challenges` | `challenge_router.py` | Generate timed problem-set sessions from weak topics, mark-solved, complete (difficulty-weighted score + time bonus, mirrors solves with `source='challenge'`), `/stats`, `/recommended`, `/leaderboard/`. |
| `/api/interviews` | `interview_router.py` | Start a context-aware session, mint single-use Gemini Live tokens, append transcript turns, grade against a rubric on `/complete`, list/stats. |

Full per-endpoint reference: [`API.md`](API.md).

---

## 5. AI integration

### Text (Gemini)
All non-voice AI goes through `google-genai` with the model named in `MODEL`. Two patterns are used:

1. **Tool classes** (`api/tools.py`, `api/agents/specialized.py`) — `RoadmapTool`, `ProblemRecommendationTool`, etc. subclass `crewai.tools.BaseTool` so they *can* be orchestrated by a CrewAI crew, but today routers call `._run()` directly. The multi-agent `DSACrew` in `agents/crew.py` is scaffolding for a future upgrade.
2. **Inline calls** (feedback, rubric grading, explanations) — routers build a prompt string and call the client with `response_mime_type="application/json"` so the response can be `json.loads`-ed without regex stripping.

All prompts that coach the user are **goal-aware**: they interpolate the user's goal/company/deadline, the exact pace numbers the UI shows (`_compute_roadmap_progress()`), the named solved/pending problems, and (for roadmap-level feedback) the latest mock-interview score. This is what makes feedback feel coherent across surfaces.

### Voice (Gemini Live)
See §6.

### Problem dataset
`dataset/leetcode-problems.csv` is the canonical problem catalogue. It's loaded once per process into pandas and used to:
- select problems by topic/difficulty/company for roadmap weeks, challenges, and interview questions;
- hydrate `problem_id` → `{title, difficulty, related_topics, companies, acceptance_rate, url}` for API responses;
- join `related_topics` onto `problem_completions` to compute per-user **topic mastery** and strong/weak topic lists.

---

## 6. Voice mock-interview pipeline

This is the most involved flow in the app — worth tracing once.

```
 setup page ──POST /api/interviews/start──▶ builds context_snapshot (goal, pace,
                                            strong/weak topics, recent solves to
                                            exclude) + picks warm-up/main problems
                                            → inserts interview_sessions row
                                            → redirect to /practice/mock-interviews/{id}

 [id] page mounts
   useInterviewSession(id).mintToken() ──POST /{id}/token──▶ server mints a
                                            single-use ephemeral Gemini Live token
                                            with model, system prompt, voice,
                                            transcription, end_interview tool and
                                            context-window compression all LOCKED
                                            server-side. Browser never sees
                                            GEMINI_API_KEY.

   useLiveInterview({token,...}).connect()
     getUserMedia({audio}) → AudioWorklet @16 kHz mono PCM → base64
       → @google/genai session.sendRealtimeInput(...)        (upstream)
     serverContent.audio @24 kHz PCM → queued AudioBufferSourceNode
       → speakers                                            (downstream)
     serverContent.inputTranscription / outputTranscription
       → local rolling transcript
       → debounced POST /{id}/event so the DB transcript is authoritative
     toolCall: end_interview → disconnect() → complete()
     unplanned close → one-shot re-mint + reconnect

 End / timer expiry ──POST /{id}/complete──▶ non-live Gemini grades the saved
                                            transcript against the per-type rubric,
                                            persists rubric_scores + overall_score
                                            + feedback{summary,strengths,
                                            improvements,focus_areas}, mirrors asked
                                            problems into problem_completions with
                                            source='interview' (if problem_solving
                                            ≥ 3/5), refreshes streak.

 [id] page now renders <InterviewReport/> from the persisted row.
```

Design spec: [`../plans/AI-Interviewer-Plan.md`](../plans/AI-Interviewer-Plan.md).

---

## 7. Feature trace cheat-sheet

When you need to find "where does X live?", follow the hook → router → table chain:

| Feature | Client hook | Client page(s) | API router | DB tables |
|---|---|---|---|---|
| Roadmap CRUD + graph | (inline fetch) | `app/(dashboard)/roadmap/**` | `roadmap_router.py` | `roadmaps`, `tasks`, `progress` |
| Weekly problem board | (inline fetch) | `app/(dashboard)/problems/**` | `problem_router.py`, `progress_router.py` | `tasks`, `progress`, `problem_completions` |
| AI Coach panel | `use-roadmap-progress.ts` | `roadmap/[id]` | `analytics_router.py`, `progress_router.py` | `roadmap_feedback` |
| Dashboard overview | `use-dashboard.ts` | `dashboard/` | `analytics_router.py` | (aggregates) |
| Analytics page | `use-analytics.ts`, `use-interview.ts` | `analytics/` | `analytics_router.py` | `problem_completions`, `topic_completions`, `user_streaks`, `interview_sessions` |
| Challenges | `use-challenges.ts` | `practice/challenges/**` | `challenge_router.py` | `challenges`, `problem_completions` |
| Leaderboard | `use-leaderboard.ts` | `practice/**` | `challenge_router.py` → `get_leaderboard()` RPC | `problem_completions`, `challenges`, `users` |
| Mock interviews | `use-interview.ts`, `use-live-interview.ts` | `practice/mock-interviews/**` | `interview_router.py` | `interview_sessions`, `problem_completions` |

---

## 8. Conventions worth knowing

- **Backward-compatible migrations only.** Every schema change in `api/schema.md` is additive and guarded with `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. Routers that depend on newer tables wrap reads in try/except and degrade to `null` so a partially-migrated DB doesn't 500.
- **Server-authoritative timers.** Challenge and interview rows store `started_at` + `duration_minutes`; the API returns a derived `expires_at_epoch` and the client counts down against that. List endpoints lazily flip stale `active` rows to `abandoned`.
- **Completion mirroring.** The legacy `progress.completed` JSON is still written (UI checkboxes read it), but every solve is *also* inserted into `problem_completions` / `topic_completions` so analytics, streaks, challenges and interviews share one source of truth. `scripts/backfill_completions.py` exists to migrate historical data.
- **No secrets in the browser.** The only Google credential the client ever holds is a short-lived, single-use Live token whose config is pinned server-side.

# AI Interviewer — Implementation Plan

> **Goal:** Replace the placeholder mock-interview page with a real, context-aware AI interviewer that conducts a 30–60 min session calibrated to the user's **goal, target company, roadmap progress, weak topics and recent solves**, then writes structured feedback back into the existing analytics/feedback loop.

---

## 1. Decision: Audio-first, video-optional

| Option | Cost | Latency | Realism | Verdict |
|---|---|---|---|---|
| **Text-only** | ~free | <1s | Low — no pressure | Phase-0 fallback |
| **Audio (voice-to-voice)** | Low–Med (Gemini Live: ~$0.06/min in, ~$0.24/min out → **≈$5–9 / 45-min session**) | ~500ms | High — closest to a phone screen | **✅ Primary** |
| **Video (avatar + lip-sync)** | High (HeyGen/D-ID: $0.10–0.30/min on top of audio) + infra | 2–4s | Marginal gain over audio | Defer to Phase 3 |

**Recommendation:** Ship **audio-first** using the **Gemini Live API** (`gemini-2.0-flash-live-001`), which we already have a key for (`GEMINI_API_KEY` in `api/config.py`). It supports native bidirectional audio streaming over WebSocket, function calling, and a system-instruction slot — everything we need without extra vendors. Keep the existing `<video>` element + `useShakeDetector` as a **passive self-view** (already built); the model never sees the camera feed in Phase 1.

---

## 2. What "context-aware" means concretely

On `POST /api/interviews/start` the backend assembles a **system prompt** from data we already compute elsewhere:

| Signal | Source | Used for |
|---|---|---|
| Goal / target company / role / deadline | `roadmaps.user_input` | Persona ("You're a Google L4 interviewer…"), problem style (LC-tagged vs system-design) |
| Overall % + pace status | `_compute_roadmap_progress()` (analytics_router) | Calibrate difficulty floor; mention pace in wrap-up |
| Weak topics (bottom 3) | `snap["weak_topics"]` | **At least one question must target a weak topic** |
| Strong topics (top 3) | `snap["strong_topics"]` | Warm-up question; positive reinforcement |
| Recently solved problem IDs | `problem_completions` (last 30d) | **Exclusion list** — never re-ask something the user just solved |
| Difficulty distribution | `summary.difficulty_distribution` | Decide Easy→Medium vs Medium→Hard ramp |
| Challenge avg accuracy | `/api/challenges/stats` | Time-pressure tolerance |
| Interview type (technical / behavioral / system-design) | User-selected on the setup page | Prompt template + rubric |

All of this is already returned by `GET /api/analytics/dashboard` (added in Pass 5) and `GET /api/challenges/stats` — the interview router just re-calls the underlying helpers.

---

## 3. Database (append to `api/schema.md`)

```sql
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id bigint REFERENCES public.roadmaps(id) ON DELETE SET NULL,
  interview_type text NOT NULL DEFAULT 'technical',     -- technical | behavioral | system_design
  difficulty text NOT NULL DEFAULT 'intermediate',
  duration_minutes int NOT NULL DEFAULT 45,
  status text NOT NULL DEFAULT 'active',                -- active | completed | abandoned
  context_snapshot jsonb NOT NULL,                      -- the exact prompt-context we fed the model (for replay/debug)
  problem_ids bigint[] DEFAULT '{}',                    -- LC ids actually asked (technical only)
  transcript jsonb DEFAULT '[]',                        -- [{role, text, at_ms}] — text turns only; audio stays client-side
  rubric_scores jsonb,                                  -- {problem_solving, communication, coding, ...} 1–5
  overall_score int,
  feedback jsonb,                                       -- {summary, strengths[], improvements[], focus_areas[]}
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT interview_sessions_status_check CHECK (status IN ('active','completed','abandoned'))
);
CREATE INDEX IF NOT EXISTS idx_is_user_created ON public.interview_sessions (user_id, created_at DESC);
```

No changes to existing tables. `problem_completions` already accepts `source text` — interview-sourced solves will use `source='interview'`.

---

## 4. Backend (`api/routers/interview_router.py`)

| Route | Purpose |
|---|---|
| `POST /api/interviews/start` | Body: `{roadmap_id?, interview_type, difficulty, duration_minutes}`. Builds `context_snapshot`, selects 2–3 candidate problems via `_select_problems()` (reuse from `challenge_router`, excluding recent solves), persists row, returns `{session_id, ephemeral_token, ws_url, context}`. The `ephemeral_token` is a short-lived Gemini Live session token minted server-side so the browser never sees `GEMINI_API_KEY`. |
| `WS /api/interviews/{id}/relay` *(fallback)* | If ephemeral tokens aren't available on the current Gemini tier, the FastAPI server proxies the Live API WebSocket: browser ↔ FastAPI ↔ Gemini. Uses `websockets` lib; ~50 LOC. |
| `POST /api/interviews/{id}/event` | Append a turn to `transcript` (`{role, text, at_ms}`). Called by the client whenever the Live API emits a final transcript chunk. Keeps the DB authoritative even if the socket drops. |
| `POST /api/interviews/{id}/complete` | Body: `{abandoned?: bool}`. Sends the full transcript + rubric template to `gemini-2.5-flash` (non-live, `response_mime_type="application/json"` — same pattern as `progress_router.py:359`) → `{rubric_scores, overall_score, feedback}`. Persists, mirrors any `problem_ids` the rubric marks ≥3/5 into `problem_completions` with `source='interview'`, refreshes streak. Returns the scored session. |
| `GET /api/interviews` / `GET /api/interviews/{id}` | History list + detail (read-only transcript replay). Reuses `_lazy_finalize_expired` pattern from challenges for stale-active sweep. |

**System-prompt skeleton** (assembled in `_build_interviewer_prompt(ctx)`):

```
You are a {ctx.difficulty} {ctx.company or "FAANG"} interviewer running a
{ctx.duration_minutes}-minute {ctx.interview_type} interview.

Candidate context (do NOT reveal verbatim):
- Goal: {ctx.goal}; deadline in {ctx.days_remaining} days; currently {ctx.pace_status}.
- Strong at: {strong_topics}. Weak at: {weak_topics}.
- Already solved recently (DO NOT ask): {excluded_problem_titles}.

Plan:
1. 1-min intro, ask the candidate to introduce themselves.
2. Warm-up from their strong topics ({warmup_problem.title}).
3. Main question targeting a weak topic ({main_problem.title}). Let them drive;
   give at most 2 graduated hints if stuck >3 min. Ask for time/space complexity.
4. One follow-up or behavioral question if time remains.
5. 2-min wrap-up: thank them, do NOT reveal scores.

Speak naturally, one thought at a time. Wait for the candidate to finish before
responding. If they go silent >10s, gently prompt. Call `end_interview` when done.
```

The Live API's **function-calling** is used for two tools the model can invoke mid-session:
- `give_hint(level: 1|2|3)` → returns a pre-written hint for the active problem (so hints are deterministic, not hallucinated).
- `end_interview(reason)` → signals the client to close the socket and call `/complete`.

---

## 5. Frontend (`client/src/`)

```
hooks/use-interview.ts                     # session controller (start, sendAudio, onTurn, complete)
app/(dashboard)/practice/mock-interviews/
  page.tsx                                 # (existing) setup form → calls start() → router.push([id])
  [id]/page.tsx                            # NEW — live session
  [id]/InterviewReport.tsx                 # post-complete rubric + feedback view
components/interview/
  audio-stream.tsx                         # mic capture (MediaRecorder → 16kHz PCM chunks) + playback queue
  transcript-panel.tsx                     # rolling transcript with role bubbles
  problem-panel.tsx                        # shows current problem statement (technical only) + scratchpad <Textarea>
```

**`[id]/page.tsx` layout** (desktop):

```
┌──────────────────────────────┬──────────────────────┐
│  Self-view <video>           │  Timer + status      │
│  (useShakeDetector — built)  │  ● REC  12:34 / 45:00│
│                              ├──────────────────────┤
│  ProblemPanel                │  TranscriptPanel     │
│  (statement + scratchpad)    │  (scrolling)         │
│                              │                      │
├──────────────────────────────┴──────────────────────┤
│  [🎙 Mute] [⏸ Pause] [🚩 End interview]              │
└──────────────────────────────────────────────────────┘
```

**Audio pipeline (browser):**
1. `navigator.mediaDevices.getUserMedia({audio: true})` → `MediaRecorder` @ 16kHz mono.
2. `ondataavailable` (every 200ms) → base64 → `ws.send({audio: ...})` to Gemini Live (or relay).
3. Incoming `serverContent.audio` chunks → push to a `SourceBuffer` / `AudioContext` playback queue.
4. Incoming `serverContent.text` (final) → append to local transcript + `POST /event`.
5. `toolCall: end_interview` → stop recorder, `POST /complete`, render `<InterviewReport>`.

Reuse: `useShakeDetector` (Pass 5 shared hook), timer pattern from `challenges/[id]/page.tsx`, `LeaderboardCard`-style report card.

---

## 6. Scoring rubric (technical)

| Dimension | 1–5 | Weight |
|---|---|---|
| Problem solving (approach, edge cases) | | 35% |
| Coding / pseudocode quality | | 25% |
| Communication (thinking aloud, clarifying Qs) | | 20% |
| Complexity analysis | | 10% |
| Hints needed (5 = none, 1 = ≥3) | | 10% |

`overall_score = round(Σ weight·score · 20)` → 0–100, stored on the row and surfaced on the dashboard alongside challenge points.

Behavioral / system-design get their own rubric templates (STAR completeness; requirements/scale/tradeoffs/diagram respectively).

---

## 7. Integration with existing surfaces

- **Dashboard** (`/dashboard`, Pass 5): add a 5th stat card "Last interview: 78/100" once `interview_sessions` has rows.
- **Analytics**: new tab "Interviews" charting `overall_score` over time.
- **Roadmap feedback**: `POST /progress/roadmap/{id}/feedback` already accepts arbitrary context — append the latest interview's `feedback.improvements[]` so the AI Coach references it.
- **Leaderboard**: optionally extend `get_leaderboard()` with `+ interview_score × 0.5` (separate migration; off by default).

---

## 8. Phased rollout

| Phase | Scope | Est. effort | Ship gate |
|---|---|---|---|
| **0 — Text MVP** | `/start`, `/complete`, `[id]/page.tsx` with **text chat only** (reuse `gemini-2.5-flash` non-streaming, same as `progress_router`). No audio. Validates prompt quality + rubric. | ~1.5 days | Rubric JSON parses 10/10 runs |
| **1 — Audio** | Swap transport to Gemini Live WebSocket, add `audio-stream.tsx`, ephemeral-token mint (or relay). Self-view video stays passive. | ~2–3 days | P95 turn latency < 1.2s |
| **2 — Polish** | History list, report page, dashboard/analytics integration, `source='interview'` completions, stale-active sweep. | ~1 day | — |
| **3 — Video (optional)** | Send 1 fps video frames to Live API (it supports image input) for "eye-contact / posture" feedback. Avatar rendering only if a free tier exists. | TBD | Only if user research justifies |

---

## 9. Risks & mitigations

- **Cost blow-up** → hard-cap `duration_minutes ≤ 60` server-side; auto-`/complete` on expiry (reuse `_lazy_finalize_expired` pattern). Track per-user monthly minutes in `interview_sessions` and 429 after a configurable quota.
- **Key leakage** → never ship `GEMINI_API_KEY` to the browser; ephemeral tokens or server relay only.
- **Hallucinated problems** → model never invents problems; it's handed concrete `problem_ids` from our dataset and the `ProblemPanel` renders the canonical statement from `dataset/leetcode-problems.csv`.
- **Audio permissions denied** → fall back to Phase-0 text chat in the same UI (mic button shows error state).
- **Transcript loss on disconnect** → every final turn is POSTed to `/event` immediately; `/complete` reads from DB, not client state.

---

## 10. Open questions for product

1. Should interview scores count toward the public leaderboard, or stay private?
2. Per-user quota: N free interviews/month, then paywall? (Affects Phase 1 cost model.)
3. Do we want company-specific question banks (e.g. "Google-tagged only"), or is topic-weak-area targeting enough for v1?

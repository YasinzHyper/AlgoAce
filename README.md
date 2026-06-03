# AlgoAce

> **Your AI-powered interview prep coach** — personalised DSA roadmaps, curated LeetCode problem sets, timed challenges, voice-based mock interviews, and a feedback loop that actually learns from how you're doing.

AlgoAce takes a user's goal (*"Google L4 in 8 weeks"*), current knowledge, and available time, then generates a week-by-week study roadmap, populates each week with company-tagged LeetCode problems, tracks every solve, and continuously coaches the user with AI-powered feedback that knows their pace, weak topics, and recent mock-interview scores.

---

## ✨ Features

### 📍 Personalised Roadmaps
- Tell AlgoAce your **goal, target company, deadline, weekly hours, and current knowledge** — it generates a multi-week plan of DSA topics (with difficulty ramps) plus supporting CS fundamentals.
- Each week is auto-populated with **curated LeetCode problems** filtered by topic, difficulty, and company tag from a built-in dataset of 1800+ problems.
- Roadmaps are rendered as an interactive **React-Flow graph** and an editable week-by-week board.

### 📈 Progress Tracking & Analytics
- Every problem/topic completion is timestamped and rolled up into:
  - **Activity heatmap** (GitHub-style contribution calendar)
  - **Streak tracking** (current + longest, computed via a Postgres function)
  - **Topic mastery** — which tags you're strong/weak at, derived from the LeetCode tag join
  - **Pace vs plan** — are you ahead, on track, or behind your deadline?
- A unified **Dashboard** surfaces headline stats, the closest deadline, last interview score, and challenge points at a glance.

### 🤖 AI Feedback Loop
- **Per-week coaching** — after marking problems complete, generate goal-aware feedback referencing the *named* problems you solved/skipped that week.
- **Roadmap-level "AI Coach"** — a cached, regeneratable summary covering what's working, what's at risk, and structured `focus_areas` (topic → reason → action). Folds in your latest mock-interview score so coaching stays coherent across surfaces.
- All feedback uses Gemini with `response_mime_type="application/json"` for deterministic, parseable output.

### ⚡ Timed Challenges
- Generate a **timed problem-set session** from your weak topics (or pick your own topics/difficulty/duration).
- Live countdown, mark-as-solved, auto-finalise on expiry, difficulty-weighted scoring with a time bonus.
- Full session history + a **points leaderboard** (week / month / all-time) backed by a Postgres `SECURITY DEFINER` RPC.

### 🎙️ AI Mock Interviewer (voice)
- Real-time **voice-to-voice** technical, behavioural, or system-design interviews powered by **Gemini Live**.
- The interviewer is **context-aware**: it knows your goal, target company, pace, strong/weak topics, and won't re-ask problems you recently solved.
- Browser never sees the API key — the backend mints **single-use ephemeral tokens** with the system prompt, voice, and tools locked server-side.
- After the call, the transcript is graded against a per-type **rubric** (problem-solving / coding / communication / complexity / hints) and a 0–100 score + structured feedback report is saved and charted in Analytics.

### 🧩 Problem Explanations & Help
- On-demand AI explanations for any problem in the dataset (approach, walkthrough, complexity).
- Global search across problems, roadmaps, and FAQs.

---

## 🏗️ Architecture

```
┌──────────────────────┐     Bearer JWT      ┌─────────────────────────┐
│  Next.js 15 client   │ ──────────────────▶│  FastAPI backend (api/) │
│  (App Router, React  │ ◀──────────────────│  routers/ · services/   │
│   19, shadcn/ui)     │       JSON          │  agents/ · tools.py     │
└─────────┬────────────┘                     └───────┬────────┬────────┘
          │                                          │        │
          │ Supabase Auth (SSR + browser)            │        │ google-genai
          ▼                                          ▼        ▼
┌──────────────────────┐                   ┌───────────────┐ ┌──────────────────┐
│ Supabase (Postgres + │ ◀───────────────▶│ LeetCode CSV  │ │ Gemini / Gemini  │
│ Auth + RPC)          │   supabase-py     │ dataset       │ │ Live (voice)     │
└──────────────────────┘                   └───────────────┘ └──────────────────┘
```

- **Auth** — Supabase Auth on both sides. The client attaches the session JWT as a `Bearer` token; every FastAPI router validates it via `supabase.auth.get_user()`.
- **Data** — All user state (roadmaps, tasks, progress, completions, streaks, challenges, interview sessions, feedback) lives in Supabase Postgres. See [`docs/DATABASE.md`](docs/DATABASE.md).
- **AI** — Gemini for roadmap generation, problem recommendation, explanations, feedback, and rubric grading; Gemini **Live** for the real-time voice interviewer. CrewAI tooling is wired for a future multi-agent orchestration layer.
- **Dataset** — `api/dataset/leetcode-problems.csv` (id, title, description, difficulty, tags, companies, acceptance rate…) is loaded into pandas at startup and used for problem selection, hydration, and topic-mastery joins.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/API.md`](docs/API.md)

---

## 📂 Repository Layout

```
AlgoAce/
├── api/                   # FastAPI backend — see api/README.md
│   ├── routers/           # HTTP route modules (roadmap, problems, progress,
│   │                      #   analytics, challenges, interviews, user)
│   ├── agents/            # CrewAI agents + Gemini tool wrappers
│   ├── services/          # Shared business logic (problem recommendation)
│   ├── models/            # Pydantic request/response schemas
│   ├── scripts/           # One-off maintenance (e.g. backfill_completions)
│   ├── dataset/           # leetcode-problems.csv
│   ├── schema.md          # Canonical SQL schema + every migration applied
│   └── main.py            # App entrypoint / router registration
│
├── client/                # Next.js 15 frontend — see client/README.md
│   └── src/
│       ├── app/           # App-Router pages (landing, auth, dashboard group)
│       ├── components/    # UI + feature components (roadmap, practice, problems…)
│       ├── hooks/         # Typed data hooks wrapping every backend endpoint
│       ├── contexts/      # Auth context
│       └── utils/supabase # SSR / browser / middleware Supabase clients
│
├── docs/                  # Deep-dive docs (architecture, API reference, DB)
├── plans/                 # Design/implementation plans (e.g. AI Interviewer)
└── README.md              # You are here
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+** (3.12 works)
- **Node.js 18+** (20 LTS recommended)
- A **Supabase** project (URL + anon key + service key)
- A **Google Gemini API key**

### 1. Backend

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # or create .env manually — see api/README.md for vars
uvicorn main:app --reload
```
API runs on `http://localhost:8000` (Swagger at `/docs`). Full instructions: [`api/README.md`](api/README.md).

### 2. Database

Apply the migrations in [`api/schema.md`](api/schema.md) to your Supabase project (via the SQL editor or CLI). They are idempotent and ordered. See [`docs/DATABASE.md`](docs/DATABASE.md) for a table-by-table explanation.

### 3. Frontend

```bash
cd client
npm install
# create client/.env.local — see client/README.md
npm run dev
```
App runs on `http://localhost:3000`. Full instructions: [`client/README.md`](client/README.md).

> The client resolves the API base URL from the `NEXT_PUBLIC_API_URL` environment variable (falls back to `http://localhost:8000` for local dev). Run both services locally on the default ports or set the variable to point at a deployed backend.

---

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Radix Primitives, Recharts, React-Flow (`@xyflow/react`), `react-activity-calendar`, Sonner |
| **Backend** | FastAPI, Pydantic v2, Uvicorn, pandas |
| **AI** | Google Gemini (`google-genai`), Gemini Live (real-time voice), CrewAI / crewai-tools |
| **Data / Auth** | Supabase (Postgres, Auth, RPC), `@supabase/ssr` on the client, `supabase-py` on the server |
| **Infra** | ChromaDB (local vector store for CrewAI tooling) |

---

## 🗺️ Roadmap / Future Plans

- **Multi-agent orchestration** — promote the CrewAI scaffolding into a true crew (roadmap agent · recommender agent · feedback agent · explainer agent) with shared memory.
- **Mock-interview text fallback** — degrade to text chat in the same UI when the mic is denied.
- **Per-user interview quota & cost guards** — cap monthly Live minutes server-side.
- **Server WS relay** — fallback transport if Gemini ephemeral tokens move out of `v1alpha`.
- **Social & gamification** — friend lists, team challenges, badges, daily shared challenge with its own leaderboard tab, head-to-head mode.
- **Leaderboard weighting** — optionally fold interview scores into the points formula.

See [`plans/`](plans/) for detailed implementation specs of in-flight features.

---

## 📖 Documentation

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Request lifecycle, auth flow, how AI calls are wired, data flow diagrams |
| [`docs/API.md`](docs/API.md) | Every REST endpoint grouped by router, with purpose + payload shape |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Table-by-table schema reference, RPCs, and migration history |
| [`api/README.md`](api/README.md) | Backend setup, env vars, project structure |
| [`client/README.md`](client/README.md) | Frontend setup, route map, hooks reference |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch — `git checkout -b feature/amazing-feature`
3. Keep changes scoped; add/adjust the relevant doc in `docs/` if you change behaviour
4. Commit — `git commit -m 'Add amazing feature'`
5. Push — `git push origin feature/amazing-feature`
6. Open a Pull Request

New to the codebase? Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), then trace one feature end-to-end (e.g. **Challenges**: `client/src/hooks/use-challenges.ts` → `api/routers/challenge_router.py` → `public.challenges` in `api/schema.md`).

---

## 📄 License

MIT — see the LICENSE file for details.

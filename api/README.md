# AlgoAce API

FastAPI backend for AlgoAce. Exposes REST endpoints for roadmap generation, problem recommendation, progress tracking, analytics, timed challenges, and the voice-based AI mock interviewer. All persistence goes through Supabase; all AI calls go through Google Gemini.

> See [`../docs/API.md`](../docs/API.md) for the full endpoint reference and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for how the pieces fit together.

## Setup

1. Navigate to the `/api` directory:
```bash
cd api
```

2. Create a virtual environment:
```bash
python3 -m venv .venv
```

3. Activate the virtual environment:
- **Linux / WSL / macOS:**
```bash
source .venv/bin/activate
```
- **Windows (CMD):**
```bash
.venv\Scripts\activate
```
- **Windows (PowerShell):**
```bash
.venv\Scripts\Activate.ps1
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create a `.env` file in the `api/` directory:

```bash
# --- required ---
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service-role-or-anon-key>
GEMINI_API_KEY=<your_gemini_api_key>
GOOGLE_API_KEY=<your_gemini_api_key>      # CrewAI's LLM wrapper reads this name
MODEL=gemini-2.5-flash                    # default text model for tools/feedback

# --- optional (AI mock interviewer) ---
# Override the Gemini Live voice models used by /api/interviews/*/token
INTERVIEW_LIVE_MODEL_NATIVE=gemini-2.5-flash-native-audio-preview-12-2025
INTERVIEW_LIVE_MODEL_FAST=gemini-3.1-flash-live-preview
INTERVIEW_LIVE_MODEL_DEFAULT=native       # native | fast
INTERVIEW_VOICE_NAME=Orus
```

6. Run the development server:
```bash
uvicorn main:app --reload
# or: python start_server.py  (validates env vars first)
```

The API will be available at `http://localhost:8000`

---

## Note: Prerequisites for Linux / WSL

If you are on Ubuntu/Debian (including WSL), ensure the following are installed before proceeding:

```bash
# Install Python 3 and required tooling
sudo apt update
sudo apt install -y python3 python3-pip python3.12-venv
```

> **Note:** The `python3-venv` package (or `python3.12-venv` for Python 3.12) is required to create virtual environments on Ubuntu/Debian. Without it, `python3 -m venv` will fail.

---

## API Documentation

Once the server is running, you can access:
- Interactive API docs (Swagger UI): `http://localhost:8000/docs`
- Alternative API docs (ReDoc): `http://localhost:8000/redoc`
- Hand-written reference with payload shapes: [`../docs/API.md`](../docs/API.md)

## Project Structure

```
api/
├── main.py                  # FastAPI app, CORS, router registration
├── config.py                # Loads + validates env vars
├── start_server.py          # Convenience launcher (env check → uvicorn)
├── supabase_client.py       # Shared Supabase client instance
├── tools.py                 # Gemini-backed BaseTool impls
│                            #   (RoadmapTool, ProblemRecommendationTool, …)
│
├── routers/                 # One module per URL prefix (all mounted in main.py)
│   ├── roadmap_router.py    #   /api/roadmap     — list/get/generate/delete
│   ├── problem_router.py    #   /api/problems    — recommend, per-week CRUD,
│   │                        #                      AI explanations
│   ├── progress_router.py   #   /api/progress    — mark complete, week +
│   │                        #                      roadmap-level AI feedback
│   ├── analytics_router.py  #   /api/analytics   — summary, dashboard,
│   │                        #                      per-roadmap pace/topic stats
│   ├── challenge_router.py  #   /api/challenges  — generate/solve/complete,
│   │                        #                      stats, recommended, leaderboard
│   ├── interview_router.py  #   /api/interviews  — start, mint Live token,
│   │                        #                      transcript events, grade
│   └── user_router.py       #   /api/user        — profile read/update
│
├── agents/                  # CrewAI agent layer (multi-agent orchestration)
│   ├── base.py              #   Base agent config
│   ├── specialized.py       #   RoadmapAgent, ProblemRecommenderAgent, …
│   └── crew.py              #   DSACrew wiring (currently scaffolding —
│                            #   routers call the tools directly today)
│
├── services/
│   └── problem_service.py   # generate_and_save_recommendations():
│                            #   runs the recommender tool, writes tasks +
│                            #   bootstraps progress rows for a new roadmap
│
├── models/
│   └── schema.py            # Pydantic request models (UserInput, RoadmapData…)
│
├── scripts/
│   └── backfill_completions.py  # One-off: mirror legacy progress.completed
│                                #   JSON into problem_/topic_completions
│                                #   Run: python -m scripts.backfill_completions
│
├── dataset/
│   └── leetcode-problems.csv    # ~1800 problems: id, title, description,
│                                #   difficulty, related_topics, companies, …
│                                #   Loaded into pandas at import time by the
│                                #   problem/analytics/challenge/interview routers
│
├── db/                      # Local ChromaDB store (CrewAI CSVSearchTool)
├── schema.md                # Canonical SQL schema + every migration applied
└── requirements.txt
```

## How a request works

1. The Next.js client attaches the user's Supabase session JWT as `Authorization: Bearer <token>`.
2. Every router defines a `get_current_user` dependency that calls `supabase.auth.get_user(token)`; an invalid/absent token → `401`.
3. Handlers read/write Supabase tables directly via `supabase.table(...)`, hydrate problem metadata from the in-memory pandas DataFrame, and call Gemini through `google-genai` (text) or mint ephemeral Gemini Live tokens (voice).
4. Anything that records a solve also calls the `refresh_user_streak(user_id)` Postgres function so streak stats stay consistent.

## Database

The source of truth for the Postgres schema is [`schema.md`](schema.md) — it contains the base tables **and** every additive migration (roadmap_feedback, challenges, leaderboard RPC, interview_sessions, …) in the order they should be applied to a fresh Supabase project. See [`../docs/DATABASE.md`](../docs/DATABASE.md) for a narrated table-by-table reference.

## Development notes

- FastAPI + Pydantic v2 for the web layer.
- `pandas` is a hard dependency — several routers load `dataset/leetcode-problems.csv` at import time and will fail to start without it.
- Gemini calls that need structured output use `response_mime_type="application/json"` so responses can be parsed deterministically.
- CrewAI is wired but currently dormant: routers invoke `RoadmapTool` / `ProblemRecommendationTool` directly. The `DSACrew` orchestrator in `agents/crew.py` is scaffolding for the planned multi-agent upgrade.
- CORS is locked to `http://localhost:3000` in `main.py`; widen it for deployed environments.

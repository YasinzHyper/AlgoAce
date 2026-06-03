# AlgoAce Client

Next.js 15 (App Router) + React 19 frontend for AlgoAce. Handles auth via Supabase SSR, talks to the FastAPI backend over REST, and renders the dashboard, roadmap graph, problem boards, analytics, timed challenge sessions, and the live voice mock-interview room.

## Prerequisites

- Node.js 18 or higher
- npm or yarn

- For Linux / WSL:

If you are on Ubuntu/Debian (including WSL), install Node.js using the NodeSource repository (the default apt version may be too old):

```bash
# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify the installation:
```bash
node --version   # should be v20.x or higher
npm --version
```

> If you already have Node 18+ installed, you can skip the above and proceed directly to Setup.

---

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `client/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # used for auth email redirects
NEXT_PUBLIC_API_URL=http://localhost:8000    # omit to use the default; set to your deployed backend URL in production
```

3. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

---

## Project Structure

```
client/src/
├── app/
│   ├── page.tsx                       # Landing page
│   ├── login/ · signup/ · auth/       # Supabase auth (server actions + callbacks)
│   ├── profile/ · settings/           # Account management
│   ├── footer/                        # Static legal/contact pages
│   └── (dashboard)/                   # Auth-gated route group (shared sidebar layout)
│       ├── dashboard/                 #   Headline stats overview
│       ├── roadmap/                   #   List + create
│       │   └── [id]/                  #   React-Flow graph + AI Coach panel
│       ├── problems/                  #   Week-by-week problem board
│       │   └── [id]/                  #   Single problem detail + AI explanation
│       ├── analytics/                 #   Heatmap, topic mastery, interview score chart
│       └── practice/                  #   Practice hub (modes, stats, leaderboard)
│           ├── challenges/            #   Builder + history
│           │   └── [id]/              #   Live timed session / results view
│           └── mock-interviews/       #   Setup + history
│               └── [id]/              #   Live voice room / rubric report
│
├── components/
│   ├── ui/                            # shadcn/ui primitives (button, card, dialog…)
│   ├── magicui/                       # Animated marketing components
│   ├── layout/ · sidebar/             # App shell + navigation
│   ├── roadmap/                       # roadmap-card, roadmap-editor,
│   │                                  #   roadmap-progress-panel (AI Coach)
│   ├── problems/                      # ProblemCard, RoadmapSelector, WeekPagination,
│   │                                  #   help-modal (AI explanation)
│   └── practice/                      # leaderboard-card
│
├── hooks/                             # Typed data layer — every backend call lives here
│   ├── use-dashboard.ts               #   GET /api/analytics/dashboard
│   ├── use-analytics.ts               #   GET /api/analytics/summary
│   ├── use-roadmap-progress.ts        #   Per-roadmap snapshot + AI Coach generate
│   ├── use-challenges.ts              #   List/generate/stats + per-session controller
│   ├── use-leaderboard.ts             #   GET /api/challenges/leaderboard/
│   ├── use-interview.ts               #   Session CRUD, stats, token mint, complete
│   ├── use-live-interview.ts          #   Gemini Live voice pipeline (mic ↔ WS ↔ playback)
│   ├── use-shake-detector.ts          #   Webcam motion → "stay focused" nudge
│   └── use-mobile.ts                  #   Viewport helper
│
├── contexts/auth-context.tsx          # Client-side auth/session provider
├── utils/supabase/                    # client.ts · server.ts · middleware.ts
└── middleware.ts                      # Route protection / session refresh
```

## How data flows

1. `utils/supabase/{client,server,middleware}.ts` create the appropriate Supabase client for browser / RSC / middleware contexts. `middleware.ts` refreshes the session cookie and redirects unauthenticated users away from `(dashboard)` routes.
2. Pages don't `fetch` directly — they call a hook from `src/hooks/`. Each hook:
   - reads the Supabase session, attaches `Authorization: Bearer <access_token>`,
   - calls `${NEXT_PUBLIC_API_URL}/api/...` (defaults to `http://localhost:8000`),
   - exposes `{ data, loading, error, refresh, …actions }` with optimistic updates where it makes sense (e.g. marking a challenge problem solved).
3. The **voice interview** is the one place the browser talks to Google directly: `use-interview.ts` asks the backend for a single-use ephemeral Gemini Live token, then `use-live-interview.ts` opens the WebSocket via `@google/genai`, streams 16 kHz PCM mic audio up, plays 24 kHz PCM responses back, and POSTs every finalised transcript turn to `/api/interviews/{id}/event` so the DB stays authoritative across reconnects.

## Key UX patterns

- **Deep-linkable state** — `/problems` honours `?roadmap=&week=` and persists the last-viewed roadmap/week to `localStorage`, so the AI Coach panel can link straight to "Week 3 of Roadmap X".
- **Server-authoritative timers** — challenge and interview countdowns are driven by `expires_at_epoch` from the API, so they survive refresh/tab-switch and auto-finalise exactly once.
- **Regenerate cooldowns** — AI Coach feedback enforces a 5-minute client-side cooldown rendered as a live `m:ss` countdown on the button.
- **Strict-mode safe resource hooks** — `use-live-interview.ts` separates resource teardown from state changes so React 18/19 dev double-mount doesn't leave the mic/WS in a broken state.

## Available Scripts

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui + Radix · `@xyflow/react` · Recharts · `react-activity-calendar` · `@google/genai` · `@supabase/ssr` · Sonner · Zod + react-hook-form.

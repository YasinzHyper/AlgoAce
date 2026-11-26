# Contributing to AlgoAce

How to run AlgoAce locally, the checks a change has to pass, and the conventions the code follows. For how the pieces fit together, start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Running it locally

The API and the client run separately: the API on `http://localhost:8000`, the client on `http://localhost:3000`. CI uses Python 3.13 and Node 24.

**API**, from `api/` (activating the virtual environment is described in [`api/README.md`](api/README.md)):

```bash
python -m venv .venv
pip install -r requirements.txt -r requirements-dev.txt
uvicorn main:app --reload
```

It reads its settings from `api/.env`; [`api/README.md`](api/README.md) lists them. The app does not even import unless `SUPABASE_URL`, `SUPABASE_KEY` and `GEMINI_API_KEY` are all set. `ALLOWED_ORIGINS` (comma-separated) sets the origins CORS allows and defaults to `http://localhost:3000`.

**Client**, from `client/`:

```bash
npm ci
npm run dev
```

It reads `client/.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`) and `NEXT_PUBLIC_SITE_URL` (used for auth email redirects). See [`client/README.md`](client/README.md).

## Checks

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs these on every pull request and every push to `master`. Run the ones for the part you changed before you push.

| From | Command | Checks |
|---|---|---|
| `client/` | `npx tsc --noEmit` | types |
| `client/` | `npm run lint` | ESLint (`next lint`) |
| `client/` | `npm run build` | the production build |
| `api/` | `python -c "import main"` | the app imports, with every router |
| `api/` | `python -m pytest -q` | the tests |

- CI runs the client checks with placeholder values for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `import main` with placeholder API settings. Neither talks to Supabase or Gemini, so placeholders work locally too.
- `npm run lint` must not report a warning that `master` does not already report (#33 tracks the existing ones).
- The tests need no settings and no network: they set placeholders themselves and replace the Supabase and Gemini clients with in-memory fakes. Run them from `api/`, because the routers load the dataset from a path relative to the working directory. [`api/README.md`](api/README.md#running-the-tests) describes the fixtures.

## Backend conventions (`api/`)

- **One router per area.** Each module in `api/routers/` serves one area and is mounted in `api/main.py`, under `/api/<area>` for all but the health routes (`app.include_router(..., prefix="/api/<area>")`). A new endpoint goes in the router for its area; a new area gets its own router.
- **Routes require a signed-in caller.** A route takes `user=Depends(get_current_user)`: the dependency checks the `Authorization: Bearer <token>` header with Supabase Auth and answers 401 when it is missing or invalid. Routers define their own copy of `get_current_user` for now; #30 tracks a single shared one.
- **An ownership filter on every query.** Every `select`, `update` and `delete` on a table that holds users' rows carries `.eq("user_id", user_id)`, with the id from `get_current_user`; every `insert` sets `user_id` from it, never from the request body. A route that looks a row up by id filters by the user as well and answers 404 when nothing comes back. The API reaches the database with a key that row-level security does not restrict, so these filters are what keep users' data apart.
- **`HTTPException` passes through.** A handler that catches exceptions re-raises `HTTPException` before its generic `except`, so a 401, 404 or 422 does not become a 500:

  ```python
  try:
      ...
  except HTTPException:
      raise
  except Exception as e:
      raise HTTPException(status_code=500, detail=...) from e
  ```

- **Request bodies are pydantic models**, with bounds on what they accept (`Field(ge=1, le=52)`, `max_length=...`). They are defined in the router that uses them, or in `api/models/schema.py` when several routers share them.
- **Where shared code goes.** `api/supabase_client.py` holds the one Supabase client: import it, do not create another. Gemini-backed tools are in `api/tools.py` (#31 tracks moving every Gemini call into one module). Logic that more than one router needs goes in `api/services/`, rather than being imported from another router.
- **Tests come with the change.** Backend changes add pytest tests in `api/tests/` that execute the changed lines, using the fixtures from `api/tests/conftest.py` (`client`, `supabase_fake`, `gemini_fake`, `auth_header`). For a route that reads or writes a user's rows, test that another user's rows are neither returned nor changed.

## Frontend conventions (`client/`)

- **Data goes through hooks.** Backend calls live in `client/src/hooks/`, one file per area (`use-challenges.ts`, `use-dashboard.ts`, ...). A hook returns `{ data, loading, error, refresh, ...actions }`, and pages and components call hooks rather than `fetch`. Some older pages still call `fetch` themselves; new code does not.
- **One API helper.** Hooks build URLs from `API_BASE` in `client/src/utils/api.ts` (`NEXT_PUBLIC_API_URL`, or `http://localhost:8000`) and send the Supabase session's access token as `Authorization: Bearer <token>`. `authedFetch` in `use-challenges.ts` shows the pattern. `client/src/lib/api.ts` is an unused duplicate (#32).
- **Components.** Build on the shadcn/ui components in `client/src/components/ui` and the layout in `client/src/components/layout` and `client/src/components/sidebar`. No new UI library.
- **Loading, empty and error states.** Every view that loads data shows all three, and works at phone width.
- **Auth.** `client/src/middleware.ts` sends signed-out visitors to `/login` from every page except `/login`, `/signup` and `/auth/callback`. The browser uses Supabase for sign-in and the session only. It never queries a table: all data goes through the API.

## Schema changes

The schema is recorded in [`api/schema.md`](api/schema.md): the base tables, then the later changes in the order they were applied, each under a comment header (`-- Migration: ...` in the recent ones). [`docs/DATABASE.md`](docs/DATABASE.md) describes the tables.

- Changes only add: new tables, columns, indexes and functions, safe to run twice (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). A new column is nullable or has a default. Dropping, renaming or changing something that exists needs the owner's decision: open an issue first.
- A new table enables row-level security (`ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;`). Every table in production has it on, which `api/schema.md` does not show yet.
- Code that reads a newer table or column catches a failed read and degrades (to `null` or an empty list) instead of answering 500, so the API still works against a database the change has not reached yet.
- In the pull request, add the SQL at the end of `api/schema.md` under a `-- Migration: ...` header, update `docs/DATABASE.md`, and say that the change needs the SQL applied. Applying it to the production database is a separate step from merging.
- Issue #16 moves this to migration files under `supabase/migrations/`; this section changes with it.

## Branches, commits and pull requests

- Branch from `master`, the default branch (`main` is stale). Name the branch after the kind of change and a short slug: `feat/...` (older branches use `feature/...`), `fix/...`, `chore/...` or `docs/...`, for example `chore/ci-workflow` or `docs/agpl-license-readme-intro`. A branch named `test/...` cannot be pushed while the repository has a branch called `test`.
- Commit subjects are imperative and in sentence case, under about 70 characters, with no full stop: "Add health routes to the API", "Fix login issues". A body, when there is one, says why.
- One change per pull request. Leave out unrelated refactors, renames and reformatting. The repository has no formatter configuration, so match the style of the file you are in.
- Title the pull request like a commit subject. The description says what changed and why, how it was verified (the commands you ran and their results, and what you could not check) and what could go wrong, and links the issue with `Fixes #<n>`.
- Pull requests are squash-merged, so the title becomes the commit subject on `master`, with the pull request number added: "Add health routes to the API (#52)".
- Every commit on `master` is deployed: the client by Vercel, the API by Railway. Keep `master` deployable, and update the matching doc in `docs/` when you change behaviour.

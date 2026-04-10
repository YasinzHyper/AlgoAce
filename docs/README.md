# AlgoAce Documentation

| Doc | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Topology, auth flow, client data layer, router layer, AI integration, the voice-interview pipeline, feature-trace cheat-sheet, project conventions. **Start here.** |
| [API.md](API.md) | Every REST endpoint grouped by router, with purpose and behaviour notes. (Swagger at `http://localhost:8000/docs` is authoritative for exact shapes.) |
| [DATABASE.md](DATABASE.md) | Narrated table-by-table schema reference, RPCs, and how to bootstrap/backfill a fresh Supabase project. |
| [`../plans/`](../plans/) | Design specs for in-flight features (e.g. the AI Interviewer). |
| [`../api/schema.md`](../api/schema.md) | Executable SQL — base schema + every migration, in apply-order. |

For setup instructions see the [root README](../README.md), [`../api/README.md`](../api/README.md) and [`../client/README.md`](../client/README.md).

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase_client import supabase
from google import genai
from google.genai import types
from config import GEMINI_API_KEY, MODEL
from datetime import datetime, timedelta, timezone
from typing import Optional
import json
import os
import pandas as pd

router = APIRouter()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# Non-live model for rubric scoring / feedback JSON generation.
_SCORING_MODEL = MODEL or "gemini-2.5-flash"

# Live audio models. Both are free-tier preview models; the native-audio one
# produces higher-quality speech, the flash-live one has lower latency. The
# default can be overridden via env and per-request via `voice_model`.
INTERVIEW_LIVE_MODELS = {
    "native": os.getenv(
        "INTERVIEW_LIVE_MODEL_NATIVE", "gemini-2.5-flash-native-audio-preview-12-2025"
    ),
    "fast": os.getenv("INTERVIEW_LIVE_MODEL_FAST", "gemini-3.1-flash-live-preview"),
}
DEFAULT_VOICE_MODEL = os.getenv("INTERVIEW_LIVE_MODEL_DEFAULT", "native")
INTERVIEWER_VOICE = os.getenv("INTERVIEW_VOICE_NAME", "Orus")

# Server-side hard limits.
MAX_DURATION_MINUTES = 60
# Ephemeral tokens are single-use and short-lived; the browser requests a
# fresh one on (re)connect so this only needs to cover connection setup.
TOKEN_TTL_MINUTES = 30
TOKEN_NEW_SESSION_WINDOW_MINUTES = 2

# Rubric weights → 0-100 overall score. Each dimension is scored 1-5.
RUBRICS = {
    "technical": {
        "problem_solving": 0.35,
        "coding": 0.25,
        "communication": 0.20,
        "complexity_analysis": 0.10,
        "independence": 0.10,  # 5 = no hints needed
    },
    "behavioral": {
        "structure": 0.30,  # STAR completeness
        "relevance": 0.25,
        "communication": 0.25,
        "reflection": 0.20,
    },
    "system_design": {
        "requirements": 0.25,
        "architecture": 0.30,
        "tradeoffs": 0.25,
        "communication": 0.20,
    },
}

# ---------------------------------------------------------------------------
# Gemini clients
# ---------------------------------------------------------------------------
# v1alpha is required for ephemeral-token minting and the constrained Live
# endpoint. Keep a separate client for non-live scoring (default version).
_live_client = genai.Client(
    api_key=GEMINI_API_KEY, http_options=types.HttpOptions(api_version="v1alpha")
)
_scoring_client = genai.Client(api_key=GEMINI_API_KEY)

# ---------------------------------------------------------------------------
# Dataset (problem metadata for prompt-building and the problem panel)
# ---------------------------------------------------------------------------
try:
    _iv_problems_df = pd.read_csv(
        "dataset/leetcode-problems.csv",
        usecols=["id", "title", "description", "difficulty", "related_topics", "companies"],
    ).set_index("id", drop=False)
except Exception as e:
    print(f"[interviews] Error loading dataset: {str(e)}")
    _iv_problems_df = pd.DataFrame()


async def get_current_user(authorization: str = Header(...)):
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        token = authorization[len("Bearer "):]
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _problem_detail(problem_id: int, *, include_description: bool = False) -> Optional[dict]:
    if _iv_problems_df.empty or problem_id not in _iv_problems_df.index:
        return None
    row = _iv_problems_df.loc[problem_id]
    topics_raw = row.get("related_topics")
    out = {
        "id": int(row["id"]),
        "title": str(row.get("title") or f"Problem #{problem_id}"),
        "difficulty": str(row.get("difficulty") or "Unknown"),
        "related_topics": (
            [t.strip() for t in str(topics_raw).split(",") if t.strip()]
            if pd.notna(topics_raw)
            else []
        ),
    }
    if include_description:
        desc = row.get("description")
        out["description"] = str(desc) if pd.notna(desc) else ""
    return out


def _truncate(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def _difficulty_label(level: str) -> str:
    return {"beginner": "Easy", "intermediate": "Medium", "advanced": "Hard"}.get(
        (level or "intermediate").lower(), "Medium"
    )


def _resolve_roadmap(user_id: str, roadmap_id: Optional[int]) -> Optional[dict]:
    """Fetch the requested roadmap, or fall back to the user's most recent."""
    if roadmap_id is not None:
        resp = (
            supabase.table("roadmaps")
            .select("*")
            .eq("id", roadmap_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")
        return resp.data[0]
    resp = (
        supabase.table("roadmaps")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def _build_context_snapshot(
    *, user_id: str, roadmap: Optional[dict], interview_type: str, difficulty: str
) -> dict:
    """
    Assemble everything the interviewer needs to be context-aware. Reuses
    `_compute_roadmap_progress` so the exact numbers match the dashboard.
    """
    from routers.analytics_router import _compute_roadmap_progress
    from routers.challenge_router import _select_problems

    now = datetime.now(timezone.utc)
    ctx: dict = {
        "interview_type": interview_type,
        "difficulty": difficulty,
        "difficulty_label": _difficulty_label(difficulty),
        "goal": None,
        "company": None,
        "roadmap_id": None,
        "overall_percentage": 0,
        "pace_status": "no_data",
        "days_remaining": None,
        "strong_topics": [],
        "weak_topics": [],
        "recently_solved": [],
        "problems": [],  # [{id,title,difficulty,related_topics,role}] for technical
    }

    # Recent solves → exclusion list (also surfaced to the interviewer so it
    # can reference "I see you recently worked on X" without re-asking it).
    try:
        pc_resp = (
            supabase.table("problem_completions")
            .select("problem_id")
            .eq("user_id", user_id)
            .order("completed_at", desc=True)
            .limit(200)
            .execute()
        )
        solved_ids = [int(r["problem_id"]) for r in (pc_resp.data or [])]
    except Exception:
        solved_ids = []
    exclude_ids = set(solved_ids)
    recent_titles: list[str] = []
    for pid in solved_ids[:8]:
        meta = _problem_detail(pid)
        if meta:
            recent_titles.append(meta["title"])
    ctx["recently_solved"] = recent_titles

    if roadmap:
        ctx["roadmap_id"] = roadmap["id"]
        tasks_resp = supabase.table("tasks").select("*").eq("roadmap_id", roadmap["id"]).execute()
        progress_resp = (
            supabase.table("progress")
            .select("*")
            .eq("roadmap_id", roadmap["id"])
            .eq("user_id", user_id)
            .execute()
        )
        snap = _compute_roadmap_progress(
            roadmap, tasks_resp.data or [], progress_resp.data or [], now
        )
        ctx["goal"] = snap.get("goal")
        ctx["company"] = snap.get("company")
        ctx["overall_percentage"] = snap["overall"]["percentage"]
        ctx["pace_status"] = snap["pace"]["status"]
        ctx["days_remaining"] = snap["pace"].get("days_remaining")
        ctx["strong_topics"] = [t["name"] for t in snap["strong_topics"][:3]]
        ctx["weak_topics"] = [t["name"] for t in snap["weak_topics"][:3]]

    # For technical interviews, pick 2 concrete problems: one warm-up from a
    # strong topic (or easy random) and one main from a weak topic at the
    # requested difficulty. The interviewer is handed the canonical statements
    # so it never hallucinates a problem.
    if interview_type == "technical":
        warmup_topics = ctx["strong_topics"] or []
        main_topics = ctx["weak_topics"] or ctx["strong_topics"] or []
        warmup_ids = _select_problems(
            focus_topics=warmup_topics, difficulty="easy", count=1, exclude_ids=exclude_ids
        )
        exclude_ids.update(warmup_ids)
        main_ids = _select_problems(
            focus_topics=main_topics,
            difficulty=ctx["difficulty_label"].lower(),
            count=1,
            exclude_ids=exclude_ids,
        )
        for role, pid in [("warmup", wid) for wid in warmup_ids] + [
            ("main", mid) for mid in main_ids
        ]:
            meta = _problem_detail(pid, include_description=True)
            if meta:
                ctx["problems"].append({**meta, "role": role})

    return ctx


def _build_system_instruction(ctx: dict, duration_minutes: int) -> str:
    itype = ctx["interview_type"]
    company = ctx.get("company") or "a top-tier tech company"
    goal = ctx.get("goal") or "a software engineering role"
    strong = ", ".join(ctx["strong_topics"]) or "general fundamentals"
    weak = ", ".join(ctx["weak_topics"]) or "none identified yet"
    recent = ", ".join(ctx["recently_solved"][:5]) or "none"
    pace = (ctx.get("pace_status") or "no_data").replace("_", " ")
    days = ctx.get("days_remaining")
    deadline_line = (
        f"Their target deadline is in {days} days and they are currently {pace}."
        if days is not None
        else f"They are currently {pace} on their study plan."
    )

    base = f"""
You are an experienced, friendly but rigorous {company} interviewer conducting a live
{duration_minutes}-minute {itype.replace('_', ' ')} interview over voice. You are speaking
out loud — keep each turn to 1–3 short sentences, natural and conversational. Never read
long blocks of text aloud. Wait for the candidate to finish before responding.

Private candidate context (use it to calibrate, NEVER read it back verbatim):
- Preparing for: {goal} at {company}.
- Roadmap progress: {ctx.get('overall_percentage', 0)}% complete. {deadline_line}
- Strong topics: {strong}.
- Weak topics (probe these): {weak}.
- Recently solved (do NOT re-ask): {recent}.
- Requested level: {ctx['difficulty']}.
""".strip()

    if itype == "technical":
        problems = ctx.get("problems") or []
        warmup = next((p for p in problems if p.get("role") == "warmup"), None)
        main = next((p for p in problems if p.get("role") == "main"), None)
        plan_lines = [
            "Plan for this session:",
            "1. 30–60s: greet, ask the candidate to briefly introduce themselves.",
        ]
        step = 2
        if warmup:
            plan_lines.append(
                f'{step}. Warm-up ({warmup["difficulty"]}) — "{warmup["title"]}". '
                f'Topics: {", ".join(warmup["related_topics"][:3]) or "general"}. '
                "Keep this brisk (~5 min); move on once they outline a working approach."
            )
            step += 1
        if main:
            plan_lines.append(
                f'{step}. Main question ({main["difficulty"]}) — "{main["title"]}". '
                f'Topics: {", ".join(main["related_topics"][:3]) or "general"}. '
                "Let them drive. If stuck >2 min, offer a small nudge; max 2 graduated hints. "
                "Always ask for time AND space complexity before moving on."
            )
            step += 1
        plan_lines.append(
            f"{step}. If time remains: one short follow-up targeting a weak topic, or a quick "
            "behavioral question about a project they're proud of."
        )
        plan_lines.append(
            f"{step + 1}. Final 1–2 min: thank them, do NOT reveal scores, then call "
            "`end_interview` with reason='completed'."
        )
        body = "\n".join(plan_lines)

        problem_specs = ""
        for p in problems:
            problem_specs += (
                f'\n\n[{p["role"].upper()} PROBLEM — id {p["id"]}] "{p["title"]}" '
                f'({p["difficulty"]}):\n{_truncate(p.get("description", ""), 1200)}'
            )
        rules = (
            "\n\nRules: present the problem verbally in your own concise words (the candidate "
            "can also read the statement on their screen). Encourage thinking aloud. "
            "Never solve it for them. Never invent a different problem."
        )
        return f"{base}\n\n{body}{problem_specs}{rules}"

    if itype == "system_design":
        return (
            f"{base}\n\n"
            "Plan: 1) Brief intro. 2) Pose ONE system-design prompt appropriate for "
            f"{company} and the candidate's level (e.g. 'design a URL shortener' for "
            "intermediate, a feed/notification system for advanced). 3) Guide them through "
            "requirements → high-level architecture → data model → scaling & tradeoffs. "
            "Probe on the areas they gloss over. 4) Wrap up and call `end_interview`.\n"
            "Keep each spoken turn short; draw detail out with follow-up questions rather "
            "than lecturing."
        )

    # behavioral
    return (
        f"{base}\n\n"
        "Plan: 1) Brief intro. 2) Ask 3–4 behavioral questions tailored to their goal "
        "(leadership, conflict, failure, impact). After each answer, probe for STAR "
        "structure: Situation, Task, Action, Result. If an answer is vague, ask for a "
        "specific example with a measurable outcome. 3) Leave 2 min for their questions. "
        "4) Thank them and call `end_interview`.\n"
        "Be warm and encouraging, but hold them to specifics."
    )


def _interviewer_tools() -> list[types.Tool]:
    return [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="end_interview",
                    description=(
                        "Call this exactly once when the interview is over (time is up, "
                        "all planned questions are done, or the candidate asks to stop). "
                        "The client will then finalise and score the session."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "reason": types.Schema(
                                type=types.Type.STRING,
                                enum=["completed", "time_up", "candidate_ended"],
                            )
                        },
                        required=["reason"],
                    ),
                )
            ]
        )
    ]


def _mint_ephemeral_token(
    *, system_instruction: str, voice_model: str, duration_minutes: int
) -> str:
    """
    Mint a single-use, short-lived Gemini Live token with the full session
    config (model, persona, tools, transcription, voice) locked server-side.
    The browser never sees GEMINI_API_KEY; it connects directly to Google with
    this token via `BidiGenerateContentConstrained`.
    """
    model_name = INTERVIEW_LIVE_MODELS.get(voice_model) or INTERVIEW_LIVE_MODELS[DEFAULT_VOICE_MODEL]
    now = datetime.now(timezone.utc)
    live_cfg = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=system_instruction,
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=INTERVIEWER_VOICE)
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        tools=_interviewer_tools(),
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow()
        ),
    )
    token = _live_client.auth_tokens.create(
        config=types.CreateAuthTokenConfig(
            uses=1,
            expire_time=(now + timedelta(minutes=TOKEN_TTL_MINUTES)).isoformat(),
            new_session_expire_time=(
                now + timedelta(minutes=TOKEN_NEW_SESSION_WINDOW_MINUTES)
            ).isoformat(),
            live_ephemeral_parameters=types.LiveConnectParameters(
                model=f"models/{model_name}", config=live_cfg
            ),
        )
    )
    return token.name


def _hydrate_session(row: dict) -> dict:
    """Attach problem metadata + derived timing fields to a raw DB row."""
    problems: list[dict] = []
    for pid in row.get("problem_ids") or []:
        meta = _problem_detail(int(pid), include_description=True) or {
            "id": int(pid),
            "title": f"Problem #{pid}",
            "difficulty": "Unknown",
            "related_topics": [],
            "description": "",
        }
        # Role comes from the persisted snapshot (matches by id).
        for p in (row.get("context_snapshot") or {}).get("problems", []):
            if int(p.get("id", -1)) == int(pid):
                meta["role"] = p.get("role")
                break
        problems.append(meta)

    started_at = row.get("started_at")
    expires_at = None
    if started_at and row.get("duration_minutes"):
        try:
            sa = datetime.fromisoformat(str(started_at).replace("Z", "+00:00"))
            expires_at = sa.timestamp() + int(row["duration_minutes"]) * 60
        except Exception:
            expires_at = None

    return {**row, "problems": problems, "expires_at_epoch": expires_at}


def _lazy_finalize_expired(user_id: str, rows: list[dict]) -> list[dict]:
    """Sweep stale-active sessions to 'abandoned' so history stays accurate."""
    if not rows:
        return rows
    now = datetime.now(timezone.utc)
    out: list[dict] = []
    for row in rows:
        if row.get("status") != "active":
            out.append(row)
            continue
        try:
            sa = datetime.fromisoformat(str(row.get("started_at")).replace("Z", "+00:00"))
        except Exception:
            out.append(row)
            continue
        if (now - sa).total_seconds() < (int(row.get("duration_minutes") or 0) + 10) * 60:
            out.append(row)
            continue
        try:
            upd = (
                supabase.table("interview_sessions")
                .update({"status": "abandoned", "completed_at": now.isoformat()})
                .eq("id", row["id"])
                .eq("user_id", user_id)
                .eq("status", "active")
                .execute()
            )
            out.append(upd.data[0] if upd.data else {**row, "status": "abandoned"})
        except Exception as e:
            print(f"[interviews] lazy finalise skipped for {row.get('id')}: {str(e)}")
            out.append(row)
    return out


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class StartInterviewRequest(BaseModel):
    roadmap_id: Optional[int] = None
    interview_type: str = "technical"  # technical | behavioral | system_design
    difficulty: str = "intermediate"  # beginner | intermediate | advanced
    duration_minutes: int = 30
    voice_model: str = DEFAULT_VOICE_MODEL  # "native" | "fast"


class TokenRequest(BaseModel):
    voice_model: Optional[str] = None


class TranscriptTurn(BaseModel):
    role: str  # "user" | "model" | "system"
    text: str
    at_ms: int


class AppendEventsRequest(BaseModel):
    turns: list[TranscriptTurn]


class CompleteInterviewRequest(BaseModel):
    abandoned: bool = False
    notes: Optional[str] = None  # candidate's scratchpad (technical only)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("")
async def list_interviews(limit: int = 20, user=Depends(get_current_user)):
    try:
        try:
            resp = (
                supabase.table("interview_sessions")
                .select(
                    "id,user_id,roadmap_id,interview_type,difficulty,duration_minutes,"
                    "status,problem_ids,overall_score,started_at,completed_at,created_at"
                )
                .eq("user_id", user.user.id)
                .order("created_at", desc=True)
                .limit(max(1, min(limit, 100)))
                .execute()
            )
        except Exception as e:
            print(f"[interviews] list skipped (table missing?): {str(e)}")
            return {"interviews": []}
        rows = _lazy_finalize_expired(user.user.id, resp.data or [])
        return {"interviews": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing interviews: {str(e)}")


@router.get("/stats")
async def get_interview_stats(user=Depends(get_current_user)):
    """Aggregate stats for the dashboard / practice hub."""
    try:
        try:
            resp = (
                supabase.table("interview_sessions")
                .select("id,status,overall_score,interview_type,started_at,completed_at,duration_minutes")
                .eq("user_id", user.user.id)
                .order("created_at", desc=True)
                .limit(200)
                .execute()
            )
        except Exception as e:
            print(f"[interviews] stats skipped: {str(e)}")
            return {"completed": 0, "active": 0, "best_score": None, "avg_score": None, "last": None}
        rows = _lazy_finalize_expired(user.user.id, resp.data or [])
        completed = [r for r in rows if r.get("status") == "completed"]
        active = [r for r in rows if r.get("status") == "active"]
        scores = [int(r.get("overall_score") or 0) for r in completed if r.get("overall_score") is not None]
        return {
            "completed": len(completed),
            "active": len(active),
            "best_score": max(scores) if scores else None,
            "avg_score": round(sum(scores) / len(scores)) if scores else None,
            "last": completed[0] if completed else None,
            "active_session": active[0] if active else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building interview stats: {str(e)}")


@router.post("/start")
async def start_interview(body: StartInterviewRequest, user=Depends(get_current_user)):
    """
    Create a new interview session: build the context-aware system prompt from
    the user's roadmap/analytics, pick concrete problems (technical only),
    persist the row, and return the hydrated session. The browser then calls
    `/{id}/token` to obtain an ephemeral Gemini Live token before connecting.
    """
    try:
        user_id = user.user.id
        itype = body.interview_type if body.interview_type in RUBRICS else "technical"
        difficulty = body.difficulty if body.difficulty in {"beginner", "intermediate", "advanced"} else "intermediate"
        duration = max(10, min(int(body.duration_minutes or 30), MAX_DURATION_MINUTES))
        voice_model = body.voice_model if body.voice_model in INTERVIEW_LIVE_MODELS else DEFAULT_VOICE_MODEL

        roadmap = _resolve_roadmap(user_id, body.roadmap_id)
        ctx = _build_context_snapshot(
            user_id=user_id, roadmap=roadmap, interview_type=itype, difficulty=difficulty
        )
        ctx["voice_model"] = voice_model
        system_instruction = _build_system_instruction(ctx, duration)
        ctx["system_instruction"] = system_instruction

        record = {
            "user_id": user_id,
            "roadmap_id": ctx.get("roadmap_id"),
            "interview_type": itype,
            "difficulty": difficulty,
            "duration_minutes": duration,
            "status": "active",
            "context_snapshot": ctx,
            "problem_ids": [int(p["id"]) for p in ctx.get("problems", [])],
            "transcript": [],
        }
        try:
            insert_resp = supabase.table("interview_sessions").insert(record).execute()
        except Exception as e:
            print(f"[interviews] insert failed (table missing?): {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="interview_sessions table not available. Apply the latest migration in api/schema.md.",
            )
        if not insert_resp.data:
            raise HTTPException(status_code=500, detail="Failed to create interview session")

        return {"session": _hydrate_session(insert_resp.data[0])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting interview: {str(e)}")


@router.post("/{session_id}/token")
async def get_live_token(session_id: int, body: TokenRequest, user=Depends(get_current_user)):
    """
    Mint a fresh single-use ephemeral Gemini Live token for this session. The
    full Live config (model, system instruction, tools, voice, transcription)
    is locked into the token server-side so the browser can't tamper with it.
    Called on initial connect and on reconnect.
    """
    try:
        resp = (
            supabase.table("interview_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user.user.id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Interview session not found")
        session = resp.data[0]
        if session.get("status") != "active":
            raise HTTPException(status_code=400, detail="Interview session is not active")

        ctx = session.get("context_snapshot") or {}
        voice_model = (
            body.voice_model
            if body.voice_model in INTERVIEW_LIVE_MODELS
            else ctx.get("voice_model", DEFAULT_VOICE_MODEL)
        )
        system_instruction = ctx.get("system_instruction") or _build_system_instruction(
            ctx, int(session.get("duration_minutes") or 30)
        )
        token_name = _mint_ephemeral_token(
            system_instruction=system_instruction,
            voice_model=voice_model,
            duration_minutes=int(session.get("duration_minutes") or 30),
        )
        model_name = INTERVIEW_LIVE_MODELS.get(voice_model) or INTERVIEW_LIVE_MODELS[DEFAULT_VOICE_MODEL]
        return {
            "token": token_name,
            "model": f"models/{model_name}",
            "api_version": "v1alpha",
            "expires_in_seconds": TOKEN_TTL_MINUTES * 60,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error minting live token: {str(e)}")


@router.get("/{session_id}")
async def get_interview(session_id: int, user=Depends(get_current_user)):
    try:
        resp = (
            supabase.table("interview_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user.user.id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Interview session not found")
        rows = _lazy_finalize_expired(user.user.id, resp.data)
        return {"session": _hydrate_session(rows[0])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching interview: {str(e)}")


@router.post("/{session_id}/event")
async def append_events(
    session_id: int, body: AppendEventsRequest, user=Depends(get_current_user)
):
    """
    Append one or more finalised transcript turns. Called by the client
    whenever the Live API emits a complete input/output transcription so the
    DB stays authoritative even if the socket drops mid-session.
    """
    try:
        resp = (
            supabase.table("interview_sessions")
            .select("id,user_id,status,transcript")
            .eq("id", session_id)
            .eq("user_id", user.user.id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Interview session not found")
        session = resp.data[0]
        if session.get("status") != "active":
            raise HTTPException(status_code=400, detail="Interview session is not active")

        transcript = list(session.get("transcript") or [])
        for t in body.turns:
            text = (t.text or "").strip()
            if not text:
                continue
            transcript.append({"role": t.role, "text": text[:4000], "at_ms": int(t.at_ms)})

        upd = (
            supabase.table("interview_sessions")
            .update({"transcript": transcript})
            .eq("id", session_id)
            .execute()
        )
        if not upd.data:
            raise HTTPException(status_code=500, detail="Failed to persist transcript")
        return {"ok": True, "turn_count": len(transcript)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error appending transcript: {str(e)}")


def _score_transcript(session: dict, notes: Optional[str]) -> dict:
    """
    Grade the interview using a non-live Gemini call with a strict JSON schema
    derived from the rubric for this interview type. Returns
    {rubric_scores, overall_score, feedback}.
    """
    itype = session.get("interview_type") or "technical"
    rubric = RUBRICS.get(itype, RUBRICS["technical"])
    ctx = session.get("context_snapshot") or {}
    transcript: list[dict] = session.get("transcript") or []

    convo_lines: list[str] = []
    for turn in transcript:
        role = "Interviewer" if turn.get("role") == "model" else (
            "Candidate" if turn.get("role") == "user" else "System"
        )
        convo_lines.append(f"{role}: {turn.get('text', '')}")
    convo = "\n".join(convo_lines) or "(no transcript captured)"

    problem_lines = []
    for p in ctx.get("problems") or []:
        problem_lines.append(f'- [{p.get("role")}] {p.get("title")} ({p.get("difficulty")})')

    dims = ", ".join(f"{k} (weight {int(v*100)}%)" for k, v in rubric.items())
    prompt = f"""
You are grading a mock {itype.replace('_', ' ')} interview. Score each rubric dimension
from 1 (poor) to 5 (excellent) based ONLY on the transcript and notes below. Be strict
but fair; if evidence for a dimension is missing, score it 2.

Candidate goal: {ctx.get('goal') or 'software engineering role'} at {ctx.get('company') or 'a tech company'}.
Weak topics going in: {', '.join(ctx.get('weak_topics') or []) or 'none'}.
Problems posed (technical only):
{chr(10).join(problem_lines) or '  (n/a)'}

Rubric dimensions: {dims}.

TRANSCRIPT:
{_truncate(convo, 12000)}

CANDIDATE SCRATCHPAD / NOTES:
{_truncate(notes or '(none)', 2000)}

Respond with ONLY JSON:
{{
  "rubric_scores": {{{", ".join(f'"{k}": <1-5 int>' for k in rubric)}}},
  "feedback": {{
    "summary": "1-2 sentence overall assessment",
    "strengths": ["..."],
    "improvements": ["..."],
    "focus_areas": ["topic to study next", ...]
  }}
}}
""".strip()

    resp = _scoring_client.models.generate_content(
        model=_SCORING_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )
    try:
        parsed = json.loads((resp.text or "").strip())
    except Exception:
        parsed = {}

    raw_scores = parsed.get("rubric_scores") if isinstance(parsed, dict) else None
    rubric_scores: dict[str, int] = {}
    for k in rubric:
        try:
            v = int(round(float((raw_scores or {}).get(k, 2))))
        except Exception:
            v = 2
        rubric_scores[k] = max(1, min(5, v))
    overall = int(round(sum(rubric_scores[k] * w for k, w in rubric.items()) * 20))

    fb = parsed.get("feedback") if isinstance(parsed, dict) else None
    if not isinstance(fb, dict):
        fb = {}
    feedback = {
        "summary": str(fb.get("summary") or "Interview scored."),
        "strengths": [str(s) for s in (fb.get("strengths") or [])][:5],
        "improvements": [str(s) for s in (fb.get("improvements") or [])][:5],
        "focus_areas": [str(s) for s in (fb.get("focus_areas") or [])][:5],
    }
    return {"rubric_scores": rubric_scores, "overall_score": overall, "feedback": feedback}


def _mirror_interview_solves(user_id: str, session: dict, rubric_scores: dict) -> None:
    """Credit problems to analytics if the candidate scored well enough."""
    if (session.get("interview_type") or "technical") != "technical":
        return
    threshold = 3  # out of 5 on problem_solving
    if int(rubric_scores.get("problem_solving", 0)) < threshold:
        return
    problem_ids = [int(p) for p in (session.get("problem_ids") or [])]
    if not problem_ids:
        return
    try:
        existing_resp = (
            supabase.table("problem_completions")
            .select("problem_id")
            .eq("user_id", user_id)
            .in_("problem_id", problem_ids)
            .execute()
        )
        existing = {int(r["problem_id"]) for r in (existing_resp.data or [])}
        rows = []
        for pid in problem_ids:
            if pid in existing:
                continue
            meta = _problem_detail(pid) or {}
            topics = meta.get("related_topics") or []
            rows.append(
                {
                    "user_id": user_id,
                    "roadmap_id": session.get("roadmap_id"),
                    "task_id": None,
                    "problem_id": pid,
                    "topic_name": topics[0] if topics else "General",
                    "source": "interview",
                }
            )
        if rows:
            supabase.table("problem_completions").insert(rows).execute()
        supabase.rpc("refresh_user_streak", {"p_user_id": user_id}).execute()
    except Exception as e:
        print(f"[interviews] completion mirror skipped: {str(e)}")


@router.post("/{session_id}/complete")
async def complete_interview(
    session_id: int, body: CompleteInterviewRequest, user=Depends(get_current_user)
):
    """
    Finalise the session: grade the transcript via the rubric model, persist
    scores + structured feedback, and (for technical interviews with a passing
    problem-solving score) mirror the asked problems into `problem_completions`
    so they feed analytics and streaks.
    """
    try:
        user_id = user.user.id
        now = datetime.now(timezone.utc)
        resp = (
            supabase.table("interview_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Interview session not found")
        session = resp.data[0]
        if session.get("status") != "active":
            # Idempotent: return the already-finalised row.
            return {"session": _hydrate_session(session)}

        transcript = session.get("transcript") or []
        if body.abandoned or len(transcript) < 2:
            upd = (
                supabase.table("interview_sessions")
                .update({"status": "abandoned", "completed_at": now.isoformat()})
                .eq("id", session_id)
                .execute()
            )
            return {"session": _hydrate_session(upd.data[0] if upd.data else session)}

        scored = _score_transcript(session, body.notes)
        upd = (
            supabase.table("interview_sessions")
            .update(
                {
                    "status": "completed",
                    "completed_at": now.isoformat(),
                    "rubric_scores": scored["rubric_scores"],
                    "overall_score": scored["overall_score"],
                    "feedback": scored["feedback"],
                }
            )
            .eq("id", session_id)
            .execute()
        )
        if not upd.data:
            raise HTTPException(status_code=500, detail="Failed to finalise interview")

        _mirror_interview_solves(user_id, session, scored["rubric_scores"])

        return {"session": _hydrate_session(upd.data[0])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error completing interview: {str(e)}")

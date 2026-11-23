"""Checks on the test scaffold itself: the fakes are wired in and behave like the real clients."""

import socket
import sys

import pytest
import supabase
from google import genai

import main
import supabase_client
import tools
from routers import interview_router, progress_router, roadmap_router
from tests.fakes import FakeAuthError


def test_the_app_uses_the_fakes(supabase_fake, gemini_fake):
    assert supabase_client.supabase is supabase_fake
    assert main.supabase is supabase_fake
    assert roadmap_router.supabase is supabase_fake
    assert tools.client is gemini_fake
    assert progress_router.client is gemini_fake
    assert interview_router._live_client is gemini_fake
    assert interview_router._scoring_client is gemini_fake


def test_no_api_module_keeps_a_real_client():
    api_modules = [
        module
        for name, module in list(sys.modules.items())
        if name in {"main", "tools", "supabase_client"}
        or name.split(".")[0] in {"routers", "services", "agents"}
    ]
    assert api_modules
    for module in api_modules:
        for value in vars(module).values():
            assert not isinstance(value, (supabase.Client, genai.Client)), module.__name__


def test_tests_cannot_open_network_connections():
    with pytest.raises(OSError, match="may not open network connections"):
        socket.create_connection(("203.0.113.10", 443), timeout=1)


def test_fake_gemini_returns_queued_replies_and_records_calls(gemini_fake):
    gemini_fake.models.responses.append('{"roadmap_data": [{"week": 1}]}')
    user_input = {"goal": "Arrays", "weeks": 1, "weekly_hours": 5, "current_knowledge": {}}

    assert tools.RoadmapTool()._run(user_input) == {"roadmap_data": [{"week": 1}]}
    assert len(gemini_fake.models.calls) == 1
    assert gemini_fake.models.calls[0]["model"] == "gemini-2.5-flash"


def test_fake_gemini_fails_when_no_reply_is_queued(gemini_fake):
    with pytest.raises(RuntimeError, match="no response queued"):
        gemini_fake.models.generate_content(model="gemini-2.5-flash", contents="hi")


def test_fake_supabase_assigns_ids_except_where_the_caller_supplies_the_key(supabase_fake):
    roadmaps = supabase_fake.table("roadmaps").insert([{"user_id": "a"}, {"user_id": "b"}]).execute().data
    streak = supabase_fake.table("user_streaks").insert({"user_id": "a", "current_streak": 1}).execute().data

    assert [r["id"] for r in roadmaps] == [1, 2]
    assert streak == [{"user_id": "a", "current_streak": 1}]


def test_fake_supabase_select_filters_orders_limits_and_projects(supabase_fake):
    supabase_fake.seed(
        "challenges",
        [
            {"user_id": "a", "status": "completed", "created_at": "2026-11-01"},
            {"user_id": "a", "status": "active", "created_at": None},
            {"user_id": "a", "status": "completed", "created_at": "2026-11-03"},
            {"user_id": "b", "status": "completed", "created_at": "2026-11-04"},
        ],
    )

    rows = (
        supabase_fake.table("challenges")
        .select("id, created_at")
        .eq("user_id", "a")
        .in_("status", ["completed", "active"])
        .order("created_at", desc=True)
        .limit(2)
        .execute()
        .data
    )

    # Descending order puts NULLs first, as Postgres does.
    assert rows == [{"id": 2, "created_at": None}, {"id": 3, "created_at": "2026-11-03"}]


def test_fake_supabase_update_and_delete_touch_only_matching_rows(supabase_fake):
    supabase_fake.seed("roadmaps", [{"user_id": "a", "company": "x"}, {"user_id": "b", "company": "y"}])

    updated = supabase_fake.table("roadmaps").update({"company": "z"}).eq("user_id", "a").execute().data
    deleted = supabase_fake.table("roadmaps").delete().eq("user_id", "b").execute().data

    assert updated == [{"id": 1, "user_id": "a", "company": "z"}]
    assert deleted == [{"id": 2, "user_id": "b", "company": "y"}]
    assert supabase_fake.rows("roadmaps") == [{"id": 1, "user_id": "a", "company": "z"}]


def test_fake_supabase_returns_copies_not_stored_rows(supabase_fake):
    supabase_fake.seed("roadmaps", [{"user_id": "a", "roadmap_data": [{"week": 1}]}])

    row = supabase_fake.table("roadmaps").select("*").execute().data[0]
    row["roadmap_data"].append({"week": 2})

    assert supabase_fake.rows("roadmaps")[0]["roadmap_data"] == [{"week": 1}]


def test_fake_supabase_records_rpc_calls(supabase_fake):
    supabase_fake.rpc_handlers["get_leaderboard"] = lambda params: [{"rank": 1, "limit": params["p_limit"]}]

    assert supabase_fake.rpc("get_leaderboard", {"p_limit": 5}).execute().data == [{"rank": 1, "limit": 5}]
    assert supabase_fake.rpc("refresh_user_streak", {"p_user_id": "a"}).execute().data is None
    assert supabase_fake.rpc_calls == [
        ("get_leaderboard", {"p_limit": 5}),
        ("refresh_user_streak", {"p_user_id": "a"}),
    ]


def test_fake_auth_knows_only_the_tokens_it_issued(supabase_fake):
    token = supabase_fake.auth.token_for("user-a")

    assert supabase_fake.auth.get_user(token).user.id == "user-a"
    with pytest.raises(FakeAuthError, match="invalid JWT"):
        supabase_fake.auth.get_user("forged-token")

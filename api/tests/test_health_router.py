import pandas as pd
import pytest
from postgrest.exceptions import APIError

from routers import (
    analytics_router,
    challenge_router,
    interview_router,
    problem_router,
    progress_router,
)
from tests.fakes import FakeQuery

USER_A = "00000000-0000-4000-8000-00000000000a"

DATASET_FRAMES = [
    (problem_router, "problems_df"),
    (analytics_router, "_problems_df"),
    (challenge_router, "_ch_problems_df"),
    (interview_router, "_iv_problems_df"),
    (progress_router, "_pc_problems_df"),
]


@pytest.fixture
def no_auth_calls(supabase_fake, monkeypatch):
    """Make any call to the auth service fail the test."""

    def refuse(*args, **kwargs):
        raise AssertionError("health routes must not call the auth service")

    monkeypatch.setattr(supabase_fake.auth, "get_user", refuse)


@pytest.fixture
def reads(monkeypatch):
    """Record the data every Supabase query in the request returned."""
    recorded = []
    real_execute = FakeQuery.execute

    def recording_execute(self):
        response = real_execute(self)
        recorded.append(response.data)
        return response

    monkeypatch.setattr(FakeQuery, "execute", recording_execute)
    return recorded


def test_health_is_ok_without_authorization(client, no_auth_calls):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_makes_no_database_call(client, supabase_fake, monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("/health must not call the database")

    monkeypatch.setattr(supabase_fake, "table", refuse)
    monkeypatch.setattr(supabase_fake, "rpc", refuse)

    response = client.get("/health")

    assert response.status_code == 200


@pytest.mark.parametrize(
    ("module", "attr"),
    DATASET_FRAMES,
    ids=[f"{module.__name__}.{attr}" for module, attr in DATASET_FRAMES],
)
def test_health_is_unavailable_when_a_router_has_no_dataset(client, monkeypatch, module, attr):
    monkeypatch.setattr(module, attr, pd.DataFrame())

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "problem dataset not loaded"}


def test_health_db_is_ok_after_one_read_of_one_id(client, supabase_fake, no_auth_calls, reads):
    supabase_fake.seed(
        "roadmaps",
        [
            {"user_id": USER_A, "company": "google"},
            {"user_id": USER_A, "company": "amazon"},
            {"user_id": USER_A, "company": "netflix"},
        ],
    )

    response = client.get("/health/db")

    assert response.status_code == 200
    assert len(reads) == 1
    assert len(reads[0]) == 1
    assert set(reads[0][0]) == {"id"}


def test_health_db_returns_no_data_from_the_table(client, supabase_fake):
    supabase_fake.seed("roadmaps", [{"user_id": USER_A, "company": "google"}])

    response = client.get("/health/db")

    assert response.json() == {"status": "ok"}
    assert USER_A not in response.text


def test_health_db_is_ok_when_the_table_is_empty(client):
    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize(
    "error",
    [
        APIError({"message": "relation does not exist", "code": "42P01"}),
        ConnectionError("HTTP 521 from db.internal.example"),
    ],
    ids=["api-error", "connection-error"],
)
def test_health_db_is_unavailable_when_the_read_fails(client, monkeypatch, no_auth_calls, error):
    def fail(self):
        raise error

    monkeypatch.setattr(FakeQuery, "execute", fail)

    response = client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "database read failed"}
    assert "521" not in response.text
    assert "relation" not in response.text

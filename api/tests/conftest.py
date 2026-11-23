"""Shared test setup for the API.

Placeholder settings are put in place before the app is imported, every
Supabase and Gemini client the app creates is swapped for an in-memory fake
before each test, and socket connections to anything but this machine raise.
No test can reach a real service.

Run pytest from `api/`: the routers load `dataset/leetcode-problems.csv`
from a path relative to the working directory.
"""

import os
import socket
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
import supabase
from fastapi.testclient import TestClient
from google import genai

from tests.fakes import FakeGemini, FakeSupabase

API_DIR = Path(__file__).resolve().parent.parent

# Assigned, not defaulted, so that real values from the shell or from
# api/.env are never used (load_dotenv leaves variables that are set alone).
os.environ.update(
    {
        "SUPABASE_URL": "http://127.0.0.1:54321",
        "SUPABASE_KEY": "test-placeholder-key",
        "GEMINI_API_KEY": "test-placeholder-key",
        "GOOGLE_API_KEY": "test-placeholder-key",
        "MODEL": "gemini/gemini-2.5-flash",
        "CREWAI_DISABLE_TELEMETRY": "true",
        "OTEL_SDK_DISABLED": "true",
    }
)

if not Path("dataset/leetcode-problems.csv").is_file():
    pytest.exit(
        "Run pytest from api/: the routers load dataset/leetcode-problems.csv "
        "relative to the working directory.",
        returncode=4,
    )

_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}
_real_connect = socket.socket.connect


def _loopback_only_connect(sock, address):
    # Loopback stays allowed: asyncio on Windows links its socket pair over it.
    if sock.family in (socket.AF_INET, socket.AF_INET6) and address[0] not in _LOOPBACK_HOSTS:
        raise OSError(f"tests may not open network connections (tried {address!r})")
    return _real_connect(sock, address)


socket.socket.connect = _loopback_only_connect


_API_PREFIX = os.path.normcase(str(API_DIR)) + os.sep
_SITE_PACKAGES = f"{os.sep}site-packages{os.sep}"


def _app_modules():
    """Modules loaded from the API's own source files, not from a virtualenv."""
    # String checks only: resolving the path of every loaded module costs
    # seconds per test on Windows.
    for module in list(sys.modules.values()):
        path = getattr(module, "__file__", None)
        if not path:
            continue
        path = os.path.normcase(os.path.abspath(path))
        if path.startswith(_API_PREFIX) and _SITE_PACKAGES not in path:
            yield module


@pytest.fixture(scope="session")
def app():
    # Imported here, after the placeholder settings above are in place.
    import main

    return main.app


@pytest.fixture(autouse=True)
def fake_clients(app, monkeypatch):
    """Swap every Supabase and Gemini client held by an API module for a fake."""
    fakes = SimpleNamespace(supabase=FakeSupabase(), gemini=FakeGemini())
    for module in _app_modules():
        for name, value in list(vars(module).items()):
            if isinstance(value, supabase.Client):
                monkeypatch.setattr(module, name, fakes.supabase)
            elif isinstance(value, genai.Client):
                monkeypatch.setattr(module, name, fakes.gemini)
    return fakes


@pytest.fixture
def supabase_fake(fake_clients):
    return fake_clients.supabase


@pytest.fixture
def gemini_fake(fake_clients):
    return fake_clients.gemini


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def auth_header(supabase_fake):
    """Build an Authorization header that the fake auth client accepts for a user id."""

    def make(user_id):
        return {"Authorization": f"Bearer {supabase_fake.auth.token_for(user_id)}"}

    return make

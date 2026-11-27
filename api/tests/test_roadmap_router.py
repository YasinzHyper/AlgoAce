USER_A = "00000000-0000-4000-8000-00000000000a"
USER_B = "00000000-0000-4000-8000-00000000000b"


def test_list_roadmaps_returns_only_the_callers_roadmaps(client, supabase_fake, auth_header):
    supabase_fake.seed(
        "roadmaps",
        [
            {"user_id": USER_A, "company": "google"},
            {"user_id": USER_B, "company": "netflix"},
            {"user_id": USER_A, "company": "amazon"},
        ],
    )

    response = client.get("/api/roadmap/", headers=auth_header(USER_A))

    assert response.status_code == 200
    roadmaps = response.json()["roadmaps"]
    assert sorted(r["company"] for r in roadmaps) == ["amazon", "google"]
    assert {r["user_id"] for r in roadmaps} == {USER_A}


def test_list_roadmaps_is_empty_for_a_user_without_roadmaps(client, supabase_fake, auth_header):
    supabase_fake.seed("roadmaps", [{"user_id": USER_B, "company": "netflix"}])

    response = client.get("/api/roadmap/", headers=auth_header(USER_A))

    assert response.status_code == 200
    assert response.json() == {"roadmaps": []}


def test_list_roadmaps_rejects_a_token_the_auth_service_does_not_know(client):
    response = client.get("/api/roadmap/", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401
    assert "invalid JWT" in response.json()["detail"]


def test_list_roadmaps_requires_an_authorization_header(client):
    response = client.get("/api/roadmap/")

    assert response.status_code == 422


def test_generate_reports_the_tools_error_without_wrapping_it(client, supabase_fake, gemini_fake, auth_header):
    # The roadmap tool turns a failed model call into {"error": ...}, which the
    # handler raises as an HTTPException of its own.
    gemini_fake.models.responses = [RuntimeError("model unavailable")]
    body = {"goal": "Get ready for interviews", "weekly_hours": 5, "weeks": 2}

    response = client.post("/api/roadmap/generate", json=body, headers=auth_header(USER_A))

    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to generate roadmap: model unavailable"}
    assert len(gemini_fake.models.calls) == 1
    assert supabase_fake.rows("roadmaps") == []
    assert supabase_fake.rows("tasks") == []

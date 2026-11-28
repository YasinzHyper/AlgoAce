import json

import tools
from tests.fakes import FakeResponse

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


# --- POST /api/roadmap/generate: a roadmap is saved with its tasks or not at all

GENERATE_BODY = {"goal": "Get ready for interviews at Google", "weekly_hours": 2, "weeks": 2}

# A model reply whose weeks all have topics that the dataset knows.
ROADMAP_REPLY = {
    "company": "google",
    "roadmap_data": [
        {"week": 1, "DSA": {"Arrays": "Basic"}, "Other": {"Operating Systems": "Basic"}},
        {"week": 2, "DSA": {"Graphs": "Advanced"}},
    ],
}

TABLES = ("roadmaps", "tasks", "progress")


class FailingQuery:
    """A query chain whose execute() raises `error`, or returns no rows when it is None."""

    def __init__(self, error):
        self._error = error

    def eq(self, column, value):
        return self

    def execute(self):
        if self._error is None:
            return FakeResponse([])
        raise self._error


def make_fail(monkeypatch, supabase_fake, table, operation, error=None):
    """Make every `operation` ("insert" or "delete") on `table` fail; nothing else changes."""
    real_table = supabase_fake.table

    def table_with_a_failing_operation(name):
        query = real_table(name)
        if name == table:
            setattr(query, operation, lambda *args: FailingQuery(error))
        return query

    monkeypatch.setattr(supabase_fake, "table", table_with_a_failing_operation)


def make_insert_fail_after_writing(monkeypatch, supabase_fake, table, error):
    """Make inserts into `table` store their rows and then raise, as when the reply is lost."""
    real_table = supabase_fake.table

    def table_with_a_lost_reply(name):
        query = real_table(name)
        if name == table:
            real_insert = query.insert

            def insert(rows):
                real_insert(rows).execute()
                return FailingQuery(error)

            query.insert = insert
        return query

    monkeypatch.setattr(supabase_fake, "table", table_with_a_lost_reply)


def seed_other_roadmaps(supabase_fake):
    """Give the caller an older roadmap and another user a roadmap, each with a task and progress."""
    for user_id in (USER_A, USER_B):
        [roadmap] = supabase_fake.seed("roadmaps", [{"user_id": user_id, "company": "amazon"}])
        [task] = supabase_fake.seed(
            "tasks", [{"roadmap_id": roadmap["id"], "week": 1, "lc_problem_ids": [1], "other_topics": []}]
        )
        supabase_fake.seed(
            "progress",
            [{"roadmap_id": roadmap["id"], "task_id": task["id"], "user_id": user_id, "completed_problem_count": 1}],
        )
    return {table: supabase_fake.rows(table) for table in TABLES}


def generate(client, gemini_fake, auth_header, reply=ROADMAP_REPLY, body=GENERATE_BODY):
    gemini_fake.models.responses = [json.dumps(reply)]
    return client.post("/api/roadmap/generate", json=body, headers=auth_header(USER_A))


def test_generate_saves_the_roadmap_with_a_task_and_a_progress_row_per_week(client, supabase_fake, gemini_fake, auth_header):
    expected_weeks = tools.ProblemRecommendationTool()._run(
        roadmap_data=ROADMAP_REPLY["roadmap_data"], company="google", user_input=GENERATE_BODY
    )

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 200
    assert response.json() == ROADMAP_REPLY
    assert len(gemini_fake.models.calls) == 1
    [roadmap] = supabase_fake.rows("roadmaps")
    assert roadmap == {
        "id": roadmap["id"],
        "user_id": USER_A,
        "user_input": {**GENERATE_BODY, "deadline": None, "current_knowledge": None},
        "roadmap_data": ROADMAP_REPLY["roadmap_data"],
        "company": "google",
        "created_at": "now()",
    }
    tasks = supabase_fake.rows("tasks")
    assert [{k: v for k, v in task.items() if k != "id"} for task in tasks] == [
        {"roadmap_id": roadmap["id"], "week": 1, "lc_problem_ids": expected_weeks[0]["problems"], "other_topics": ["Operating Systems"]},
        {"roadmap_id": roadmap["id"], "week": 2, "lc_problem_ids": expected_weeks[1]["problems"], "other_topics": []},
    ]
    assert all(task["lc_problem_ids"] for task in tasks)
    progress_rows = supabase_fake.rows("progress")
    assert len(progress_rows) == len(tasks)
    assert [{k: v for k, v in row.items() if k != "id"} for row in progress_rows] == [
        {
            "roadmap_id": roadmap["id"],
            "task_id": task["id"],
            "user_id": USER_A,
            "completed": {
                "problems": {str(problem_id): False for problem_id in task["lc_problem_ids"]},
                "topics": {topic: False for topic in task["other_topics"]},
            },
            "completion_percentage": 0,
            "total_problem_count": len(task["lc_problem_ids"]),
            "completed_problem_count": 0,
            "positive_feedback": None,
            "negative_feedback": None,
        }
        for task in tasks
    ]


def test_generate_saves_nothing_when_no_problem_matches_the_roadmap(client, supabase_fake, gemini_fake, auth_header):
    before = seed_other_roadmaps(supabase_fake)
    reply = {
        "roadmap_data": [
            {"week": 1, "DSA": {"Underwater Basket Weaving": "Basic"}},
            {"week": 2, "DSA": {}, "Other": {"Operating Systems": "Basic"}},
        ]
    }

    response = generate(client, gemini_fake, auth_header, reply=reply)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: no problems match the roadmap's topics"}
    assert {table: supabase_fake.rows(table) for table in TABLES} == before


def test_generate_saves_nothing_when_choosing_the_problems_fails(client, supabase_fake, gemini_fake, auth_header, monkeypatch):
    before = seed_other_roadmaps(supabase_fake)

    def fail(self, *args, **kwargs):
        raise TypeError("unsupported operand type(s)")

    monkeypatch.setattr(tools.ProblemRecommendationTool, "_run", fail)

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: unsupported operand type(s)"}
    assert {table: supabase_fake.rows(table) for table in TABLES} == before


def test_generate_removes_the_roadmap_when_saving_its_tasks_fails(client, supabase_fake, gemini_fake, auth_header, monkeypatch):
    before = seed_other_roadmaps(supabase_fake)
    make_fail(monkeypatch, supabase_fake, "tasks", "insert", RuntimeError("tasks insert failed"))

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: tasks insert failed"}
    assert {table: supabase_fake.rows(table) for table in TABLES} == before


def test_generate_removes_the_roadmap_when_no_task_is_saved(client, supabase_fake, gemini_fake, auth_header, monkeypatch):
    before = seed_other_roadmaps(supabase_fake)
    make_fail(monkeypatch, supabase_fake, "tasks", "insert")

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: 500: Failed to save tasks to database"}
    assert {table: supabase_fake.rows(table) for table in TABLES} == before


def test_generate_removes_the_roadmap_and_its_tasks_when_saving_progress_fails(client, supabase_fake, gemini_fake, auth_header, monkeypatch):
    before = seed_other_roadmaps(supabase_fake)
    make_fail(monkeypatch, supabase_fake, "progress", "insert", RuntimeError("progress insert failed"))

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: progress insert failed"}
    assert {table: supabase_fake.rows(table) for table in TABLES} == before


def test_generate_removes_the_roadmap_and_its_tasks_when_no_progress_row_is_saved(client, supabase_fake, gemini_fake, auth_header, monkeypatch):
    before = seed_other_roadmaps(supabase_fake)
    make_fail(monkeypatch, supabase_fake, "progress", "insert")

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: 500: Failed to save progress entries"}
    assert {table: supabase_fake.rows(table) for table in TABLES} == before


def test_generate_removes_progress_rows_that_were_written_before_the_error(client, supabase_fake, gemini_fake, auth_header, monkeypatch):
    before = seed_other_roadmaps(supabase_fake)
    make_insert_fail_after_writing(monkeypatch, supabase_fake, "progress", TimeoutError("read timed out"))

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: read timed out"}
    assert {table: supabase_fake.rows(table) for table in TABLES} == before


def test_generate_reports_the_save_error_when_removing_the_roadmap_fails(client, supabase_fake, gemini_fake, auth_header, monkeypatch, capsys):
    before = seed_other_roadmaps(supabase_fake)
    make_fail(monkeypatch, supabase_fake, "tasks", "insert", RuntimeError("tasks insert failed"))
    make_fail(monkeypatch, supabase_fake, "roadmaps", "delete", RuntimeError("database unavailable"))

    response = generate(client, gemini_fake, auth_header)

    assert response.status_code == 500
    assert response.json() == {"detail": "Error generating recommendations: tasks insert failed"}
    [new_roadmap] = [r for r in supabase_fake.rows("roadmaps") if r not in before["roadmaps"]]
    assert new_roadmap["user_id"] == USER_A
    assert f"[roadmap] Could not discard roadmap {new_roadmap['id']}: RuntimeError('database unavailable')" in capsys.readouterr().out

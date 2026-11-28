"""The problem service: replacing a roadmap's tasks, and discarding a roadmap.

The generate_and_save_recommendations tests pin what that function does for
its remaining caller: it chooses the problems, deletes the roadmap's existing
tasks, then saves a task per week and an empty progress row per task. Any
failure becomes a 500 whose detail starts with "Error generating
recommendations: ".
"""

import pytest
from fastapi import HTTPException

import tools
from services.problem_service import discard_roadmap, generate_and_save_recommendations
from tests.fakes import FakeResponse

USER_A = "00000000-0000-4000-8000-00000000000a"
USER_B = "00000000-0000-4000-8000-00000000000b"

ROADMAP_DATA = [
    {"week": 1, "DSA": {"Arrays": "Basic"}, "Other": {"Operating Systems": "Basic"}},
    {"week": 2, "DSA": {"Graphs": "Advanced"}},
]
USER_INPUT = {"weekly_hours": 2}


@pytest.fixture
def roadmaps(supabase_fake):
    """Two roadmaps of the caller and one of another user, each with one old task."""
    rows = supabase_fake.seed("roadmaps", [{"user_id": USER_A}, {"user_id": USER_A}, {"user_id": USER_B}])
    for roadmap in rows:
        supabase_fake.seed("tasks", [{"roadmap_id": roadmap["id"], "week": 9, "lc_problem_ids": [1], "other_topics": []}])
    return [roadmap["id"] for roadmap in rows]


class NoRows:
    """An insert whose execute() returns no rows."""

    def execute(self):
        return FakeResponse([])


def make_inserts_return_no_rows(monkeypatch, supabase_fake, table):
    real_table = supabase_fake.table

    def table_with_empty_inserts(name):
        query = real_table(name)
        if name == table:
            query.insert = lambda rows: NoRows()
        return query

    monkeypatch.setattr(supabase_fake, "table", table_with_empty_inserts)


def test_replaces_the_roadmaps_tasks_and_adds_a_progress_row_per_task(supabase_fake, roadmaps):
    target, other_own, others = roadmaps
    expected_weeks = tools.ProblemRecommendationTool()._run(
        roadmap_data=ROADMAP_DATA, company="google", user_input=USER_INPUT
    )

    result = generate_and_save_recommendations(
        roadmap_id=target, roadmap_data=ROADMAP_DATA, company="google", user_input=USER_INPUT, user_id=USER_A
    )

    assert result == expected_weeks
    tasks = supabase_fake.rows("tasks")
    assert sorted(t["roadmap_id"] for t in tasks if t["week"] == 9) == sorted([other_own, others])
    new_tasks = [t for t in tasks if t["roadmap_id"] == target]
    assert [(t["week"], t["lc_problem_ids"], t["other_topics"]) for t in new_tasks] == [
        (1, expected_weeks[0]["problems"], ["Operating Systems"]),
        (2, expected_weeks[1]["problems"], []),
    ]
    progress = supabase_fake.rows("progress")
    assert [(p["roadmap_id"], p["task_id"], p["user_id"]) for p in progress] == [
        (target, task["id"], USER_A) for task in new_tasks
    ]
    assert [p["completed"] for p in progress] == [
        {"problems": {str(i): False for i in task["lc_problem_ids"]}, "topics": {t: False for t in task["other_topics"]}}
        for task in new_tasks
    ]
    assert {(p["completion_percentage"], p["completed_problem_count"]) for p in progress} == {(0, 0)}
    assert [p["total_problem_count"] for p in progress] == [len(t["lc_problem_ids"]) for t in new_tasks]


def test_wraps_an_error_from_the_recommendation_tool_and_changes_nothing(supabase_fake, roadmaps, monkeypatch):
    before = supabase_fake.rows("tasks")

    def fail(self, *args, **kwargs):
        raise ValueError("tool failed")

    monkeypatch.setattr(tools.ProblemRecommendationTool, "_run", fail)

    with pytest.raises(HTTPException) as raised:
        generate_and_save_recommendations(
            roadmap_id=roadmaps[0], roadmap_data=ROADMAP_DATA, company=None, user_input=USER_INPUT, user_id=USER_A
        )

    assert raised.value.status_code == 500
    assert raised.value.detail == "Error generating recommendations: tool failed"
    assert supabase_fake.rows("tasks") == before
    assert supabase_fake.rows("progress") == []


def test_wraps_a_task_insert_that_returns_no_rows(supabase_fake, roadmaps, monkeypatch):
    make_inserts_return_no_rows(monkeypatch, supabase_fake, "tasks")

    with pytest.raises(HTTPException) as raised:
        generate_and_save_recommendations(
            roadmap_id=roadmaps[0], roadmap_data=ROADMAP_DATA, company=None, user_input=USER_INPUT, user_id=USER_A
        )

    assert raised.value.status_code == 500
    assert raised.value.detail == "Error generating recommendations: 500: Failed to save tasks to database"
    assert supabase_fake.rows("progress") == []


def test_wraps_a_progress_insert_that_returns_no_rows(supabase_fake, roadmaps, monkeypatch):
    make_inserts_return_no_rows(monkeypatch, supabase_fake, "progress")

    with pytest.raises(HTTPException) as raised:
        generate_and_save_recommendations(
            roadmap_id=roadmaps[0], roadmap_data=ROADMAP_DATA, company=None, user_input=USER_INPUT, user_id=USER_A
        )

    assert raised.value.status_code == 500
    assert raised.value.detail == "Error generating recommendations: 500: Failed to save progress entries"


def seed_roadmap(supabase_fake, user_id):
    """A roadmap of `user_id` with one task and that user's progress row for it."""
    [roadmap] = supabase_fake.seed("roadmaps", [{"user_id": user_id}])
    [task] = supabase_fake.seed("tasks", [{"roadmap_id": roadmap["id"], "week": 1, "lc_problem_ids": [1], "other_topics": []}])
    supabase_fake.seed("progress", [{"roadmap_id": roadmap["id"], "task_id": task["id"], "user_id": user_id}])
    return roadmap["id"]


def test_discard_roadmap_deletes_that_roadmap_with_its_tasks_and_the_users_progress(supabase_fake):
    target = seed_roadmap(supabase_fake, USER_A)
    kept = [seed_roadmap(supabase_fake, USER_A), seed_roadmap(supabase_fake, USER_B)]
    # A progress row of another user on the same roadmap is not the caller's to delete.
    supabase_fake.seed("progress", [{"roadmap_id": target, "task_id": None, "user_id": USER_B}])

    discard_roadmap(target, USER_A)

    assert [r["id"] for r in supabase_fake.rows("roadmaps")] == kept
    assert [t["roadmap_id"] for t in supabase_fake.rows("tasks")] == kept
    assert [(p["roadmap_id"], p["user_id"]) for p in supabase_fake.rows("progress")] == [
        (kept[0], USER_A),
        (kept[1], USER_B),
        (target, USER_B),
    ]


def test_discard_roadmap_deletes_nothing_for_another_users_roadmap(supabase_fake):
    seed_roadmap(supabase_fake, USER_A)
    other = seed_roadmap(supabase_fake, USER_B)
    before = {table: supabase_fake.rows(table) for table in ("roadmaps", "tasks", "progress")}

    discard_roadmap(other, USER_A)

    assert {table: supabase_fake.rows(table) for table in ("roadmaps", "tasks", "progress")} == before

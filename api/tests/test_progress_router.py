"""Status codes of the progress routes that look up a task or a roadmap.

A 4xx raised inside one of these handlers must reach the client as that 4xx,
not as a 500 that wraps it.
"""

USER_A = "00000000-0000-4000-8000-00000000000a"
USER_B = "00000000-0000-4000-8000-00000000000b"
MISSING_ID = 999_999


def seed_task(supabase_fake, owner, *, problems=(1, 2), topics=("Arrays",), with_progress=True):
    roadmap = supabase_fake.seed("roadmaps", [{"user_id": owner, "company": None}])[0]
    task = supabase_fake.seed(
        "tasks",
        [{"roadmap_id": roadmap["id"], "week": 1, "lc_problem_ids": list(problems), "other_topics": list(topics)}],
    )[0]
    progress = None
    if with_progress:
        progress = supabase_fake.seed(
            "progress",
            [
                {
                    "task_id": task["id"],
                    "roadmap_id": roadmap["id"],
                    "user_id": owner,
                    "completed": {
                        "problems": {str(p): False for p in problems},
                        "topics": {t: False for t in topics},
                    },
                    "total_problem_count": len(problems),
                    "completed_problem_count": 0,
                    "completion_percentage": 0,
                }
            ],
        )[0]
    return roadmap, task, progress


# GET /api/progress/task/{task_id}


def test_task_progress_is_404_for_a_task_that_does_not_exist(client, auth_header):
    response = client.get(f"/api/progress/task/{MISSING_ID}", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_task_progress_is_403_for_another_users_task(client, supabase_fake, auth_header):
    _, task, _ = seed_task(supabase_fake, USER_B)

    response = client.get(f"/api/progress/task/{task['id']}", headers=auth_header(USER_A))

    assert response.status_code == 403
    assert response.json() == {"detail": "Not authorized to access this task"}


def test_task_progress_is_404_when_the_task_has_no_progress_row(client, supabase_fake, auth_header):
    _, task, _ = seed_task(supabase_fake, USER_A, with_progress=False)

    response = client.get(f"/api/progress/task/{task['id']}", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == {"detail": "Progress not found for this task"}


def test_task_progress_returns_the_callers_row(client, supabase_fake, auth_header):
    _, task, progress = seed_task(supabase_fake, USER_A)

    response = client.get(f"/api/progress/task/{task['id']}", headers=auth_header(USER_A))

    assert response.status_code == 200
    assert response.json() == progress


# GET /api/progress/roadmap/{roadmap_id}


def test_roadmap_progress_is_404_for_a_roadmap_that_does_not_exist(client, auth_header):
    response = client.get(f"/api/progress/roadmap/{MISSING_ID}", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == {"detail": "Roadmap not found or not authorized"}


def test_roadmap_progress_is_404_for_another_users_roadmap(client, supabase_fake, auth_header):
    roadmap, _, _ = seed_task(supabase_fake, USER_B)

    response = client.get(f"/api/progress/roadmap/{roadmap['id']}", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == {"detail": "Roadmap not found or not authorized"}


def test_roadmap_progress_returns_the_callers_entries(client, supabase_fake, auth_header):
    roadmap, _, progress = seed_task(supabase_fake, USER_A)

    response = client.get(f"/api/progress/roadmap/{roadmap['id']}", headers=auth_header(USER_A))

    assert response.status_code == 200
    assert response.json() == {"progress_entries": [progress]}


# PUT /api/progress/task/{task_id}/complete


def complete(client, auth_header, task_id, body, user=USER_A):
    return client.put(f"/api/progress/task/{task_id}/complete", json=body, headers=auth_header(user))


def test_complete_is_404_for_a_task_that_does_not_exist(client, auth_header):
    response = complete(client, auth_header, MISSING_ID, {"type": "problem", "id": "1", "completed": True})

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_complete_is_403_for_another_users_task_and_changes_nothing(client, supabase_fake, auth_header):
    _, task, _ = seed_task(supabase_fake, USER_B)
    before = supabase_fake.rows("progress")

    response = complete(client, auth_header, task["id"], {"type": "problem", "id": "1", "completed": True})

    assert response.status_code == 403
    assert response.json() == {"detail": "Not authorized to access this task"}
    assert supabase_fake.rows("progress") == before
    assert supabase_fake.rows("problem_completions") == []


def test_complete_is_404_when_the_task_has_no_progress_row(client, supabase_fake, auth_header):
    _, task, _ = seed_task(supabase_fake, USER_A, with_progress=False)

    response = complete(client, auth_header, task["id"], {"type": "problem", "id": "1", "completed": True})

    assert response.status_code == 404
    assert response.json() == {"detail": "Progress not found for this task"}


def test_complete_is_400_for_a_problem_that_is_not_in_the_task(client, supabase_fake, auth_header):
    _, task, _ = seed_task(supabase_fake, USER_A, problems=(1, 2))

    response = complete(client, auth_header, task["id"], {"type": "problem", "id": "3", "completed": True})

    assert response.status_code == 400
    assert response.json() == {"detail": "Problem ID not found in task"}


def test_complete_is_400_for_a_topic_that_is_not_in_the_task(client, supabase_fake, auth_header):
    _, task, _ = seed_task(supabase_fake, USER_A, topics=("Arrays",))

    response = complete(client, auth_header, task["id"], {"type": "topic", "id": "Graphs", "completed": True})

    assert response.status_code == 400
    assert response.json() == {"detail": "Topic not found in task"}


def test_complete_is_400_for_an_unknown_item_type(client, supabase_fake, auth_header):
    _, task, _ = seed_task(supabase_fake, USER_A)

    response = complete(client, auth_header, task["id"], {"type": "video", "id": "1", "completed": True})

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid type. Must be 'problem' or 'topic'"}


def test_complete_marks_a_problem_done_for_the_caller(client, supabase_fake, auth_header):
    _, task, progress = seed_task(supabase_fake, USER_A, problems=(1, 2))

    response = complete(client, auth_header, task["id"], {"type": "problem", "id": "1", "completed": True})

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Progress updated successfully"
    assert body["progress"]["id"] == progress["id"]
    assert body["progress"]["completed"]["problems"] == {"1": True, "2": False}
    assert body["progress"]["completed_problem_count"] == 1
    assert body["progress"]["completion_percentage"] == 50
    assert supabase_fake.rows("progress") == [body["progress"]]

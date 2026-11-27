"""Status codes of the problem routes that look up a roadmap or one of its weeks.

A 4xx raised inside one of these handlers must reach the client as that 4xx,
not as a 500 that wraps it. Another user's roadmap answers 404, like a
missing one, and is left as it was.
"""

USER_A = "00000000-0000-4000-8000-00000000000a"
USER_B = "00000000-0000-4000-8000-00000000000b"
MISSING_ID = 999_999
NOT_FOUND = {"detail": "Roadmap not found or not authorized"}
NO_WEEK = {"detail": "Task not found for the specified week"}


def seed_roadmap(supabase_fake, owner, weeks=(1, 2)):
    roadmap = supabase_fake.seed("roadmaps", [{"user_id": owner, "company": None}])[0]
    tasks = supabase_fake.seed(
        "tasks",
        [
            {"roadmap_id": roadmap["id"], "week": week, "lc_problem_ids": [week * 10], "other_topics": []}
            for week in weeks
        ],
    )
    return roadmap, tasks


# GET /api/problems/{roadmap_id}


def test_list_tasks_is_404_for_a_roadmap_that_does_not_exist(client, auth_header):
    response = client.get(f"/api/problems/{MISSING_ID}", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NOT_FOUND


def test_list_tasks_is_404_for_another_users_roadmap(client, supabase_fake, auth_header):
    roadmap, _ = seed_roadmap(supabase_fake, USER_B)

    response = client.get(f"/api/problems/{roadmap['id']}", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NOT_FOUND


def test_list_tasks_returns_the_roadmaps_tasks(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_A)
    seed_roadmap(supabase_fake, USER_A, weeks=(1,))

    response = client.get(f"/api/problems/{roadmap['id']}", headers=auth_header(USER_A))

    assert response.status_code == 200
    assert response.json() == {"tasks": tasks}


# GET /api/problems/{roadmap_id}/week/{week}


def test_get_week_is_404_for_another_users_roadmap(client, supabase_fake, auth_header):
    roadmap, _ = seed_roadmap(supabase_fake, USER_B)

    response = client.get(f"/api/problems/{roadmap['id']}/week/1", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NOT_FOUND


def test_get_week_is_404_for_a_week_the_roadmap_does_not_have(client, supabase_fake, auth_header):
    roadmap, _ = seed_roadmap(supabase_fake, USER_A, weeks=(1, 2))

    response = client.get(f"/api/problems/{roadmap['id']}/week/3", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NO_WEEK


def test_get_week_returns_that_weeks_task(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_A, weeks=(1, 2))

    response = client.get(f"/api/problems/{roadmap['id']}/week/2", headers=auth_header(USER_A))

    assert response.status_code == 200
    assert response.json() == {"task": tasks[1]}


# DELETE /api/problems/{roadmap_id}


def test_delete_all_is_404_for_another_users_roadmap_and_deletes_nothing(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_B)

    response = client.delete(f"/api/problems/{roadmap['id']}", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NOT_FOUND
    assert supabase_fake.rows("tasks") == tasks


def test_delete_all_deletes_the_roadmaps_tasks(client, supabase_fake, auth_header):
    roadmap, _ = seed_roadmap(supabase_fake, USER_A)
    _, other_tasks = seed_roadmap(supabase_fake, USER_A, weeks=(1,))

    response = client.delete(f"/api/problems/{roadmap['id']}", headers=auth_header(USER_A))

    assert response.status_code == 200
    assert response.json() == {"message": "All tasks deleted successfully"}
    assert supabase_fake.rows("tasks") == other_tasks


# DELETE /api/problems/{roadmap_id}/week/{week}


def test_delete_week_is_404_for_another_users_roadmap_and_deletes_nothing(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_B)

    response = client.delete(f"/api/problems/{roadmap['id']}/week/1", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NOT_FOUND
    assert supabase_fake.rows("tasks") == tasks


def test_delete_week_is_404_for_a_week_the_roadmap_does_not_have(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_A, weeks=(1, 2))

    response = client.delete(f"/api/problems/{roadmap['id']}/week/3", headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NO_WEEK
    assert supabase_fake.rows("tasks") == tasks


def test_delete_week_deletes_only_that_week(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_A, weeks=(1, 2))

    response = client.delete(f"/api/problems/{roadmap['id']}/week/1", headers=auth_header(USER_A))

    assert response.status_code == 200
    assert response.json() == {"message": "Tasks for week 1 deleted successfully"}
    assert supabase_fake.rows("tasks") == [tasks[1]]


# PUT /api/problems/{roadmap_id}/week/{week}

NEW_WEEK = {"lc_problem_ids": ["7", "8"], "other_topics": ["Operating Systems"]}


def test_update_week_is_404_for_another_users_roadmap_and_changes_nothing(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_B)

    response = client.put(f"/api/problems/{roadmap['id']}/week/1", json=NEW_WEEK, headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NOT_FOUND
    assert supabase_fake.rows("tasks") == tasks


def test_update_week_is_404_for_a_week_the_roadmap_does_not_have(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_A, weeks=(1, 2))

    response = client.put(f"/api/problems/{roadmap['id']}/week/3", json=NEW_WEEK, headers=auth_header(USER_A))

    assert response.status_code == 404
    assert response.json() == NO_WEEK
    assert supabase_fake.rows("tasks") == tasks


def test_update_week_replaces_that_weeks_problems(client, supabase_fake, auth_header):
    roadmap, tasks = seed_roadmap(supabase_fake, USER_A, weeks=(1, 2))

    response = client.put(f"/api/problems/{roadmap['id']}/week/1", json=NEW_WEEK, headers=auth_header(USER_A))

    assert response.status_code == 200
    updated = {**tasks[0], **NEW_WEEK}
    assert response.json() == {"task": updated}
    assert supabase_fake.rows("tasks") == [updated, tasks[1]]

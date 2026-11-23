from datetime import UTC, datetime, timedelta, timezone

from routers.analytics_router import _compute_roadmap_progress, _start_of_week

CREATED = datetime(2026, 11, 2, tzinfo=UTC)

# Problems in dataset/leetcode-problems.csv used below:
# 1 Two Sum (Easy; Array, Hash Table)
# 2 Add Two Numbers (Medium; Linked List, Math, Recursion)
# 3 Longest Substring Without Repeating Characters (Medium; Hash Table, Two Pointers, String, Sliding Window)
# 4 Median of Two Sorted Arrays (Hard; Array, Binary Search, Divide and Conquer)


def _roadmap(weeks=4, deadline=None):
    user_input = {"goal": "Prepare for interviews", "weeks": weeks}
    if deadline is not None:
        user_input["deadline"] = deadline
    return {
        "id": 7,
        "company": "google",
        "created_at": CREATED.isoformat().replace("+00:00", "Z"),
        "user_input": user_input,
    }


def _tasks():
    # Out of order on purpose: the helper sorts by week.
    return [
        {"id": 11, "week": 2, "lc_problem_ids": [2, 4]},
        {"id": 10, "week": 1, "lc_problem_ids": [1, 3]},
    ]


def _progress(done_ids, task_id=10, total=2):
    return {
        "task_id": task_id,
        "completed": {
            "problems": {str(pid): True for pid in done_ids},
            "topics": {"Arrays": True, "Hashing": False},
        },
        "total_problem_count": total,
        "completed_problem_count": len(done_ids),
        "positive_feedback": "Steady start",
        "negative_feedback": None,
    }


def test_progress_rolls_up_weeks_difficulties_and_topics():
    result = _compute_roadmap_progress(_roadmap(), _tasks(), [_progress([1])], now=CREATED)

    assert result["roadmap_id"] == 7
    assert result["goal"] == "Prepare for interviews"
    assert result["company"] == "google"
    assert result["total_weeks"] == 4
    assert result["overall"] == {"completed": 1, "total": 4, "percentage": 25}
    assert result["weeks"] == [
        {
            "week": 1,
            "task_id": 10,
            "completed": 1,
            "total": 2,
            "percentage": 50,
            "topics_completed": 1,
            "topics_total": 2,
            "positive_feedback": "Steady start",
            "negative_feedback": None,
        },
        {
            "week": 2,
            "task_id": 11,
            "completed": 0,
            "total": 2,
            "percentage": 0,
            "topics_completed": 0,
            "topics_total": 0,
            "positive_feedback": None,
            "negative_feedback": None,
        },
    ]
    assert result["difficulty_breakdown"] == [
        {"name": "Easy", "completed": 1, "total": 1},
        {"name": "Medium", "completed": 0, "total": 2},
        {"name": "Hard", "completed": 0, "total": 1},
    ]
    # Only topics assigned at least twice are rated: Array (problems 1, 4) and
    # Hash Table (problems 1, 3), each half done.
    assert result["strong_topics"] == []
    assert sorted(result["weak_topics"], key=lambda t: t["name"]) == [
        {"name": "Array", "completed": 1, "total": 2, "percentage": 50},
        {"name": "Hash Table", "completed": 1, "total": 2, "percentage": 50},
    ]


def test_progress_rates_a_topic_strong_at_sixty_percent_or_more():
    result = _compute_roadmap_progress(_roadmap(), _tasks(), [_progress([1, 3])], now=CREATED)

    assert result["strong_topics"] == [{"name": "Hash Table", "completed": 2, "total": 2, "percentage": 100}]
    assert [t["name"] for t in result["weak_topics"]] == ["Array"]


def test_pace_has_no_data_when_no_problems_are_assigned():
    tasks = [{"id": 10, "week": 1, "lc_problem_ids": []}]

    result = _compute_roadmap_progress(_roadmap(), tasks, [], now=CREATED)

    assert result["overall"] == {"completed": 0, "total": 0, "percentage": 0}
    assert result["pace"]["status"] == "no_data"


def test_pace_is_ahead_when_everything_is_done_on_day_one():
    done = [_progress([1, 3]), _progress([2, 4], task_id=11)]

    result = _compute_roadmap_progress(_roadmap(), _tasks(), done, now=CREATED)

    assert result["overall"]["percentage"] == 100
    assert result["pace"]["status"] == "ahead"


def test_pace_is_behind_when_nothing_is_done_after_the_plan_has_ended():
    result = _compute_roadmap_progress(_roadmap(weeks=4), _tasks(), [], now=CREATED + timedelta(days=60))

    assert result["pace"]["elapsed_weeks"] == 4
    assert result["pace"]["expected_percentage"] == 100
    assert result["pace"]["delta"] == -100
    assert result["pace"]["status"] == "behind"


def test_days_remaining_counts_to_the_deadline_taken_as_utc():
    result = _compute_roadmap_progress(
        _roadmap(deadline="2026-12-31"), _tasks(), [], now=datetime(2026, 12, 1, tzinfo=UTC)
    )

    assert result["deadline"] == "2026-12-31"
    assert result["pace"]["days_remaining"] == 30


def test_days_remaining_is_none_for_an_unreadable_deadline():
    result = _compute_roadmap_progress(_roadmap(deadline="next spring"), _tasks(), [], now=CREATED)

    assert result["pace"]["days_remaining"] is None


def test_start_of_week_is_monday_midnight_utc():
    assert _start_of_week(datetime(2026, 11, 25, 15, 30, tzinfo=UTC)) == datetime(2026, 11, 23, tzinfo=UTC)


def test_start_of_week_keeps_a_monday_midnight():
    monday = datetime(2026, 11, 23, tzinfo=UTC)

    assert _start_of_week(monday) == monday


def test_start_of_week_puts_sunday_night_in_the_week_that_began_on_monday():
    assert _start_of_week(datetime(2026, 11, 29, 23, 59, 59, tzinfo=UTC)) == datetime(2026, 11, 23, tzinfo=UTC)


def test_start_of_week_converts_other_time_zones_to_utc_first():
    # Monday 02:00 in India is still Sunday 20:30 in UTC.
    india = timezone(timedelta(hours=5, minutes=30))

    result = _start_of_week(datetime(2026, 11, 30, 2, 0, tzinfo=india))

    assert result == datetime(2026, 11, 23, tzinfo=UTC)
    assert result.utcoffset() == timedelta(0)

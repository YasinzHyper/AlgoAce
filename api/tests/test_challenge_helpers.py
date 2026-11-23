import pandas as pd
import pytest

from routers import challenge_router
from routers.challenge_router import _score_challenge, _select_problems

# Problems in dataset/leetcode-problems.csv used below:
# 1 Two Sum (Easy), 2 Add Two Numbers (Medium), 4 Median of Two Sorted Arrays (Hard).
EASY, MEDIUM, HARD = 1, 2, 4
NOT_IN_DATASET = 999_999


def test_score_weights_solves_by_difficulty_and_adds_a_time_bonus():
    result = _score_challenge(
        problem_ids=[EASY, MEDIUM, HARD, 3],
        solved_ids=[EASY, MEDIUM, HARD],
        duration_minutes=30,
        elapsed_seconds=15 * 60,
    )

    # 10 + 25 + 50 points; half the time left gives half of the 50% bonus.
    assert result == {"score": 106, "base_points": 85, "time_bonus": 21, "solved": 3, "total": 4}


def test_score_gives_the_full_bonus_when_finished_at_once():
    result = _score_challenge(
        problem_ids=[EASY], solved_ids=[EASY], duration_minutes=10, elapsed_seconds=0
    )

    assert result["base_points"] == 10
    assert result["time_bonus"] == 5
    assert result["score"] == 15


def test_score_gives_no_bonus_once_time_has_run_out():
    result = _score_challenge(
        problem_ids=[HARD], solved_ids=[HARD], duration_minutes=10, elapsed_seconds=20 * 60
    )

    assert result["time_bonus"] == 0
    assert result["score"] == 50


def test_score_is_zero_without_solves():
    result = _score_challenge(
        problem_ids=[EASY, MEDIUM], solved_ids=[], duration_minutes=30, elapsed_seconds=60
    )

    assert result == {"score": 0, "base_points": 0, "time_bonus": 0, "solved": 0, "total": 2}


def test_score_counts_a_problem_missing_from_the_dataset_as_medium():
    result = _score_challenge(
        problem_ids=[NOT_IN_DATASET],
        solved_ids=[NOT_IN_DATASET],
        duration_minutes=10,
        elapsed_seconds=10 * 60,
    )

    assert result["base_points"] == 25


@pytest.fixture
def small_dataset(monkeypatch):
    rows = [
        (1, "One", "Easy", "Array,Hash Table"),
        (2, "Two", "Medium", "Linked List,Math"),
        (3, "Three", "Easy", "Array"),
        (4, "Four", "Hard", "Array,Binary Search"),
        (5, "Five", "Medium", "String"),
        (6, "Six", "Easy", None),
    ]
    df = pd.DataFrame(
        [(*row, 50.0, "Google") for row in rows],
        columns=["id", "title", "difficulty", "related_topics", "acceptance_rate", "companies"],
    ).set_index("id", drop=False)
    monkeypatch.setattr(challenge_router, "_ch_problems_df", df)


def test_select_takes_problems_matching_topic_and_difficulty(small_dataset):
    ids = _select_problems(focus_topics=["Array"], difficulty="Easy", count=2, exclude_ids=set())

    assert sorted(ids) == [1, 3]
    assert all(type(i) is int for i in ids)


def test_select_matches_topics_and_difficulty_case_insensitively(small_dataset):
    ids = _select_problems(focus_topics=["array"], difficulty="EASY", count=2, exclude_ids=set())

    assert sorted(ids) == [1, 3]


def test_select_skips_excluded_problems_and_then_relaxes_the_difficulty(small_dataset):
    ids = _select_problems(focus_topics=["Array"], difficulty="Easy", count=2, exclude_ids={1})

    assert sorted(ids) == [3, 4]


def test_select_treats_mixed_difficulty_as_any(small_dataset):
    ids = _select_problems(focus_topics=["Array"], difficulty="Mixed", count=3, exclude_ids=set())

    assert sorted(ids) == [1, 3, 4]


def test_select_falls_back_to_any_topic_when_nothing_matches(small_dataset):
    ids = _select_problems(focus_topics=["Graph"], difficulty="Hard", count=2, exclude_ids={4})

    assert len(ids) == 2
    assert len(set(ids)) == 2
    assert set(ids) <= {1, 2, 3, 5, 6}


def test_select_returns_fewer_problems_when_the_pool_runs_out(small_dataset):
    ids = _select_problems(focus_topics=[], difficulty=None, count=10, exclude_ids={1, 2})

    assert sorted(ids) == [3, 4, 5, 6]


def test_select_returns_nothing_without_a_dataset(monkeypatch):
    monkeypatch.setattr(challenge_router, "_ch_problems_df", pd.DataFrame())

    assert _select_problems(focus_topics=["Array"], difficulty="Easy", count=3, exclude_ids=set()) == []


def test_select_against_the_real_dataset():
    ids = _select_problems(focus_topics=["Array"], difficulty="Easy", count=5, exclude_ids={EASY})

    assert len(ids) == 5
    assert EASY not in ids
    rows = challenge_router._ch_problems_df.loc[ids]
    assert set(rows["difficulty"]) == {"Easy"}
    assert all("Array" in [t.strip() for t in topics.split(",")] for topics in rows["related_topics"])

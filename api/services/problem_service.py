from tools import ProblemRecommendationTool
from supabase_client import supabase
from fastapi import HTTPException

def generate_recommendations(roadmap_data: list, company: str | None, user_input: dict):
    """Choose problems from the dataset for each week of a roadmap. Saves nothing."""
    # Initialize and run the recommendation tool
    tool = ProblemRecommendationTool()
    return tool._run(
        roadmap_data=roadmap_data,
        company=company,
        user_input=user_input
    )

def save_recommendations(roadmap_id: int, problems_per_week: list, user_id: str):
    """Insert a task for each week, and an empty progress row for each task."""
    # Prepare tasks to insert into the tasks table
    tasks_to_insert = [
        {
            "roadmap_id": roadmap_id,
            "week": week_data["week"],
            "lc_problem_ids": week_data["problems"],
            "other_topics": week_data.get("other_topics", [])
        }
        for week_data in problems_per_week
    ]

    # Insert new tasks into the tasks table
    insert_response = supabase.table("tasks").insert(tasks_to_insert).execute()
    if not insert_response.data:
        raise HTTPException(status_code=500, detail="Failed to save tasks to database")

    inserted_tasks = insert_response.data
    progress_entries = []
    for inserted_task in inserted_tasks:
        task_id = inserted_task['id']
        lc_problem_ids = inserted_task['lc_problem_ids']
        other_topics = inserted_task.get('other_topics', [])
        completed = {
            "problems": {str(problem_id): False for problem_id in lc_problem_ids},
            "topics": {topic: False for topic in other_topics}
        }
        progress_entry = {
            "roadmap_id": roadmap_id,
            "task_id": task_id,
            "user_id": user_id,
            "completed": completed,
            "completion_percentage": 0,
            "total_problem_count": len(lc_problem_ids),
            "completed_problem_count": 0,
            "positive_feedback": None,
            "negative_feedback": None,
        }
        progress_entries.append(progress_entry)

    progress_response = supabase.table("progress").insert(progress_entries).execute()
    if not progress_response.data:
        raise HTTPException(status_code=500, detail="Failed to save progress entries")

def discard_roadmap(roadmap_id: int, user_id: str):
    """Delete a roadmap that was just saved, with its tasks and progress rows.

    For undoing a save that failed part way. Nothing is deleted unless the
    roadmap belongs to the user, and each delete is filtered by the roadmap's
    id, and by the user's id where the table has that column. A failure is
    logged, not raised, so the caller can still report the error that made it
    clean up.
    """
    try:
        owned = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user_id).execute()
        if not owned.data:
            return
        supabase.table("progress").delete().eq("roadmap_id", roadmap_id).eq("user_id", user_id).execute()
        supabase.table("tasks").delete().eq("roadmap_id", roadmap_id).execute()
        supabase.table("roadmaps").delete().eq("id", roadmap_id).eq("user_id", user_id).execute()
    except Exception as e:
        print(f"[roadmap] Could not discard roadmap {roadmap_id}: {e!r}")

def generate_and_save_recommendations(roadmap_id: int, roadmap_data: list, company: str | None, user_input: dict, user_id: str):
    try:
        problems_per_week = generate_recommendations(
            roadmap_data=roadmap_data,
            company=company,
            user_input=user_input
        )

        # Delete existing tasks for this roadmap to avoid duplicates
        supabase.table("tasks").delete().eq("roadmap_id", roadmap_id).execute()

        save_recommendations(roadmap_id, problems_per_week, user_id)

        return problems_per_week
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

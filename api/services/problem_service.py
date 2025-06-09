from tools import ProblemRecommendationTool
from supabase_client import supabase
from fastapi import HTTPException

def generate_and_save_recommendations(roadmap_id: int, roadmap_data: list, company: str | None, user_input: dict, user_id: str):
    try:
        # Initialize and run the recommendation tool
        tool = ProblemRecommendationTool()
        problems_per_week = tool._run(
            roadmap_data=roadmap_data,
            company=company,
            user_input=user_input
        )

        # Delete existing tasks for this roadmap to avoid duplicates
        supabase.table("tasks").delete().eq("roadmap_id", roadmap_id).execute()

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

        return problems_per_week
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")
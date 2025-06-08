from tools import ProblemRecommendationTool
from supabase_client import supabase
from fastapi import HTTPException

def generate_and_save_recommendations(roadmap_id: int, roadmap_data: list, company: str | None, user_input: dict):
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

        return problems_per_week
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")
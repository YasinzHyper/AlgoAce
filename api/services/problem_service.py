from tools import ProblemRecommendationTool, OSRecommendationTool, merge_week_recommendations
from supabase_client import supabase
from fastapi import HTTPException
import json
import os


def generate_and_save_recommendations(
    roadmap_id: int,
    roadmap_data: list,
    company: str | None,
    user_input: dict,
    user_id: str,
):
    try:
        subjects = user_input.get("subjects", "both")
        print(f"DEBUG: Generating recommendations for subjects={subjects}")

        lc_weeks = []
        if subjects in ("dsa", "both"):
            try:
                lc_tool = ProblemRecommendationTool()
                lc_weeks = lc_tool._run(
                    roadmap_data=roadmap_data,
                    company=company,
                    user_input=user_input,
                )
                print(f"DEBUG: LC weeks generated: {len(lc_weeks)} weeks")
            except Exception as e:
                print(f"DEBUG: Error in LC tool: {str(e)}")
                lc_weeks = []

        os_weeks = []
        if subjects in ("os", "both"):
            try:
                os_tool = OSRecommendationTool()
                os_weeks = os_tool._run(
                    roadmap_data=roadmap_data,
                    company=company,
                    user_input=user_input,
                )
                print(f"DEBUG: OS weeks generated: {len(os_weeks)} weeks")
            except Exception as e:
                print(f"DEBUG: Error in OS tool: {str(e)}")
                os_weeks = []

        print(f"DEBUG: Before merge - lc_weeks={lc_weeks}, os_weeks={os_weeks}")
        problems_per_week = merge_week_recommendations(lc_weeks, os_weeks)
        print(f"DEBUG: After merge - problems_per_week has {len(problems_per_week)} weeks")
        
        if not problems_per_week:
            raise HTTPException(
                status_code=500,
                detail="No weekly tasks could be generated for the selected subjects.",
            )

        supabase.table("tasks").delete().eq("roadmap_id", roadmap_id).execute()

        tasks_to_insert = []
        roadmap_metadata = {}  # Store os_item_ids separately
        
        for week_data in problems_per_week:
            task = {
                "roadmap_id": roadmap_id,
                "week": week_data["week"],
                "lc_problem_ids": week_data.get("problems", []),
                "other_topics": week_data.get("other_topics", []),
            }
            
            # Store os_item_ids in metadata (to be saved separately) 
            os_ids = week_data.get("os_item_ids", [])
            if os_ids:
                roadmap_metadata[week_data["week"]] = os_ids
                # Also add os_ids to other_topics temporarily for display
                # Format: "OS_ITEM_ID:123,OS_ITEM_ID:456"
                os_item_labels = [f"OS_ITEM_ID:{int(id)}" for id in os_ids]
                task["other_topics"] = task["other_topics"] + os_item_labels
            
            tasks_to_insert.append(task)
        
        print(f"DEBUG: Tasks to insert: {tasks_to_insert}")
        print(f"DEBUG: Roadmap metadata: {roadmap_metadata}")

        insert_response = supabase.table("tasks").insert(tasks_to_insert).execute()
        print(f"DEBUG: Insert response: {insert_response}")
        if not insert_response.data:
            raise HTTPException(status_code=500, detail="Failed to save tasks to database")

        # Save OS item IDs to file system (metadata directory) - always save for debugging
        metadata_dir = os.path.join(os.path.dirname(__file__), "..", "data", "roadmap_metadata")
        os.makedirs(metadata_dir, exist_ok=True)
        metadata_file = os.path.join(metadata_dir, f"roadmap_{roadmap_id}_os.json")
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(roadmap_metadata, f)
        print(f"DEBUG: Saved OS metadata to {metadata_file}: {roadmap_metadata}")

        inserted_tasks = insert_response.data
        progress_entries = []
        for inserted_task in inserted_tasks:
            task_id = inserted_task["id"]
            lc_problem_ids = inserted_task.get("lc_problem_ids") or []
            other_topics = inserted_task.get("other_topics") or []
            os_item_ids = inserted_task.get("os_item_ids") or []
            completed = {
                "problems": {str(problem_id): False for problem_id in lc_problem_ids},
                "topics": {topic: False for topic in other_topics},
                "os_items": {str(item_id): False for item_id in os_item_ids},
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

        print(f"DEBUG: Progress entries: {progress_entries}")
        progress_response = supabase.table("progress").insert(progress_entries).execute()
        print(f"DEBUG: Progress response: {progress_response}")
        if not progress_response.data:
            raise HTTPException(status_code=500, detail="Failed to save progress entries")

        return problems_per_week
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

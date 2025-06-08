from fastapi import APIRouter, Depends, HTTPException, Header
from supabase_client import supabase
from models.schema import UserInput
from agents.specialized import ProblemRecommenderAgent
from tools import ProblemRecommendationTool
from crewai import Crew, Task
import json

router = APIRouter()

# Authentication dependency
async def get_current_user(authorization: str = Header(...)):
    """
    Extract and validate Supabase token from Authorization header.
    """
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        token = authorization[len("Bearer "):]
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# Generate recommendations and save to tasks table
@router.post("/recommend/{roadmap_id}")
async def recommend_problems(roadmap_id: int, user=Depends(get_current_user)):
    """
    Generate problem recommendations based on the user's roadmap.

    Args:
        roadmap_id (int): The ID of the roadmap to generate recommendations for.
        user: Authenticated user object from dependency.

    Returns:
        dict: A dictionary containing the recommended problems per week.

    Raises:
        HTTPException: If roadmap fetching or recommendation generation fails.
    """
    try:
        # Fetch the user's roadmap from Supabase
        response = supabase.table("roadmaps").select("*").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        roadmap = response.data[0]

        # Initialize and run the recommendation tool
        tool = ProblemRecommendationTool()
        problems_per_week = tool._run(
            roadmap_data=roadmap["roadmap_data"],
            company=roadmap.get("company"),
            user_input=roadmap["user_input"]
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

        # Return the recommendations
        return {"recommendations": problems_per_week}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

# Get all problems for a roadmap
@router.get("/problems/{roadmap_id}")
async def get_all_problems(roadmap_id: int, user=Depends(get_current_user)):
    """
    Retrieve all problems (tasks) for a specific roadmap.

    Args:
        roadmap_id (int): The ID of the roadmap.
        user: Authenticated user object from dependency.

    Returns:
        dict: A dictionary containing the list of tasks for the roadmap.

    Raises:
        HTTPException: If the roadmap is not found or user is not authorized.
    """
    try:
        # Ensure the roadmap belongs to the user
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")

        # Fetch all tasks for the roadmap
        tasks_response = supabase.table("tasks").select("*").eq("roadmap_id", roadmap_id).execute()
        return {"tasks": tasks_response.data if tasks_response.data else []}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching tasks: {str(e)}")

# Get problems for a specific week in a roadmap
@router.get("/problems/{roadmap_id}/week/{week}")
async def get_week_problems(roadmap_id: int, week: int, user=Depends(get_current_user)):
    """
    Retrieve problems (tasks) for a specific week in a roadmap.

    Args:
        roadmap_id (int): The ID of the roadmap.
        week (int): The week number to retrieve tasks for.
        user: Authenticated user object from dependency.

    Returns:
        dict: A dictionary containing the task details for the specified week.

    Raises:
        HTTPException: If the roadmap or task is not found, or user is not authorized.
    """
    try:
        # Ensure the roadmap belongs to the user
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")

        # Fetch the task for the specific week
        task_response = supabase.table("tasks").select("*").eq("roadmap_id", roadmap_id).eq("week", week).execute()
        if not task_response.data:
            raise HTTPException(status_code=404, detail="Task not found for the specified week")

        return {"task": task_response.data[0]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching task: {str(e)}")

# Delete all problems for a roadmap
@router.delete("/problems/{roadmap_id}")
async def delete_all_problems(roadmap_id: int, user=Depends(get_current_user)):
    """
    Delete all problems (tasks) for a specific roadmap.

    Args:
        roadmap_id (int): The ID of the roadmap.
        user: Authenticated user object from dependency.

    Returns:
        dict: A success message upon deletion.

    Raises:
        HTTPException: If the roadmap is not found or user is not authorized.
    """
    try:
        # Ensure the roadmap belongs to the user
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")

        # Delete all tasks for the roadmap
        supabase.table("tasks").delete().eq("roadmap_id", roadmap_id).execute()
        return {"message": "All tasks deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting tasks: {str(e)}")

# Delete problems for a specific week in a roadmap
@router.delete("/problems/{roadmap_id}/week/{week}")
async def delete_week_problems(roadmap_id: int, week: int, user=Depends(get_current_user)):
    """
    Delete problems (tasks) for a specific week in a roadmap.

    Args:
        roadmap_id (int): The ID of the roadmap.
        week (int): The week number to delete tasks for.
        user: Authenticated user object from dependency.

    Returns:
        dict: A success message upon deletion.

    Raises:
        HTTPException: If the roadmap or task is not found, or user is not authorized.
    """
    try:
        # Ensure the roadmap belongs to the user
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")

        # Delete the task for the specific week
        task_response = supabase.table("tasks").delete().eq("roadmap_id", roadmap_id).eq("week", week).execute()
        if not task_response.data and not task_response.count:
            raise HTTPException(status_code=404, detail="Task not found for the specified week")

        return {"message": f"Tasks for week {week} deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting task: {str(e)}")

# Update problems for a specific week in a roadmap
@router.put("/problems/{roadmap_id}/week/{week}")
async def update_week_problems(
    roadmap_id: int, 
    week: int, 
    lc_problem_ids: list[str], 
    other_topics: list[str] = [], 
    user=Depends(get_current_user)
):
    """
    Update problems (tasks) for a specific week in a roadmap.

    Args:
        roadmap_id (int): The ID of the roadmap.
        week (int): The week number to update tasks for.
        lc_problem_ids (list[str]): List of LeetCode problem IDs.
        other_topics (list[str]): Optional list of additional topics.
        user: Authenticated user object from dependency.

    Returns:
        dict: Updated task details.

    Raises:
        HTTPException: If the roadmap or task is not found, or user is not authorized.
    """
    try:
        # Ensure the roadmap belongs to the user
        roadmap_response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found or not authorized")

        # Check if the task exists
        task_response = supabase.table("tasks").select("*").eq("roadmap_id", roadmap_id).eq("week", week).execute()
        if not task_response.data:
            raise HTTPException(status_code=404, detail="Task not found for the specified week")

        # Update the task
        updated_task = {
            "lc_problem_ids": lc_problem_ids,
            "other_topics": other_topics
        }
        update_response = supabase.table("tasks").update(updated_task).eq("roadmap_id", roadmap_id).eq("week", week).execute()
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update task")

        return {"task": update_response.data[0]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating task: {str(e)}")


# @router.post("/recommend/{roadmap_id}")
# async def recommend_problems(roadmap_id: int, user=Depends(get_current_user)):
#     """
#     Generate problem recommendations based on the user's roadmap using CrewAI.
    
#     Args:
#         user_input (UserInput): Input data from the request (if needed).
#         user: Authenticated user object from the dependency.
    
#     Returns:
#         dict: A dictionary containing the recommended problems per week.
    
#     Raises:
#         HTTPException: If roadmap fetching, agent execution, or parsing fails.
#     """
#     try:
#         # Step 1: Fetch the user's roadmap from Supabase
#         response = supabase.table("roadmaps").select("*").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
#         if not response.data:
#             raise HTTPException(status_code=404, detail="Roadmap not found")
#         # return response.data[0]
#         roadmap_data = response.data[0]  # Assuming one roadmap per user; adjust if needed

#         # Step 2: Initialize the ProblemRecommenderAgent
#         problem_recommender_agent = ProblemRecommenderAgent()

#         # Step 3: Define the task for the agent
#         task_description = f"""
#         Using the provided roadmap data: {json.dumps(roadmap_data)},
#         search the leetcode-problems.csv file for problems matching each week's topics and difficulty.
#         For each week, find problems where the 'related_topics' column contains the topic and the 'difficulty' column matches the specified difficulty.
#         Return a JSON array where each entry contains the week number and a list of problem IDs.
#         """

#         task = Task(
#             description=task_description,
#             expected_output="A JSON array like [{'week': 1, 'problems': ['1', '2']}, {'week': 2, 'problems': ['3']}]",
#             agent=problem_recommender_agent
#         )

#         # Step 4: Create and run the Crew
#         crew = Crew(
#             agents=[problem_recommender_agent],
#             tasks=[task],
#             verbose=True  # Set to True for debugging; False in production
#         )
#         result = crew.kickoff()

#         # Step 5: Parse the agent's output
#         try:
#             # Assuming result.raw contains the JSON string (adjust based on CrewAI version)
#             problems_per_week = json.loads(result.raw)
#             return {"problems": problems_per_week}
#         except json.JSONDecodeError:
#             raise HTTPException(status_code=500, detail="Failed to parse agent output")

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")
from fastapi import APIRouter, Depends, HTTPException, Header
from supabase_client import supabase
from models.schema import UserInput
from agents.specialized import ProblemRecommenderAgent
from tools import ProblemRecommendationTool
from crewai import Crew, Task
import json
from pydantic import BaseModel
import pandas as pd

router = APIRouter()

# Load the problems dataset
try:
    problems_df = pd.read_csv('dataset/leetcode-problems.csv')
    print("Dataset loaded successfully")
    print(f"Dataset shape: {problems_df.shape}")
    print(f"Dataset columns: {problems_df.columns.tolist()}")
    print(f"First few IDs: {problems_df['id'].head().tolist()}")
    print(f"ID column type: {problems_df['id'].dtype}")
except Exception as e:
    print(f"Error loading dataset: {str(e)}")
    raise

class ExplanationRequest(BaseModel):
    problem_id: str

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

# Create a separate router for explanation
explanation_router = APIRouter()

@explanation_router.get("")
async def get_problem_explanation(problem_id: str = None):
    if not problem_id:
        raise HTTPException(status_code=400, detail="problem_id query parameter is required")
        
    try:
        print(f"Looking up problem with ID: {problem_id}")
        print(f"Type of problem_id: {type(problem_id)}")
        
        # Convert problem_id to integer safely
        try:
            problem_id_int = int(problem_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid problem_id format: '{problem_id}'. Must be a valid number.")
        
        # Get problem details from the dataset
        problem = problems_df[problems_df['id'] == problem_id_int]
        if problem.empty:
            raise HTTPException(status_code=404, detail=f"Problem with ID {problem_id} not found")
        
        # Debug print the problem data
        print("Problem data columns:", problem.columns.tolist())
        print("Problem data shape:", problem.shape)
        
        # Safely get field values with error handling
        def safe_get_field(row, field, default=None):
            try:
                if field not in row:
                    print(f"Warning: Field '{field}' not found in data")
                    return default
                value = row[field].iloc[0]
                print(f"Field '{field}' value type:", type(value))
                return value
            except Exception as e:
                print(f"Error getting field '{field}': {str(e)}")
                return default
        
        # Safely parse JSON fields
        def safe_json_loads(value, default=None):
            if value is None:
                return default
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except json.JSONDecodeError as e:
                    print(f"JSON decode error for value: {value}")
                    return default
            return value
        
        # Get basic fields
        title = safe_get_field(problem, 'title', '')
        description = safe_get_field(problem, 'description', '')
        difficulty = safe_get_field(problem, 'difficulty', '')
        
        # Get and parse JSON fields
        related_topics = safe_json_loads(safe_get_field(problem, 'related_topics', '[]'), [])
        examples = safe_json_loads(safe_get_field(problem, 'examples', '[]'), [])
        constraints = safe_json_loads(safe_get_field(problem, 'constraints', '[]'), [])
        
        problem_details = {
            'title': title,
            'description': description,
            'difficulty': difficulty,
            'related_topics': related_topics,
            'examples': examples,
            'constraints': constraints
        }
        
        print("Processed problem details:", problem_details)
        
        # Get explanation using the crew
        from agents.crew import DSACrew
        crew = DSACrew()
        explanation = crew.get_explanation(str(problem_id_int), problem_details)
        
        # Initialize the explanation structure with default values
        formatted_explanation = {
            "problem_understanding": "",
            "approaches": [],
            "example_walkthrough": "",
            "edge_cases": "",
            "tips": ""
        }
        
        # Ensure the explanation has the expected structure
        if not isinstance(explanation, dict):
            formatted_explanation["problem_understanding"] = str(explanation)
        else:
            # Copy values from the original explanation, using defaults if missing
            formatted_explanation.update({
                "problem_understanding": explanation.get("problem_understanding", ""),
                "approaches": explanation.get("approaches", []),
                "example_walkthrough": explanation.get("example_walkthrough", ""),
                "edge_cases": explanation.get("edge_cases", ""),
                "tips": explanation.get("tips", "")
            })
        
        # Format the problem understanding
        if isinstance(formatted_explanation["problem_understanding"], str):
            # Split into sections and format them
            sections = formatted_explanation["problem_understanding"].split("###")
            formatted_sections = []
            
            for section in sections:
                if section.strip():
                    # Get the section title and content
                    lines = section.strip().split("\n")
                    title = lines[0].strip().replace("#", "").strip()
                    content = []
                    
                    # Process the content
                    for line in lines[1:]:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            # Remove redundant text and format
                            line = line.replace("**", "").replace("*", "")
                            if line.startswith("- "):
                                content.append(line)
                            elif line.startswith("1.") or line.startswith("2.") or line.startswith("3."):
                                content.append(line)
                            else:
                                content.append(line)
                    
                    # Format the section
                    if title and content:
                        formatted_section = f"{title}\n" + "\n".join(content)
                        formatted_sections.append(formatted_section)
            
            # Join sections with clear separation
            formatted_explanation["problem_understanding"] = "\n\n".join(formatted_sections)
        
        # Format approaches
        if isinstance(formatted_explanation["approaches"], list):
            formatted_approaches = []
            for approach in formatted_explanation["approaches"]:
                if isinstance(approach, dict):
                    formatted_approach = {
                        "approach": approach.get("approach", ""),
                        "time_complexity": approach.get("time_complexity", "Not specified"),
                        "space_complexity": approach.get("space_complexity", "Not specified")
                    }
                    
                    # Format the approach steps
                    if isinstance(formatted_approach["approach"], str):
                        steps = formatted_approach["approach"].split("\n")
                        formatted_steps = []
                        
                        for step in steps:
                            step = step.strip()
                            if step and not step.startswith("#"):
                                # Remove redundant text and format
                                step = step.replace("**", "").replace("*", "")
                                if step.startswith("- "):
                                    formatted_steps.append(step)
                                elif step.startswith("1.") or step.startswith("2.") or step.startswith("3."):
                                    formatted_steps.append(step)
                                else:
                                    formatted_steps.append(step)
                        
                        formatted_approach["approach"] = "\n".join(formatted_steps)
                    
                    formatted_approaches.append(formatted_approach)
            
            formatted_explanation["approaches"] = formatted_approaches
        
        # Format example walkthrough
        if isinstance(formatted_explanation["example_walkthrough"], str):
            steps = formatted_explanation["example_walkthrough"].split("\n")
            formatted_steps = []
            
            for step in steps:
                step = step.strip()
                if step and not step.startswith("#"):
                    step = step.replace("**", "").replace("*", "")
                    if step.startswith("- "):
                        formatted_steps.append(step)
                    elif step.startswith("1.") or step.startswith("2.") or step.startswith("3."):
                        formatted_steps.append(step)
                    else:
                        formatted_steps.append(step)
            
            formatted_explanation["example_walkthrough"] = "\n".join(formatted_steps)
        
        # Format edge cases
        if isinstance(formatted_explanation["edge_cases"], str):
            cases = formatted_explanation["edge_cases"].split("\n")
            formatted_cases = []
            
            for case in cases:
                case = case.strip()
                if case and not case.startswith("#"):
                    case = case.replace("**", "").replace("*", "")
                    if case.startswith("- "):
                        formatted_cases.append(case)
                    else:
                        formatted_cases.append(f"- {case}")
            
            formatted_explanation["edge_cases"] = "\n".join(formatted_cases)
        
        # Format tips
        if isinstance(formatted_explanation["tips"], str):
            tips = formatted_explanation["tips"].split("\n")
            formatted_tips = []
            
            for tip in tips:
                tip = tip.strip()
                if tip and not tip.startswith("#"):
                    tip = tip.replace("**", "").replace("*", "")
                    if tip.startswith("- "):
                        formatted_tips.append(tip)
                    else:
                        formatted_tips.append(f"- {tip}")
            
            formatted_explanation["tips"] = "\n".join(formatted_tips)
        
        return {"explanation": formatted_explanation}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

# Include the explanation router with a prefix
router.include_router(explanation_router, prefix="/explain", tags=["explanation"])

# Generate recommendations and save to tasks table
@router.post("/recommend/{roadmap_id}")
async def recommend_problems(roadmap_id: int, user=Depends(get_current_user)):
    try:
        # Get roadmap data from database
        roadmap_response = supabase.table("roadmaps").select("*").eq("id", roadmap_id).execute()
        if not roadmap_response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        roadmap = roadmap_response.data[0]
        
        # Generate recommendations
        from services.problem_service import generate_and_save_recommendations
        problems_per_week = generate_and_save_recommendations(
            roadmap_id=roadmap_id,
            roadmap_data=roadmap["roadmap_data"],
            company=roadmap.get("company"),
            user_input={},  # Add any additional user input if needed
            user_id=user.user.id
        )
        
        # Return the recommendations
        return {"recommendations": problems_per_week}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

# Get all problems for a roadmap
@router.get("/{roadmap_id}")
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
@router.get("/{roadmap_id}/week/{week}")
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
@router.delete("/{roadmap_id}")
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
@router.delete("/{roadmap_id}/week/{week}")
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
@router.put("/{roadmap_id}/week/{week}")
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
from fastapi import APIRouter, Depends, HTTPException
from supabase_client import supabase
from models.schema import UserInput
from agents.specialized import ProblemRecommenderAgent
from crewai import Crew, Task
import json

router = APIRouter()

# Authentication dependency (simplified; adjust based on your setup)
async def get_current_user(token: str):  # Simplified; adjust as needed
    try:
        user = supabase.auth.get_user(token)
        print(user);
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/recommend")
async def recommend_problems( user=Depends(get_current_user)):
    """
    Generate problem recommendations based on the user's roadmap using CrewAI.
    
    Args:
        user_input (UserInput): Input data from the request (if needed).
        user: Authenticated user object from the dependency.
    
    Returns:
        dict: A dictionary containing the recommended problems per week.
    
    Raises:
        HTTPException: If roadmap fetching, agent execution, or parsing fails.
    """
    try:
        # Step 1: Fetch the user's roadmap from Supabase
        response = supabase.table("roadmaps").select("*").eq("user_id", user.user.id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        print("supabase response data:", response)
        roadmap_data = response.data[0]  # Assuming one roadmap per user; adjust if needed

        # Step 2: Initialize the ProblemRecommenderAgent
        problem_recommender_agent = ProblemRecommenderAgent()

        # Step 3: Define the task for the agent
        task_description = f"""
        Using the provided roadmap data: {json.dumps(roadmap_data)},
        search the leetcode-problems.csv file for problems matching each week's topics and difficulty.
        For each week, find problems where the 'related_topics' column contains the topic and the 'difficulty' column matches the specified difficulty.
        Return a JSON array where each entry contains the week number and a list of problem IDs.
        """

        task = Task(
            description=task_description,
            expected_output="A JSON array like [{'week': 1, 'problems': ['1', '2']}, {'week': 2, 'problems': ['3']}]",
            agent=problem_recommender_agent
        )

        # Step 4: Create and run the Crew
        crew = Crew(
            agents=[problem_recommender_agent],
            tasks=[task],
            verbose=True  # Set to True for debugging; False in production
        )
        result = crew.kickoff()

        # Step 5: Parse the agent's output
        try:
            # Assuming result.raw contains the JSON string (adjust based on CrewAI version)
            problems_per_week = json.loads(result.raw)
            return {"problems": problems_per_week}
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Failed to parse agent output")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")
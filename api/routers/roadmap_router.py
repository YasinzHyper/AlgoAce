# routers/roadmap_router.py
from fastapi import APIRouter, Depends, HTTPException
from supabase_client import supabase
from models.schema import UserInput
from agents.crew import DSACrew
from agents.specialized import RoadmapTool
import json

router = APIRouter()
dsa_crew = DSACrew()

async def get_current_user(token: str):  # Simplified; adjust as needed
    try:
        user = supabase.auth.get_user(token)
        print(user);
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/generate")
async def generate_learning_path(user_input: UserInput, user=Depends(get_current_user)):
    try:
        # path = dsa_crew.create_learning_path(user_input.dict())
        tool = RoadmapTool()
        path_str = tool._run(user_input.dict())
        # Parse the string into a Python list
        try:
            path_list = json.loads(path_str)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Invalid roadmap format from tool: {str(e)}")
        roadmap_data = {
            "user_id": user.user.id,
            "roadmap_data": path_list,
            "created_at": "now()"
        }
        response = supabase.table("roadmaps").insert(roadmap_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to save roadmap")
        return {"roadmap": path_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating roadmap: {str(e)}")
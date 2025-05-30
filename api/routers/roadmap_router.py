# routers/roadmap_router.py
from fastapi import APIRouter, Depends, HTTPException, Header
from supabase_client import supabase
from models.schema import UserInput
from agents.crew import DSACrew
from agents.specialized import RoadmapTool
import json

router = APIRouter()
# dsa_crew = DSACrew()

async def get_current_user(authorization: str = Header(...)):
    """
    Extract and validate Supabase token from Authorization header.
    """
    try:
        # Expect 'Bearer <token>'
        if not authorization.startswith("Bearer "): 
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        token = authorization[len("Bearer "):]
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

@router.post("/generate")
async def generate_roadmap(user_input: UserInput, user=Depends(get_current_user)):
    try:
        # path = dsa_crew.create_learning_path(user_input.dict())
        tool = RoadmapTool()
        roadmap_json = tool._run(user_input.dict())
        if "error" in roadmap_json:
            raise HTTPException(status_code=500, detail=roadmap_json["error"])
        roadmap_data = {
            "user_id": user.user.id,
            "roadmap_data": roadmap_json["roadmap_data"],
            "created_at": "now()",
        }
        if "company" in roadmap_json:
            roadmap_data["company"] = roadmap_json["company"]
        response = supabase.table("roadmaps").insert(roadmap_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to save roadmap")
        print(roadmap_json)
        return roadmap_json
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating roadmap: {str(e)}")
    
    # to run the crew:
    # try:
    #     result = dsa_crew.create_roadmap(user_input.dict(), user.user.id)
    #     return {"roadmap": result}
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"Error generating roadmap: {str(e)}")
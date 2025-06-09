# routers/roadmap_router.py
from fastapi import APIRouter, Depends, HTTPException, Header
from supabase_client import supabase
from models.schema import UserInput
from agents.crew import DSACrew
from agents.specialized import RoadmapTool
from services.problem_service import generate_and_save_recommendations
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
    

@router.get("/")
async def get_all_roadmaps(user=Depends(get_current_user)):
    """
    Get all roadmaps for the authenticated user
    """
    try:
        response = supabase.table("roadmaps").select("*").eq("user_id", user.user.id).execute()
        return {"roadmaps": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching roadmaps: {str(e)}")
    

@router.get("/{roadmap_id}")
async def get_roadmap(roadmap_id: int, user=Depends(get_current_user)):
    """
    Get a specific roadmap by ID
    """
    try:
        response = supabase.table("roadmaps").select("*").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching roadmap: {str(e)}")


@router.post("/generate")
async def generate_roadmap(user_input: UserInput, user=Depends(get_current_user)):
    try:
        # path = dsa_crew.create_learning_path(user_input.dict())
        tool = RoadmapTool()
        roadmap_json = tool._run(user_input.model_dump())
        if "error" in roadmap_json:
            raise HTTPException(status_code=500, detail=roadmap_json["error"])
        roadmap_data = {
            "user_id": user.user.id,
            "user_input": user_input.model_dump(),
            "roadmap_data": roadmap_json["roadmap_data"],
            "created_at": "now()",
        }
        if "company" in roadmap_json:
            roadmap_data["company"] = roadmap_json["company"]
        response = supabase.table("roadmaps").insert(roadmap_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to save roadmap")
        
        roadmap_id = response.data[0]['id']
        # Automate problem recommendation
        generate_and_save_recommendations(
            roadmap_id=roadmap_id,
            roadmap_data=roadmap_json["roadmap_data"],
            company=roadmap_json.get("company"),
            user_input=user_input.model_dump(),
            user_id=user.user.id
        )

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

@router.delete("/{roadmap_id}")
async def delete_roadmap(roadmap_id: int, user=Depends(get_current_user)):
    """
    Delete a specific roadmap by ID
    """
    try:
        # First check if roadmap exists and belongs to user
        response = supabase.table("roadmaps").select("id").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Delete the roadmap
        delete_response = supabase.table("roadmaps").delete().eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        return {"message": "Roadmap deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting roadmap: {str(e)}")
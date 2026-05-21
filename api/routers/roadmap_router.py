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
        print(f"DEBUG: Starting roadmap generation for user {user.user.id}")
        print(f"DEBUG: User input: {user_input.model_dump()}")
        
        tool = RoadmapTool()
        print("DEBUG: RoadmapTool initialized successfully")
        
        roadmap_json = tool._run(user_input.model_dump())
        print(f"DEBUG: Roadmap generated: {roadmap_json}")
        
        if "error" in roadmap_json:
            print(f"DEBUG: Error in roadmap_json: {roadmap_json['error']}")
            raise HTTPException(status_code=500, detail=roadmap_json["error"])
        
        roadmap_data = {
            "user_id": user.user.id,
            "user_input": user_input.model_dump(),
            "roadmap_data": roadmap_json["roadmap_data"],
            "created_at": "now()",
        }
        if "company" in roadmap_json:
            roadmap_data["company"] = roadmap_json["company"]
        
        print("DEBUG: Saving roadmap to database")
        response = supabase.table("roadmaps").insert(roadmap_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to save roadmap")
        
        roadmap_id = response.data[0]['id']
        print(f"DEBUG: Roadmap saved with ID: {roadmap_id}")
        
        # Automate problem recommendation
        print("DEBUG: Generating problem recommendations")
        generate_and_save_recommendations(
            roadmap_id=roadmap_id,
            roadmap_data=roadmap_json["roadmap_data"],
            company=roadmap_json.get("company"),
            user_input=user_input.model_dump(),
            user_id=user.user.id
        )
        print("DEBUG: Recommendations generated successfully")

        print(roadmap_json)
        return roadmap_json
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in generate_roadmap: {error_trace}")
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
    Delete a specific roadmap by ID (and associated data)
    """
    try:
        import os
        
        # First check if roadmap exists and belongs to user
        response = supabase.table("roadmaps").select("id", "user_input").eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        roadmap = response.data[0]
        user_input = roadmap.get("user_input") or {}
        subjects = user_input.get("subjects", "both")
        
        # Delete associated tasks first (foreign key constraint)
        try:
            supabase.table("tasks").delete().eq("roadmap_id", roadmap_id).execute()
        except Exception as e:
            print(f"Warning: Could not delete tasks: {e}")
        
        # Delete associated progress records
        try:
            supabase.table("progress").delete().eq("roadmap_id", roadmap_id).execute()
        except Exception as e:
            print(f"Warning: Could not delete progress: {e}")
        
        # Delete metadata files if they exist - support both OS and DBMS subjects
        try:
            metadata_dir = os.path.join(
                os.path.dirname(__file__), 
                "..", 
                "data", 
                "roadmap_metadata"
            )
            # Try deleting OS metadata
            if subjects in ["os", "both", "dsa_os", "os_dbms", "all"]:
                os_metadata_file = os.path.join(metadata_dir, f"roadmap_{roadmap_id}_os.json")
                if os.path.exists(os_metadata_file):
                    os.remove(os_metadata_file)
                    print(f"Deleted OS metadata file: {os_metadata_file}")
            
            # Try deleting DBMS metadata
            if subjects in ["dbms", "both", "dsa_dbms", "os_dbms", "all"]:
                dbms_metadata_file = os.path.join(metadata_dir, f"roadmap_{roadmap_id}_dbms.json")
                if os.path.exists(dbms_metadata_file):
                    os.remove(dbms_metadata_file)
                    print(f"Deleted DBMS metadata file: {dbms_metadata_file}")
        except Exception as e:
            print(f"Warning: Could not delete metadata files: {e}")
        
        # Delete the roadmap
        delete_response = supabase.table("roadmaps").delete().eq("id", roadmap_id).eq("user_id", user.user.id).execute()
        return {"message": "Roadmap deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting roadmap: {str(e)}")
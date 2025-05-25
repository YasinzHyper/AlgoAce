# routers/user_router.py
from fastapi import APIRouter, Depends, HTTPException
from supabase_client import supabase
from models.schema import UserData

router = APIRouter()

async def get_current_user(token: str):  # Same as above; consider a shared dependency
    try:
        user = supabase.auth.get_user(token)
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/update")
async def update_user_data(user_data: UserData, user=Depends(get_current_user)):
    try:
        update_data = {k: v for k, v in user_data.dict().items() if v is not None}
        response = (
            supabase.table("users")
            .update(update_data)
            .eq("id", user.user.id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update user data")
        return {"message": "User data updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating user data: {str(e)}")

@router.get("/")
async def get_user_data(user=Depends(get_current_user)):
    try:
        response = (
            supabase.table("users")
            .select("*")
            .eq("id", user.user.id)
            .execute()
        )
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="User data not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user data: {str(e)}")
from fastapi import APIRouter, Depends, HTTPException, Header

from dataset.os_loader import get_os_item_by_id, hydrate_os_items

router = APIRouter()


async def get_current_user(authorization: str = Header(...)):
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        from supabase_client import supabase

        token = authorization[len("Bearer ") :]
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


@router.get("/topics")
async def list_os_topics(user=Depends(get_current_user)):
    from dataset.os_loader import OS_TOPICS

    return {"topics": OS_TOPICS}


@router.get("/{item_id}")
async def get_study_item(item_id: int, user=Depends(get_current_user)):
    item = get_os_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Study item not found")
    return {"item": item}


@router.post("/hydrate")
async def hydrate_study_items(body: dict, user=Depends(get_current_user)):
    ids = body.get("ids") or []
    try:
        int_ids = [int(i) for i in ids]
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="ids must be a list of integers")
    return {"items": hydrate_os_items(int_ids)}

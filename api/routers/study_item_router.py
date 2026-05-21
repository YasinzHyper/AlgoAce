from fastapi import APIRouter, Depends, HTTPException, Header, Query

from dataset.os_loader import get_os_item_by_id, hydrate_os_items, OS_TOPICS
from dataset.dbms_loader import get_dbms_item_by_id, hydrate_dbms_items, DBMS_TOPICS

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
async def list_study_topics(subject: str = Query("os", description="Subject: 'os' or 'dbms'"), user=Depends(get_current_user)):
    """Get topics for a specific subject (OS or DBMS)."""
    if subject.lower() == "os":
        return {"subject": "os", "topics": OS_TOPICS}
    elif subject.lower() == "dbms":
        return {"subject": "dbms", "topics": DBMS_TOPICS}
    else:
        raise HTTPException(status_code=400, detail="Subject must be 'os' or 'dbms'")


@router.get("/{item_id}")
async def get_study_item(item_id: int, subject: str = Query("os", description="Subject: 'os' or 'dbms'"), user=Depends(get_current_user)):
    """Get a specific study item by ID and subject."""
    if subject.lower() == "os":
        item = get_os_item_by_id(item_id)
    elif subject.lower() == "dbms":
        item = get_dbms_item_by_id(item_id)
    else:
        raise HTTPException(status_code=400, detail="Subject must be 'os' or 'dbms'")
    
    if not item:
        raise HTTPException(status_code=404, detail=f"Study item not found for {subject}")
    return {"item": item}


@router.post("/hydrate")
async def hydrate_study_items(body: dict, subject: str = Query("os", description="Subject: 'os' or 'dbms'"), user=Depends(get_current_user)):
    """Hydrate (retrieve) multiple study items by IDs for a specific subject."""
    ids = body.get("ids") or []
    try:
        int_ids = [int(i) for i in ids]
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="ids must be a list of integers")
    
    if subject.lower() == "os":
        items = hydrate_os_items(int_ids)
    elif subject.lower() == "dbms":
        items = hydrate_dbms_items(int_ids)
    else:
        raise HTTPException(status_code=400, detail="Subject must be 'os' or 'dbms'")
    
    return {"items": items}

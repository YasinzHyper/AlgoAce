# models/schemas.py
from pydantic import BaseModel
from typing import Optional, List, Dict
import json

class UserInput(BaseModel):
    goal: str
    deadline: Optional[str] = None
    weekly_hours: Optional[int] = 10
    current_knowledge: Optional[Dict] = None
    weeks: Optional[int] = 1

class UserData(BaseModel):
    deadline: str
    current_knowledge: Optional[Dict] = None
    weekly_hours: Optional[int] = None
    goal: Optional[str] = None

class RoadmapData(BaseModel):
    id: int
    user_id: Optional[str] = None
    roadmap_data: Optional[List[Dict]] = None
    company: Optional[str] = None
    user_input: UserInput

class ProblemRequest(BaseModel):
    week: int
    topics: List[str]
    difficulty: str
    company_tags: List[str] = []
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..agents.specialized import ProblemRecommenderAgent, ExplanationAgent
from ..models.problem import Problem, ProblemStatus
from ..database import get_db

router = APIRouter(prefix="/problems", tags=["problems"])

class ProblemRecommendationRequest(BaseModel):
    topics: List[str]
    difficulty_levels: List[str]
    companies: Optional[List[str]] = None

class ProblemExplanationRequest(BaseModel):
    problem_id: str
    question: str

@router.get("/weekly/{roadmap_id}/{week_number}")
async def get_weekly_problems(roadmap_id: str, week_number: int):
    """
    Get recommended problems for a specific week in the roadmap
    """
    try:
        # Get weekly topics from roadmap
        # This would be implemented based on your database structure
        weekly_topics = []  # Get from database

        # Initialize problem recommender agent
        recommender = ProblemRecommenderAgent()
        
        # Get problem recommendations
        recommendations = await recommender.recommend_problems(
            topics=weekly_topics,
            difficulty_levels=["Easy", "Medium", "Hard"],
            companies=None  # Optional: filter by companies
        )

        return {
            "week_number": week_number,
            "recommendations": recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/explain")
async def get_problem_explanation(request: ProblemExplanationRequest):
    """
    Get AI-powered explanation for a problem
    """
    try:
        # Initialize explanation agent
        explainer = ExplanationAgent()
        
        # Get explanation
        explanation = await explainer.explain_problem(
            problem_id=request.problem_id,
            question=request.question
        )

        return {
            "explanation": explanation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{problem_id}/complete")
async def mark_problem_complete(problem_id: str):
    """
    Mark a problem as completed
    """
    try:
        # Update problem status in database
        # This would be implemented based on your database structure
        return {
            "status": "success",
            "message": "Problem marked as completed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{problem_id}")
async def get_problem_details(problem_id: str):
    """
    Get detailed information about a specific problem
    """
    try:
        # Get problem details from database
        # This would be implemented based on your database structure
        problem = {}  # Get from database

        return problem
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 
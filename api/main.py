from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from agents.crew import DSACrew
from config import validate_env

# Validate environment variables on startup
validate_env()

app = FastAPI(title="DSA Learning Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserInfo(BaseModel):
    user_id: str
    goals: List[str]
    experience_level: str

class ProblemRequest(BaseModel):
    topic: str
    user_id: str

class ExplanationRequest(BaseModel):
    problem_id: str
    hint_level: str  # 'hint' or 'full'

dsa_crew = DSACrew()

@app.post("/learning-path")
async def generate_learning_path(user_info: UserInfo):
    try:
        path = dsa_crew.create_learning_path(user_info.dict())
        return {"learning_path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommend-problems")
async def recommend_problems(request: ProblemRequest):
    try:
        # Get user progress from database (implement this)
        user_progress = {}  # Placeholder
        problems = dsa_crew.recommend_problems(request.topic, user_progress)
        return {"recommended_problems": problems}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-explanation")
async def get_explanation(request: ExplanationRequest):
    try:
        explanation = dsa_crew.get_explanation(request.problem_id, request.hint_level)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze-progress/{user_id}")
async def analyze_progress(user_id: str):
    try:
        feedback = dsa_crew.analyze_progress(user_id)
        return {"feedback": feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
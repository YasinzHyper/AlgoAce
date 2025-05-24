from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents.crew import DSACrew
from supabase import create_client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dsa_crew = DSACrew()

class UserInput(BaseModel):
    goals: list[str]
    deadline: str
    weekly_time: int
    knowledge: dict

class ProblemRequest(BaseModel):
    week: int
    topics: list[str]
    difficulty: str
    company_tags: list[str] = []

async def get_current_user(token: str):
    supabase = create_client("your-supabase-url", "your-supabase-key")
    try:
        user = supabase.auth.get_user(token)
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/api/roadmap/generate")
async def generate_learning_path(user_input: UserInput, user=Depends(get_current_user)):
    try:
        path = dsa_crew.create_learning_path(user_input.dict())
        # Save roadmap to Supabase
        return {"roadmap": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/problems/recommend")
async def recommend_problems(request: ProblemRequest, user=Depends(get_current_user)):
    try:
        problems = dsa_crew.recommend_problems(request.week, request.topics, request.difficulty, request.company_tags)
        return {"recommended_problems": problems}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/explain")
async def get_explanation(problem_id: str, user=Depends(get_current_user)):
    try:
        explanation = dsa_crew.get_explanation(problem_id)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/feedback/{user_id}")
async def analyze_progress(user_id: str, user=Depends(get_current_user)):
    try:
        feedback = dsa_crew.analyze_progress(user_id)
        return {"feedback": feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
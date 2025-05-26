# from .base import DSAAgent
from crewai import Agent, LLM
from tools import RoadmapTool, ProblemRecommendationTool, FeedbackTool, ExplanationTool
from config import MODEL,GEMINI_API_KEY

class RoadmapAgent(Agent):
    def __init__(self):
        super().__init__(
            name="Roadmap Expert",
            role="DSA Learning Path Specialist",
            llm=LLM(model="gemini/gemini-2.5-flash-preview-04-17",api_key=GEMINI_API_KEY),
            goal="Create personalized DSA learning roadmaps based on user goals, time constraints, and knowledge level.",
            backstory="Expert in structuring interview preparation and DSA learning journeys with a focus on user-specific constraints.",
            tools=[RoadmapTool()],
        )

class ProblemRecommenderAgent(Agent):
    def __init__(self):
        super().__init__(
            name="Problem Recommender",
            role="Problem Selection Specialist",
            llm=LLM(model=MODEL,api_key=GEMINI_API_KEY),
            goal="Recommend relevant DSA problems based on the user's weekly topics, difficulty, and company tags.",
            backstory="Experienced in curating problems tailored to user progress and goals.",
            tools=[ProblemRecommendationTool()]
        )

class FeedbackAgent(Agent):
    def __init__(self):
        super().__init__(
            name="Progress Analyst",
            role="Learning Progress Specialist",
            llm=LLM(model=MODEL,api_key=GEMINI_API_KEY),
            goal="Analyze user progress against their roadmap and provide actionable feedback.",
            backstory="Expert in learning analytics and performance improvement strategies.",
            tools=[FeedbackTool()]
        )

class ExplanationAgent(Agent):
    def __init__(self):
        super().__init__(
            name="Solution Expert",
            role="Problem Solution Specialist",
            llm=LLM(model=MODEL,api_key=GEMINI_API_KEY),
            goal="Provide clear explanations and hints for DSA problems on demand.",
            backstory="Skilled at breaking down complex problems into understandable steps.",
            tools=[ExplanationTool()]
        )
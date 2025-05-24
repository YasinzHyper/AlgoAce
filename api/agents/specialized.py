from .base import DSAAgent
from tools import RoadmapTool, ProblemRecommendationTool, FeedbackTool, ExplanationTool

class RoadmapAgent(DSAAgent):
    def __init__(self):
        super().__init__(
            name="Roadmap Expert",
            role="DSA Learning Path Specialist",
            goal="Create personalized DSA learning roadmaps based on user goals, time constraints, and knowledge level.",
            backstory="Expert in structuring DSA learning journeys with a focus on user-specific constraints.",
            tools=[RoadmapTool()]
        )

class ProblemRecommenderAgent(DSAAgent):
    def __init__(self):
        super().__init__(
            name="Problem Recommender",
            role="Problem Selection Specialist",
            goal="Recommend relevant DSA problems based on the user's weekly topics, difficulty, and company tags.",
            backstory="Experienced in curating problems tailored to user progress and goals.",
            tools=[ProblemRecommendationTool()]
        )

class FeedbackAgent(DSAAgent):
    def __init__(self):
        super().__init__(
            name="Progress Analyst",
            role="Learning Progress Specialist",
            goal="Analyze user progress against their roadmap and provide actionable feedback.",
            backstory="Expert in learning analytics and performance improvement strategies.",
            tools=[FeedbackTool()]
        )

class ExplanationAgent(DSAAgent):
    def __init__(self):
        super().__init__(
            name="Solution Expert",
            role="Problem Solution Specialist",
            goal="Provide clear explanations and hints for DSA problems on demand.",
            backstory="Skilled at breaking down complex problems into understandable steps.",
            tools=[ExplanationTool()]
        )
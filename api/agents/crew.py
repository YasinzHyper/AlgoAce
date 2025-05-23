from crewai import (Crew, Task)
from .specialized import (
    RoadmapAgent,
    ProblemRecommenderAgent,
    ExplanationAgent,
    FeedbackAgent
)

class DSACrew:
    def __init__(self):
        self.roadmap_agent = RoadmapAgent()
        self.recommender_agent = ProblemRecommenderAgent()
        self.explanation_agent = ExplanationAgent()
        self.feedback_agent = FeedbackAgent()
        
        self.crew = Crew(
            agents=[
                self.roadmap_agent,
                self.recommender_agent,
                self.explanation_agent,
                self.feedback_agent
            ],
            tasks=[],
            verbose=True
        )
    
    def create_learning_path(self, user_info: dict):
        task = Task(
            description=f"Create a personalized DSA learning path for user with goals: {user_info['goals']}",
            agent=self.roadmap_agent
        )
        return self.crew.execute_task(task)
    
    def recommend_problems(self, topic: str, user_progress: dict):
        task = Task(
            description=f"Recommend problems for topic '{topic}' based on user progress",
            agent=self.recommender_agent
        )
        return self.crew.execute_task(task)
    
    def get_explanation(self, problem_id: str, hint_level: str):
        task = Task(
            description=f"Provide {'hint' if hint_level == 'hint' else 'explanation'} for problem {problem_id}",
            agent=self.explanation_agent
        )
        return self.crew.execute_task(task)
    
    def analyze_progress(self, user_id: str):
        task = Task(
            description=f"Analyze progress and provide feedback for user {user_id}",
            agent=self.feedback_agent
        )
        return self.crew.execute_task(task) 
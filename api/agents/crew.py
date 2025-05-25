from crewai import Crew, Task
from .specialized import RoadmapAgent, ProblemRecommenderAgent, FeedbackAgent, ExplanationAgent

class DSACrew:
    def __init__(self):
        self.roadmap_agent = RoadmapAgent()
        self.recommender_agent = ProblemRecommenderAgent()
        self.feedback_agent = FeedbackAgent()
        self.explanation_agent = ExplanationAgent()
        
        self.crew = Crew(
            agents=[
                self.roadmap_agent,
                self.recommender_agent,
                self.feedback_agent,
                self.explanation_agent
            ],
            tasks=[],
            verbose=True
        )
    
    def create_learning_path(self, user_input: dict):
        task = Task(
            description=f"Generate a roadmap for user with goal: {user_input['goal']}, number of weeks: {user_input['weeks']}, available weekly time: {user_input['weekly_time']} hours, current knowledge: {user_input['knowledge']}",
            expected_output="A JSON array with weekly DSA topics (with difficulty - Basic, Intermediate, Advanced) and non-DSA items (if applicable) with level (Basic, Intermediate, Advanced). Example: [{'week': 1, 'DSA': {'Arrays': 'Intermediate', 'Graphs': 'Advanced'}, 'Other': {'Computer Networks': 'Advanced'}}]",
            agent=self.roadmap_agent
        )
        return self.crew.kickoff({"user_input": user_input})
    
    def recommend_problems(self, week: int, topics: list, difficulty: str, company_tags: list = []):
        task = Task(
            description=f"Recommend problems for week {week} with topics {topics}, difficulty {difficulty}, and company tags {company_tags}",
            expected_output="A list of problems with title, difficulty, and URL.",
            agent=self.recommender_agent
        )
        return self.crew.kickoff({"week": week, "topics": topics, "difficulty": difficulty, "company_tags": company_tags})
    
    def analyze_progress(self, user_id: str):
        task = Task(
            description=f"Analyze progress for user {user_id} against their roadmap",
            expected_output="Feedback including completion percentage and focus areas.",
            agent=self.feedback_agent
        )
        return self.crew.kickoff({"user_id": user_id})
    
    def get_explanation(self, problem_id: str):
        task = Task(
            description=f"Provide explanation for problem {problem_id}",
            expected_output="Explanation text.",
            agent=self.explanation_agent
        )
        return self.crew.kickoff({"problem_id": problem_id})
from .base import DSAAgent, BaseKnowledgeBase

class RoadmapAgent(DSAAgent):
    def __init__(self):
        knowledge_base = BaseKnowledgeBase("dsa_topics")
        super().__init__(
            name="Roadmap Expert",
            role="DSA Learning Path Specialist",
            knowledge_base=knowledge_base,
            goal="Create personalized DSA learning roadmaps",
            backstory="Expert in Data Structures and Algorithms with deep understanding of topic dependencies and learning progressions."
        )

class ProblemRecommenderAgent(DSAAgent):
    def __init__(self):
        knowledge_base = BaseKnowledgeBase("dsa_problems")
        super().__init__(
            name="Problem Recommender",
            role="Problem Selection Specialist",
            knowledge_base=knowledge_base,
            goal="Recommend relevant DSA problems based on user progress",
            backstory="Experienced in curating programming problems and understanding difficulty progression."
        )

class ExplanationAgent(DSAAgent):
    def __init__(self):
        knowledge_base = BaseKnowledgeBase("problem_explanations")
        super().__init__(
            name="Solution Expert",
            role="Problem Solution Specialist",
            knowledge_base=knowledge_base,
            goal="Provide clear and helpful explanations for DSA problems",
            backstory="Skilled at breaking down complex problems and explaining solutions step by step."
        )

class FeedbackAgent(DSAAgent):
    def __init__(self):
        knowledge_base = BaseKnowledgeBase("user_progress")
        super().__init__(
            name="Progress Analyst",
            role="Learning Progress Specialist",
            knowledge_base=knowledge_base,
            goal="Analyze user progress and provide actionable feedback",
            backstory="Expert in learning analytics and performance improvement strategies."
        ) 
# from .base import DSAAgent
from crewai import Agent, LLM
from tools import RoadmapTool
from config import MODEL,GEMINI_API_KEY
from crewai_tools import CSVSearchTool

csv_tool = CSVSearchTool(
    csv="dataset/leetcode-problems.csv",
    config=dict(
        llm=dict(
            provider="google", # or google, openai, anthropic, llama2, ...
            config=dict(
                model=MODEL,
                api_key=GEMINI_API_KEY,
                # temperature=0.5,
                # top_p=1,
                # stream=true,
            ),
        ),
        embedder=dict(
            provider="google", # or openai, ollama, ...
            config=dict(
                model="models/embedding-001",
                task_type="retrieval_document",
                # api_key=GEMINI_API_KEY,
                # title="Embeddings",
            ),
        ),
    )
)

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

        # super().__init__()
        # self.name = "Problem Recommender"
        # self.description = "Recommends problems based on topics and difficulty"

    # async def recommend_problems(self,
                               # topics: List[str],
                               # difficulty_levels: List[str],
                               # companies: Optional[List[str]] = None) -> List[Dict]:
        # """
        # Recommend problems based on topics, difficulty levels, and optionally companies
        # """
        # try:
            # # Load LeetCode dataset
            # # This would be implemented based on your data storage
            # problems_df = pd.read_csv('path_to_leetcode_dataset.csv')

            # # Filter problems based on criteria
            # filtered_problems = problems_df[
               # (problems_df['difficulty'].isin(difficulty_levels)) &
               # (problems_df['related_topics'].apply(lambda x: any(topic in x for topic in topics)))
            # ]

            # if companies:
                # filtered_problems = filtered_problems[
                    # filtered_problems['companies'].apply(lambda x: any(company in x for company in companies))
                # ]

            # # Sort by acceptance rate and frequency
            # filtered_problems = filtered_problems.sort_values(
                # by=['acceptance_rate', 'frequency'],
                # ascending=[False, False]
            # )

            # # Convert to list of dictionaries
            # recommendations = filtered_problems.head(10).to_dict('records')

            # return recommendations
        # except Exception as e:
            # print(f"Error recommending problems: {str(e)}")
            # return []
            
        super().__init__(
            name="Problem Recommender",
            role="Problem Selection Specialist",
            llm=LLM(model="gemini/gemini-2.5-flash-preview-04-17",api_key=GEMINI_API_KEY),
            goal="Recommend relevant DSA problems based on the user's weekly topics, difficulty, and company tags.",
            backstory="You're an expert in curating coding problems tailored to learning goals.",
            tools=[csv_tool],
            verbose=True
        )

class ExplanationAgent(Agent):
    def __init__(self):
        super().__init__(
            name="Problem Explainer",
            role="DSA Problem Explanation Specialist",
            llm=LLM(model="gemini/gemini-2.5-flash-preview-04-17", api_key=GEMINI_API_KEY),
            goal="Provide clear, detailed explanations of DSA problems, including approaches, time complexity, and space complexity.",
            backstory="Expert in breaking down complex DSA problems into understandable concepts with clear explanations and examples.",
            tools=[csv_tool],
            verbose=True
        )

# class FeedbackAgent(Agent):
#     def __init__(self):
#         super().__init__(
#             name="Progress Analyst",
#             role="Learning Progress Specialist",
#             llm=LLM(model=MODEL,api_key=GEMINI_API_KEY),
#             goal="Analyze user progress against their roadmap and provide actionable feedback.",
#             backstory="Expert in learning analytics and performance improvement strategies.",
#             tools=[FeedbackTool()]
#         )

# class ExplanationAgent(Agent):
#     def __init__(self):
#         super().__init__(
#             name="Solution Expert",
#             role="Problem Solution Specialist",
#             llm=LLM(model=MODEL,api_key=GEMINI_API_KEY),
#             goal="Provide clear explanations and hints for DSA problems on demand.",
#             backstory="Skilled at breaking down complex problems into understandable steps.",
#             tools=[ExplanationTool()]
#         )
# from crewai import Crew, Task
# from .specialized import RoadmapAgent, ProblemRecommenderAgent, FeedbackAgent, ExplanationAgent
# import json
# from pydantic import BaseModel

# class DSACrew:
#     def __init__(self):
#         self.roadmap_agent = RoadmapAgent()
#         self.recommender_agent = ProblemRecommenderAgent()
#         # self.feedback_agent = FeedbackAgent()
#         # self.explanation_agent = ExplanationAgent()
        
#         self.crew = Crew(
#             agents=[
#                 self.roadmap_agent,
#                 self.recommender_agent,
#                 # self.feedback_agent,
#                 # self.explanation_agent
#             ],
#             tasks=[],
#             verbose=True
#         )
    
#     def create_roadmap(self, user_input: dict, user_id: str):
#         # roadmap_str = json.
#         json_output_example = """
#         {   
#             "company" : "google"
#             "roadmap_data": [
#                 {
#                     "week": 1,
#                     "DSA": {"Arrays": "Intermediate", "Linked Lists": "Basic"},
#                     "Other": {"Operating Systems": "Advanced"}
#                 },
#                 {
#                     "week": 2,
#                     "DSA": {"Graphs": "Advanced"},
#                     "Other": {"Computer Networks": "Intermediate"}
#                 }
#             ]
#         }
#         """
#         prompt = f"""
#         Generate a personalized learning roadmap for the user based on the following details:

#         - Goal: {user_input['goal']}
#         - Number of weeks: {user_input['weeks']}
#         - Weekly time available: {user_input['weekly_hours']} hours
#         - Current knowledge: {json.dumps(user_input['current_knowledge'])}

#         Note: If the user mentions one or more company names in their goal, make sure to take those into consideration too for creating the roadmap.
        
#         The roadmap should be a JSON array where each element represents a week's plan. Each week's plan should include DSA topics with their difficulty levels (Basic, Intermediate, Advanced) and, if applicable, non-DSA items with their levels. For example:

#         {json_output_example}

#         Note: 
#         - The company field can be empty if the user did not mention any company name in the "Goal" field, and if they mention more than one company then separate them by commas and include them into the "company" field (e.g, "google, facebook, netflix).
#         - The example is not exhaustive, and it is only provided for the structure of the JSON response. (the number of weeks, number of topics, etc. can vary based on the user input) 
#         - Ensure the response is a valid JSON array in this exact format without any extra markdown formatting (return it in plaintext format).
#         """

#         def save_to_db(roadmap_data: dict):
#             try:
#                 print(roadmap_data)
#                 db_data = {
#                     "user_id": user_id,
#                     "roadmap_data": roadmap_data["roadmap_data"],
#                     "created_at": "now()",
#                 }
#                 if "company" in roadmap_data:
#                     db_data["company"] = roadmap_data["company"]
                
#                 response = supabase.table("roadmaps").insert(db_data).execute()
#                 if not response.data:
#                     raise Exception("Failed to save roadmap")
#                 return roadmap_data
#             except Exception as e:
#                 raise Exception(f"Error saving roadmap: {str(e)}")

#         task = Task(
#             description=prompt,
#             expected_output=json_output_example,
#             agent=self.roadmap_agent,
#             # output_json=roadmap_str, # output
#             callback=save_to_db,
#         )
#         return self.crew.kickoff({"user_input": user_input})
#         # return task
    
#     # def recommend_problems(self, week: int, topics: list, difficulty: str, company_tags: list = []):
#     #     task = Task(
#     #         description=f"Recommend problems for week {week} with topics {topics}, difficulty {difficulty}, and company tags {company_tags}",
#     #         expected_output="A list of problems with title, difficulty, and URL.",
#     #         agent=self.recommender_agent
#     #     )
#     #     return self.crew.kickoff({"week": week, "topics": topics, "difficulty": difficulty, "company_tags": company_tags})
    
#     # def analyze_progress(self, user_id: str):
#     #     task = Task(
#     #         description=f"Analyze progress for user {user_id} against their roadmap",
#     #         expected_output="Feedback including completion percentage and focus areas.",
#     #         agent=self.feedback_agent
#     #     )
#     #     return self.crew.kickoff({"user_id": user_id})
    
#     # def get_explanation(self, problem_id: str):
#     #     task = Task(
#     #         description=f"Provide explanation for problem {problem_id}",
#     #         expected_output="Explanation text.",
#     #         agent=self.explanation_agent
#     #     )
#     #     return self.crew.kickoff({"problem_id": problem_id})

from crewai import Crew, Task
from .specialized import RoadmapAgent, ProblemRecommenderAgent
from supabase_client import supabase
import json

class DSACrew:
    def __init__(self):
        self.roadmap_agent = RoadmapAgent()
        self.recommender_agent = ProblemRecommenderAgent()
        
        self.crew = Crew(
            agents=[
                self.roadmap_agent,
                self.recommender_agent,
            ],
            tasks=[],  # We'll add tasks dynamically
            verbose=True
        )
    
    def create_roadmap(self, user_input: dict, user_id: str):
        json_output_example = """
        {   
            "company" : "google",
            "roadmap_data": [
                {
                    "week": 1,
                    "DSA": {"Arrays": "Intermediate", "Linked Lists": "Basic"},
                    "Other": {"Operating Systems": "Advanced"}
                },
                {
                    "week": 2,
                    "DSA": {"Graphs": "Advanced"},
                    "Other": {"Computer Networks": "Intermediate"}
                }
            ]
        }
        """
        
        def save_to_db(roadmap_data: dict):
            try:
                print(roadmap_data)
                db_data = {
                    "user_id": user_id,
                    "roadmap_data": roadmap_data["roadmap_data"],
                    "created_at": "now()",
                }
                if "company" in roadmap_data:
                    db_data["company"] = roadmap_data["company"]
                
                response = supabase.table("roadmaps").insert(db_data).execute()
                if not response.data:
                    raise Exception("Failed to save roadmap")
                return roadmap_data
            except Exception as e:
                raise Exception(f"Error saving roadmap: {str(e)}")

        # Format the context properly for CrewAI
        task_context = [{
            "description": f"""
            Generate a personalized learning roadmap for the user based on the following details:

            - Goal: {user_input['goal']}
            - Number of weeks: {user_input['weeks']}
            - Weekly time available: {user_input['weekly_hours']} hours
            - Current knowledge: {json.dumps(user_input['current_knowledge'])}

            Note: If the user mentions one or more company names in their goal, make sure to take those into consideration too for creating the roadmap.
            """,
            "expected_output": json_output_example
        }]

        # Create the roadmap generation task
        roadmap_task = Task(
            description=f"""
            Generate a personalized learning roadmap for the user based on the following details:

            - Goal: {user_input['goal']}
            - Number of weeks: {user_input['weeks']}
            - Weekly time available: {user_input['weekly_hours']} hours
            - Current knowledge: {json.dumps(user_input['current_knowledge'])}

            Note: If the user mentions one or more company names in their goal, make sure to take those into consideration too for creating the roadmap.
            
            The roadmap should be a JSON array where each element represents a week's plan. Each week's plan should include DSA topics with their difficulty levels (Basic, Intermediate, Advanced) and, if applicable, non-DSA items with their levels. For example:

            {json_output_example}

            Note: 
            - The company field can be empty if the user did not mention any company name in the "Goal" field, and if they mention more than one company then separate them by commas and include them into the "company" field (e.g, "google, facebook, netflix").
            - The example is not exhaustive, and it is only provided for the structure of the JSON response. (the number of weeks, number of topics, etc. can vary based on the user input) 
            - Ensure the response is a valid JSON array in this exact format without any extra markdown formatting (return it in plaintext format).
            """,
            expected_output=json_output_example,
            agent=self.roadmap_agent,
            context=task_context  # Now properly formatted context
        )

        # Create a new crew instance with the task
        crew = Crew(
            agents=[self.roadmap_agent],
            tasks=[roadmap_task],
            verbose=True
        )

        # Execute the crew and get the result
        result = crew.kickoff()
        
        # Process the result and save to database
        try:
            # Parse the result if it's a string
            if isinstance(result, str):
                result = json.loads(result)
            
            # Save to database
            return save_to_db(result)
        except Exception as e:
            raise Exception(f"Error processing roadmap result: {str(e)}")
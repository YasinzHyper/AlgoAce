from crewai.tools import BaseTool
from crewai_tools import CSVSearchTool
from supabase import create_client
import json
from google import genai  # Import Google's generative AI library
from google.genai import types
from config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)

def extract_json_str(roadmap:str) -> json:
        try:
        # Extract JSON from potential code block
            if '```json' in roadmap:
                start = roadmap.find('```json') + len('```json')
                end = roadmap.find('```', start)
                if end == -1:
                    end = len(roadmap)
                json_str = roadmap[start:end].strip()
            else:
                json_str = roadmap.strip()
            # Debug output
            print(f"Gemini response (cleaned): {json_str}")
            # Parse and return the JSON object directly
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            error_message = {"error": f"Invalid JSON: {str(e)}"}
            print(error_message)
            return error_message
        except Exception as e:
            error_message = {"error": f"Failed to process roadmap: {str(e)}"}
            print(error_message)
            return error_message

class RoadmapTool(BaseTool):
    name: str = "Roadmap Tool"
    description: str = "Generates a personalized DSA roadmap using Gemini API."
    
    def _run(self, user_input: dict) -> json:
        json_example = """
        {   
            "company" : "google"
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
        prompt = f"""
        Generate a personalized learning roadmap for the user based on the following details:

        - Goal: {user_input['goal']}
        - Number of weeks: {user_input['weeks']}
        - Weekly time available: {user_input['weekly_hours']} hours
        - Current knowledge: {json.dumps(user_input['current_knowledge'])}

        Note: If the user mentions one or more company names in their goal, make sure to take those into consideration too for creating the roadmap.
        
        The roadmap should be a JSON array where each element represents a week's plan. Each week's plan should include DSA topics with their difficulty levels (Basic, Intermediate, Advanced) and, if applicable, non-DSA items with their levels. For example:

        {json_example}

        Note: 
        - The company field can be empty if the user did not mention any company name in the "Goal" field, and if they mention more than one company then separate them by commas and include them into the "company" field (e.g, "google, facebook, netflix).
        - The example is not exhaustive, and it is only provided for the structure of the JSON response. (the number of weeks, number of topics, etc. can vary based on the user input) 
        - Ensure the response is a valid JSON array in this exact format without any extra markdown formatting (return it in plaintext format).
        """
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash-001",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction="You are a helpful assistant that generates well thought out personalized learning roadmaps in valid JSON format.",
                    temperature=0.7,
                )
            )
            roadmap = response.text.strip()
            print(f"Gemini response: {roadmap}")  # Debug output
            return extract_json_str(roadmap)  # Now returns a dict directly
        except Exception as e:
            error_msg = {"error": f"Failed to generate roadmap: {str(e)}"}
            print(f"Generated error response: {error_msg}")  # Debug output
            return error_msg

# class ProblemRecommendationTool(BaseTool):
#     name: str = "Problem Recommendation Tool"
#     description: str = "Recommends problems based on topics, difficulty, and optionally company from the CSV dataset."

#     def __init__(self):
#         self.csv_tool = CSVSearchTool(csv="dataset/leetcode-problems.csv")

#     def _run(self, roadmap_data: list, company: str = None, num_problems_per_topic: int = 3) -> list:
#         result = []
#         for week_data in roadmap_data:
#             week = week_data["week"]
#             dsa_topics = week_data["DSA"]
#             weekly_problems = {"week": week, "problems": []}
#             for topic, difficulty in dsa_topics.items():
#                 # Map difficulty levels
#                 if difficulty == "Basic":
#                     csv_difficulty = "Easy"
#                 elif difficulty == "Intermediate":
#                     csv_difficulty = "Medium"
#                 elif difficulty == "Advanced":
#                     csv_difficulty = "Hard"
#                 else:
#                     continue
#                 # Construct query for CSVSearchTool
#                 query = f"SELECT id FROM csv WHERE related_topics LIKE '%{topic}%' AND difficulty = '{csv_difficulty}'"
#                 if company:
#                     query += f" AND companies LIKE '%{company}%'"
#                 query += f" LIMIT {num_problems_per_topic}"
#                 search_results = self.csv_tool.run(query)
#                 # Extract problem IDs (assuming search_results is a list of dicts)
#                 problem_ids = [int(result["id"]) for result in search_results]
#                 weekly_problems["problems"].extend(problem_ids)
#             result.append(weekly_problems)
#         return result

# class ProblemRecommendationTool(BaseTool):
#     name: str = "Problem Recommendation Tool"
#     description: str = "Recommends problems based on topics and difficulty."

#     def _run(self, week: int, topics: list, difficulty: str, company_tags: list) -> str:
#         # Use CSVSearchTool or custom logic to find problems
#         return json.dumps({"problems": "list of problems"})

# class ExplanationTool(BaseTool):
#     name: str = "Explanation Tool"
#     description: str = "Provides explanations for problems."

#     def _run(self, problem_id: str) -> str:
#         # Fetch or generate explanation
#         return "Explanation text"

# class FeedbackTool(BaseTool):
#     name: str = "Feedback Tool"
#     description: str = "Analyzes user progress and provides feedback."

#     def _run(self, user_id: str) -> str:
#         supabase = create_client("your-supabase-url", "your-supabase-key")
#         # Fetch user progress and roadmap
#         # Calculate completion percentage and focus areas
#         return "Feedback text"
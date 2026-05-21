from crewai.tools import BaseTool
from crewai_tools import CSVSearchTool
from supabase import create_client
import json
from google import genai  # Import Google's generative AI library
from google.genai import types
from config import GEMINI_API_KEY
import os
import math
import pandas as pd
from typing import List, Dict, Optional

from dataset.os_loader import DIFF_MAP, OS_TOPICS, get_os_dataframe, normalize_topic
from dataset.dbms_loader import DBMS_TOPICS, get_dbms_dataframe, normalize_topic as normalize_dbms_topic

# Validate GEMINI_API_KEY at import time
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY is not set! Roadmap generation will fail.")
else:
    print("DEBUG: GEMINI_API_KEY is configured")

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
        subjects = user_input.get("subjects", "dsa_os")
        os_topic_list = ", ".join(OS_TOPICS)
        dbms_topic_list = ", ".join(DBMS_TOPICS)

        if subjects == "dsa":
            structure_note = (
                "The user chose DSA ONLY. Each week must have a non-empty \"DSA\" object. "
                "Omit \"Other\" or use an empty object {} for every week."
            )
            json_example = """
            {
                "company": "google",
                "roadmap_data": [
                    {"week": 1, "DSA": {"Arrays": "Intermediate", "Linked Lists": "Basic"}, "Other": {}}
                ]
            }
            """
        elif subjects == "os":
            structure_note = (
                "The user chose OPERATING SYSTEMS ONLY. Each week must have a non-empty \"Other\" object "
                f"using ONLY these OS topic keys (granular subtopics): {os_topic_list}. "
                "Omit \"DSA\" or use {} for every week."
            )
            json_example = """
            {
                "company": "",
                "roadmap_data": [
                    {"week": 1, "DSA": {}, "Other": {"OS Introduction": "Basic", "Types of OS": "Basic"}}
                ]
            }
            """
        elif subjects == "dbms":
            structure_note = (
                "The user chose DATABASE MANAGEMENT SYSTEMS ONLY. Each week must have a non-empty \"Other\" object "
                f"using ONLY these DBMS topic keys: {dbms_topic_list}. "
                "Omit \"DSA\" or use {} for every week."
            )
            json_example = """
            {
                "company": "",
                "roadmap_data": [
                    {"week": 1, "DSA": {}, "Other": {"DBMS Introduction": "Basic", "SQL Basics": "Basic"}}
                ]
            }
            """
        elif subjects in ("dsa_os", "dsa_dbms", "os_dbms", "all"):
            # Map old "both" value to "dsa_os" for backward compatibility
            if subjects == "dsa_os":
                structure_note = (
                    "The user chose DSA + OS (both). Each week should include both \"DSA\" LeetCode topics "
                    f"and \"Other\" OS topics from this list: {os_topic_list}. Balance weeks across the plan."
                )
                json_example = """
                {
                    "company": "google",
                    "roadmap_data": [
                        {
                            "week": 1,
                            "DSA": {"Arrays": "Intermediate"},
                            "Other": {"Process Scheduling": "Basic", "Virtual Memory": "Intermediate"}
                        }
                    ]
                }
                """
            elif subjects == "dsa_dbms":
                structure_note = (
                    "The user chose DSA + DBMS (both). Each week should include both \"DSA\" LeetCode topics "
                    f"and \"Other\" DBMS topics from this list: {dbms_topic_list}. Balance weeks across the plan."
                )
                json_example = """
                {
                    "company": "google",
                    "roadmap_data": [
                        {
                            "week": 1,
                            "DSA": {"Arrays": "Intermediate"},
                            "Other": {"SQL Basics": "Basic", "Normalization": "Intermediate"}
                        }
                    ]
                }
                """
            elif subjects == "os_dbms":
                structure_note = (
                    "The user chose OS + DBMS (both). Each week should include both \"DSA\" (actually OS) "
                    f"topics and \"Other\" (actually DBMS) topics. Use these lists:\nOS: {os_topic_list}\nDBMS: {dbms_topic_list}"
                )
                json_example = """
                {
                    "company": "",
                    "roadmap_data": [
                        {
                            "week": 1,
                            "DSA": {"OS Introduction": "Basic"},
                            "Other": {"SQL Basics": "Basic", "Transactions": "Intermediate"}
                        }
                    ]
                }
                """
            else:  # "all"
                structure_note = (
                    "The user chose DSA + OS + DBMS (all three). Each week should include DSA topics, "
                    "OS topics, and DBMS topics. Use \"DSA\" for LeetCode, and \"Other\" for OS and DBMS combined. "
                    f"Available OS topics: {os_topic_list}. Available DBMS topics: {dbms_topic_list}"
                )
                json_example = """
                {
                    "company": "google",
                    "roadmap_data": [
                        {
                            "week": 1,
                            "DSA": {"Arrays": "Intermediate"},
                            "Other": {"Process Scheduling": "Basic", "SQL Basics": "Basic"}
                        }
                    ]
                }
                """
        else:
            structure_note = (
                "The user chose DSA + OS (both). Each week should include both \"DSA\" LeetCode topics "
                f"and \"Other\" OS topics from this list: {os_topic_list}. Balance weeks across the plan."
            )
            json_example = """
            {
                "company": "google",
                "roadmap_data": [
                    {
                        "week": 1,
                        "DSA": {"Arrays": "Intermediate"},
                        "Other": {"Process Scheduling": "Basic", "Virtual Memory": "Intermediate"}
                    }
                ]
            }
            """

        prompt = f"""
        Generate a personalized learning roadmap for the user based on the following details:

        - Goal: {user_input['goal']}
        - Subject focus: {subjects}
        - Number of weeks: {user_input['weeks']}
        - Weekly time available: {user_input['weekly_hours']} hours
        - Current knowledge: {json.dumps(user_input.get('current_knowledge') or {})}

        {structure_note}

        Note: If the user mentions company names in their goal, include them in the "company" field (comma-separated).

        Example JSON structure:

        {json_example}

        Rules:
        - Return valid JSON with keys "company" (string, may be empty) and "roadmap_data" (array of week objects).
        - Each week object has "week" (int), "DSA" (object topic->level), "Other" (object topic->level).
        - Levels are only: Basic, Intermediate, Advanced.
        - No markdown fences; plaintext JSON only.
        """
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
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
        
class ProblemRecommendationTool(BaseTool):
    """Tool for generating problem recommendations from the LeetCode dataset."""
    name: str = "Problem Recommendation Tool"
    description: str = (
        "Recommends LeetCode problems for each week based on DSA topics, difficulty levels, "
        "company preferences, and user's available weekly hours."
    )
    df: pd.DataFrame = None

    def __init__(self):
        super().__init__()
        # Load the dataset
        dataset_path = os.path.join(os.path.dirname(__file__), "dataset", "leetcode-problems.csv")
        self.df = pd.read_csv(dataset_path)
        # Precompute normalized topics as a list for each problem
        self.df['normalized_topics'] = self.df['related_topics'].apply(
            lambda x: [self.normalize_topic(t.strip()) for t in x.split(',')] if pd.notnull(x) else []
        )
        # Verify required columns
        required_columns = ['id', 'difficulty', 'related_topics', 'companies']
        for col in required_columns:
            if col not in self.df.columns:
                raise ValueError(f"Dataset missing required column: {col}")

    def normalize_topic(self, topic: str) -> str:
        """Normalize a topic by converting to lowercase and removing trailing 's'."""
        return topic.lower().rstrip('s')

    def _run(self, roadmap_data: List[Dict], company: Optional[str] = None, user_input: Optional[Dict] = None) -> List[Dict]:
        """Generate problem recommendations based on roadmap, company preferences, and user input."""
        # Validate user input
        if user_input is None or 'weekly_hours' not in user_input:
            raise ValueError("user_input must contain 'weekly_hours'")
        weekly_hours = user_input['weekly_hours']

        # Define mappings and constants
        diff_map = {"Basic": "Easy", "Intermediate": "Medium", "Advanced": "Hard"}
        time_per_problem = {"Easy": 1/3, "Medium": 2/3, "Hard": 1}  # Hours (20, 40, 60 minutes)

        subjects = (user_input or {}).get("subjects", "dsa_os")
        # Generate problems only if DSA is included
        include_dsa = subjects in ("dsa", "dsa_os", "dsa_dbms", "all")
        if not include_dsa:
            return []

        result = []
        for week_data in roadmap_data:
            week = week_data.get("week")
            dsa_topics = week_data.get("DSA") or {}
            other_topics = list((week_data.get("Other") or {}).keys())
            if not dsa_topics:
                continue

            num_dsa = len(dsa_topics)
            # Calculate num_other only if OS or DBMS is included (combined with DSA)
            include_other = subjects in ("dsa_os", "dsa_dbms", "os_dbms", "all")
            num_other = len(other_topics) if include_other else 0
            num_topics = max(num_dsa + num_other, num_dsa) if num_dsa > 0 else max(num_other, 1)
            time_per_topic = weekly_hours / num_topics if num_topics > 0 else weekly_hours
            weekly = {"week": week, "problems": [], "other_topics": other_topics, "os_item_ids": [], "dbms_item_ids": []}

            for topic, level in dsa_topics.items():
                # Map difficulty
                problem_difficulty = diff_map.get(level)
                if not problem_difficulty:
                    continue  # Skip invalid difficulty levels

                # Calculate number of problems
                time_per_problem_hours = time_per_problem[problem_difficulty]
                num_problems = max(1, math.floor(time_per_topic / time_per_problem_hours))

                # Normalize roadmap topic
                normalized_topic = self.normalize_topic(topic)

                # Filter problems by difficulty and topic
                df_filtered = self.df[
                    (self.df["difficulty"] == problem_difficulty) &
                    (self.df['normalized_topics'].apply(lambda x: normalized_topic in x))
                ].copy()

                # Prioritize by company if specified
                if company:
                    preferred_companies = [c.strip().lower() for c in company.split(",")]
                    df_filtered['preferred'] = df_filtered['companies'].apply(
                        lambda x: any(c in preferred_companies for c in ([comp.strip().lower() for comp in x.split(',')] if pd.notnull(x) else []))
                    )
                    df_filtered = df_filtered.sort_values(by='preferred', ascending=False)

                # Select problem IDs
                problem_ids = df_filtered["id"].head(num_problems).tolist()
                weekly["problems"].extend(problem_ids)

            if weekly["problems"]:
                result.append(weekly)

        return result


class OSRecommendationTool(BaseTool):
    """Recommend OS study items from the CodeHelp seed catalog."""

    name: str = "OS Recommendation Tool"
    description: str = "Recommends OS readings and questions per week from os-study-items.csv."

    def _run(
        self,
        roadmap_data: List[Dict],
        company: Optional[str] = None,
        user_input: Optional[Dict] = None,
    ) -> List[Dict]:
        if user_input is None or "weekly_hours" not in user_input:
            raise ValueError("user_input must contain 'weekly_hours'")
        subjects = user_input.get("subjects", "dsa_os")
        # Generate OS items only if OS is included
        include_os = subjects in ("os", "dsa_os", "os_dbms", "all")
        if not include_os:
            return []

        weekly_hours = user_input["weekly_hours"]
        df = get_os_dataframe()
        result = []

        for week_data in roadmap_data:
            week = week_data.get("week")
            os_topics = week_data.get("Other") or {}
            dsa_topics = week_data.get("DSA") or {}
            if not os_topics:
                continue

            other_keys = list(os_topics.keys())
            include_dsa = subjects in ("dsa_os", "all")
            num_dsa = len(dsa_topics) if include_dsa else 0
            num_topics = max(len(os_topics) + num_dsa, len(os_topics))
            time_per_topic = weekly_hours / num_topics if num_topics > 0 else weekly_hours
            hours_per_item = 0.5

            weekly = {
                "week": week,
                "problems": [],
                "other_topics": other_keys,
                "os_item_ids": [],
            }
            used_ids: set = set()

            for topic, level in os_topics.items():
                diff = DIFF_MAP.get(level, "Easy")
                norm = normalize_topic(topic)
                def _matches(row_norm: str) -> bool:
                    if not row_norm:
                        return False
                    return row_norm == norm or norm in row_norm or row_norm in norm

                pool = df[
                    (df["difficulty"] == diff)
                    & (df["normalized_topic"].apply(_matches))
                ]
                if pool.empty:
                    pool = df[df["normalized_topic"].apply(_matches)]
                if pool.empty:
                    pool = df[df["topic"].str.lower().str.contains(norm.split()[0], na=False)]

                max_items = max(1, min(3, math.floor(time_per_topic / hours_per_item)))
                for item_type in ("reading", "question"):
                    subset = pool[pool["type"] == item_type]
                    if subset.empty:
                        subset = pool
                    for item_id in subset["id"].tolist():
                        if item_id in used_ids:
                            continue
                        weekly["os_item_ids"].append(int(item_id))
                        used_ids.add(item_id)
                        if len([i for i in weekly["os_item_ids"]]) >= max_items:
                            break
                    if len(weekly["os_item_ids"]) >= max_items:
                        break

            if weekly["os_item_ids"] or other_keys:
                result.append(weekly)

        return result


class DBMSRecommendationTool(BaseTool):
    """Recommend DBMS study items from the DBMS seed catalog."""

    name: str = "DBMS Recommendation Tool"
    description: str = "Recommends DBMS readings and questions per week from dbms-study-items.csv."

    def _run(
        self,
        roadmap_data: List[Dict],
        company: Optional[str] = None,
        user_input: Optional[Dict] = None,
    ) -> List[Dict]:
        if user_input is None or "weekly_hours" not in user_input:
            raise ValueError("user_input must contain 'weekly_hours'")
        subjects = user_input.get("subjects", "all")
        # Generate DBMS items only if DBMS is included
        include_dbms = subjects in ("dbms", "dsa_dbms", "os_dbms", "all")
        if not include_dbms:
            return []

        weekly_hours = user_input["weekly_hours"]
        df = get_dbms_dataframe()
        result = []

        for week_data in roadmap_data:
            week = week_data.get("week")
            dbms_topics = week_data.get("Other") or {}
            dsa_topics = week_data.get("DSA") or {}
            if not dbms_topics:
                continue

            other_keys = list(dbms_topics.keys())
            num_dsa = len(dsa_topics) if subjects in ("dsa_dbms", "all") else 0
            num_topics = max(len(dbms_topics) + num_dsa, len(dbms_topics))
            time_per_topic = weekly_hours / num_topics if num_topics > 0 else weekly_hours
            hours_per_item = 0.5

            weekly = {
                "week": week,
                "problems": [],
                "other_topics": other_keys,
                "dbms_item_ids": [],
            }
            used_ids: set = set()

            for topic, level in dbms_topics.items():
                diff = level  # Use level directly: "Easy", "Medium", "Hard"
                norm = normalize_dbms_topic(topic)
                
                def _matches(row_norm: str) -> bool:
                    if not row_norm:
                        return False
                    return row_norm == norm or norm in row_norm or row_norm in norm

                pool = df[
                    (df["difficulty"] == diff)
                    & (df["normalized_topic"].apply(_matches))
                ]
                if pool.empty:
                    pool = df[df["normalized_topic"].apply(_matches)]
                if pool.empty:
                    pool = df[df["topic"].str.lower().str.contains(norm.split()[0], na=False)]

                max_items = max(1, min(3, math.floor(time_per_topic / hours_per_item)))
                for item_type in ("reading", "concept"):
                    subset = pool[pool["type"] == item_type]
                    if subset.empty:
                        subset = pool
                    for item_id in subset["id"].tolist():
                        if item_id in used_ids:
                            continue
                        weekly["dbms_item_ids"].append(int(item_id))
                        used_ids.add(item_id)
                        if len(weekly["dbms_item_ids"]) >= max_items:
                            break
                    if len(weekly["dbms_item_ids"]) >= max_items:
                        break

            if weekly["dbms_item_ids"] or other_keys:
                result.append(weekly)

        return result


def merge_week_recommendations(
    lc_weeks: List[Dict], os_weeks: List[Dict], dbms_weeks: List[Dict] = None
) -> List[Dict]:
    """Merge LeetCode, OS, and DBMS weekly recommendations by week number."""
    if dbms_weeks is None:
        dbms_weeks = []
    
    by_week: Dict[int, Dict] = {}
    for w in lc_weeks or []:
        week = w["week"]
        by_week[week] = {
            "week": week,
            "problems": w.get("problems", []),
            "other_topics": w.get("other_topics", []),
            "os_item_ids": w.get("os_item_ids", []),
            "dbms_item_ids": w.get("dbms_item_ids", []),
        }
    for w in os_weeks or []:
        week = w["week"]
        if week in by_week:
            existing = by_week[week]
            existing["other_topics"] = list(
                dict.fromkeys(existing.get("other_topics", []) + w.get("other_topics", []))
            )
            existing["os_item_ids"] = w.get("os_item_ids", [])
            if not existing.get("problems"):
                existing["problems"] = w.get("problems", [])
        else:
            by_week[week] = {
                "week": week,
                "problems": w.get("problems", []),
                "other_topics": w.get("other_topics", []),
                "os_item_ids": w.get("os_item_ids", []),
                "dbms_item_ids": w.get("dbms_item_ids", []),
            }
    for w in dbms_weeks or []:
        week = w["week"]
        if week in by_week:
            existing = by_week[week]
            existing["other_topics"] = list(
                dict.fromkeys(existing.get("other_topics", []) + w.get("other_topics", []))
            )
            existing["dbms_item_ids"] = w.get("dbms_item_ids", [])
            if not existing.get("problems"):
                existing["problems"] = w.get("problems", [])
        else:
            by_week[week] = {
                "week": week,
                "problems": w.get("problems", []),
                "other_topics": w.get("other_topics", []),
                "os_item_ids": w.get("os_item_ids", []),
                "dbms_item_ids": w.get("dbms_item_ids", []),
            }
    return sorted(by_week.values(), key=lambda x: x["week"])


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
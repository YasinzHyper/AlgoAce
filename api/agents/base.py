# from crewai import Agent, LLM
# from config import MODEL,GEMINI_API_KEY

# class DSAAgent(Agent):
#     def __init__(self, name: str, role: str, goal: str, backstory: str, tools: list = []):
#         super().__init__(
#             name=name,
#             role=role,
#             goal=goal,
#             backstory=backstory,
#             llm=LLM(model=MODEL,api_key=GEMINI_API_KEY),
#             verbose=True,
#             allow_delegation=True,
#             tools=tools
#         )
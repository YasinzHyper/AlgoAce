from crewai import Agent

class DSAAgent(Agent):
    def __init__(self, name: str, role: str, goal: str, backstory: str, tools: list = []):
        super().__init__(
            name=name,
            role=role,
            goal=goal,
            backstory=backstory,
            verbose=True,
            allow_delegation=True,
            tools=tools
        )
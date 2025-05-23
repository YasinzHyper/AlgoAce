from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize the LLM
llm = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0.7,
    api_key=os.getenv("OPENAI_API_KEY")
)

# Create agents
researcher = Agent(
    role='Research Analyst',
    goal='Conduct thorough research on given topics',
    backstory='Expert researcher with years of experience in data analysis',
    llm=llm,
    verbose=True
)

writer = Agent(
    role='Content Writer',
    goal='Create engaging and informative content',
    backstory='Experienced writer with a passion for clear communication',
    llm=llm,
    verbose=True
)

# Create tasks
research_task = Task(
    description='Research the latest trends in artificial intelligence',
    agent=researcher
)

writing_task = Task(
    description='Write a comprehensive article about AI trends',
    agent=writer
)

# Create and run the crew
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    verbose=True
)

def run_example():
    result = crew.kickoff()
    return result

if __name__ == "__main__":
    result = run_example()
    print("\nFinal Result:")
    print(result) 
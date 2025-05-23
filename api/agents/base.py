from typing import Dict, List, Optional
from pydantic import BaseModel
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OpenAIEmbeddings
from crewai import Agent, Task, Crew
from config import OPENAI_API_KEY, validate_env

# Validate environment variables
validate_env()

class BaseKnowledgeBase:
    def __init__(self, collection_name: str):
        self.embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
        self.vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=self.embeddings
        )
    
    def query(self, query: str, k: int = 3) -> List[Dict]:
        return self.vectorstore.similarity_search(query, k=k)

class DSAAgent(Agent):
    def __init__(
        self,
        name: str,
        role: str,
        knowledge_base: BaseKnowledgeBase,
        goal: str,
        backstory: str
    ):
        # Initialize the base Agent class
        super().__init__(
            name=name,
            role=role,
            goal=goal,
            backstory=backstory,
            verbose=True,
            allow_delegation=True,
            llm_config={"api_key": OPENAI_API_KEY}
        )
        # Store knowledge_base as a private attribute
        self._knowledge_base = knowledge_base
    
    def retrieve_context(self, query: str) -> str:
        docs = self._knowledge_base.query(query)
        return "\n".join([doc.page_content for doc in docs]) 
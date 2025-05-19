import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Validate required environment variables
def validate_env():
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set") 
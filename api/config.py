import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Validate required environment variables
def validate_env():
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set") 
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL environment variable is not set") 
    if not SUPABASE_KEY:
        raise ValueError("SUPABASE_KEY environment variable is not set") 
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set") 

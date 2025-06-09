import uvicorn
import sys
import os
from dotenv import load_dotenv

def check_environment():
    """Check if all required environment variables are set."""
    required_vars = [
        'GEMINI_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_KEY',
        'MODEL',
        'GOOGLE_API_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("Error: Missing required environment variables:")
        for var in missing_vars:
            print(f"- {var}")
        return False
    return True

def main():
    """Start the FastAPI server with proper error handling."""
    # Load environment variables
    load_dotenv()
    
    # Check environment variables
    if not check_environment():
        print("\nPlease set the missing environment variables in your .env file.")
        sys.exit(1)
    
    try:
        print("Starting server...")
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except Exception as e:
        print(f"Error starting server: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 
# AlgoAce API

This is the backend API for AlgoAce, a DSA learning platform that uses AI to provide personalized learning experiences.

## Setup

1. Create a virtual environment:
```bash
python -m venv .venv
```

2. Activate the virtual environment:
- Windows:
```bash
.venv\Scripts\activate
```
- Unix/MacOS:
```bash
source .venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the root directory with the following variables:
```
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
MODEL='gemini-2.5-flash-preview-05-20'
```

5. Run the development server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access:
- Interactive API docs (Swagger UI): `http://localhost:8000/docs`
- Alternative API docs (ReDoc): `http://localhost:8000/redoc`

## Project Structure

```
api/
├── agents/             # AI agents implementation
│   ├── base.py        # Base agent classes
│   ├── crew.py        # Crew orchestration
│   └── specialized.py # Specialized agent implementations
├── main.py            # FastAPI application
├── config.py          # Configuration and environment variables
└── requirements.txt   # Python dependencies
```

## Development

- The API uses FastAPI for the web framework
- CrewAI for AI agent orchestration
- LangChain for vector storage and embeddings
- ChromaDB for vector database 
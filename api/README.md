# AlgoAce API

This is the backend API for AlgoAce, a DSA learning platform that uses AI to provide personalized learning experiences.

## Setup

1. Navigate to the `/api` directory:
```bash
cd api
```

2. Create a virtual environment:
```bash
python3 -m venv .venv
```

3. Activate the virtual environment:
- **Linux / WSL / macOS:**
```bash
source .venv/bin/activate
```
- **Windows (CMD):**
```bash
.venv\Scripts\activate
```
- **Windows (PowerShell):**
```bash
.venv\Scripts\Activate.ps1
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create a `.env` file in the `api/` directory with the following variables:
```
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
MODEL='gemini-2.5-flash-preview-05-20'
GOOGLE_API_KEY=your_gemini_api_key_here
```

6. Run the development server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

---

## Note: Prerequisites for Linux / WSL

If you are on Ubuntu/Debian (including WSL), ensure the following are installed before proceeding:

```bash
# Install Python 3 and required tooling
sudo apt update
sudo apt install -y python3 python3-pip python3.12-venv
```

> **Note:** The `python3-venv` package (or `python3.12-venv` for Python 3.12) is required to create virtual environments on Ubuntu/Debian. Without it, `python3 -m venv` will fail.

---

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
- ChromaDB for vector database

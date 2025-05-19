# AlgoAce

AlgoAce is an AI-powered DSA (Data Structures and Algorithms) learning platform that provides personalized learning experiences, problem recommendations, and detailed explanations.

## Project Structure

```
AlgoAce/
├── api/                # Backend API (FastAPI)
├── client/            # Frontend (Next.js)
└── README.md          # This file
```

## Getting Started

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- OpenAI API key

### Backend Setup

1. Navigate to the API directory:
```bash
cd api
```

2. Follow the setup instructions in [api/README.md](api/README.md)

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Features

- Personalized DSA learning paths
- AI-powered problem recommendations
- Detailed problem explanations
- Progress tracking and analysis
- Interactive learning experience

## Tech Stack

### Backend
- FastAPI
- CrewAI
- LangChain
- ChromaDB
- OpenAI

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
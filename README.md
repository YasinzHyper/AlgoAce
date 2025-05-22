# AlgoAce

AlgoAce is an AI-powered DSA (Data Structures and Algorithms) learning platform that provides personalized learning experiences, problem recommendations, and detailed explanations.

## Project Structure

```
AlgoAce/
├── api/                # Backend API (FastAPI)
├── client/            # Frontend (Next.js + shadcn-ui)
└── README.md          # This file
```

## Getting Started

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- OpenAI API key

### Backend Setup

1. Navigate to the backend directory:
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

3. Set up shadcn-ui:
```bash
npx shadcn-ui@latest init
```
When prompted, use these settings:
- Would you like to use TypeScript (recommended)? Yes
- Which style would you like to use? Default
- Which color would you like to use as base color? Slate
- Where is your global CSS file? src/app/globals.css
- Do you want to use CSS variables for colors? Yes
- Where is your tailwind.config.js located? tailwind.config.js
- Configure the import alias for components? @/components
- Configure the import alias for utils? @/lib/utils

4. Run the development server:
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
- Supabase
- OpenAI

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn-ui
- React Server Components

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 

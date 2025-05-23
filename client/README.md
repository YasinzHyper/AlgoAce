# AlgoAce Client

This is the frontend application for AlgoAce, built with Next.js, TypeScript, and shadcn-ui.

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up shadcn-ui:
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

3. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
client/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   │   └── ui/          # shadcn-ui components
│   └── lib/             # Utility functions
├── public/              # Static assets
└── components.json      # shadcn-ui configuration
```

## Development

- The frontend uses Next.js 14 with App Router
- Styling is done with Tailwind CSS
- UI components are from shadcn-ui
- TypeScript for type safety

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

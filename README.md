# ANTI - CALCULATOR

AI-powered conversational assistant for UAE homebuyers to make informed Buy vs Rent and Refinance decisions.

## Overview

Instead of functioning like a traditional mortgage calculator, this system behaves like a "smart friend" — someone who talks naturally, understands vague user messages, gathers missing details, and guides users toward confident financial decisions.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Mistral AI** (LLM with function calling)
- **Vercel** (Deployment)

## Features

- ✅ Conversational interface with streaming responses
- ✅ Two scenarios: Buy vs Rent & Refinance Check
- ✅ Intent recognition from natural language
- ✅ Deterministic math functions (no LLM hallucinations)
- ✅ Function calling for accurate calculations
- ✅ In-memory conversation state management
- ✅ Clean, minimal UI design

## Getting Started

### Prerequisites

- Node.js 18+
- Mistral API key ([Get one here](https://console.mistral.ai/))

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd anticalc
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` file:

```bash
cp .env.example .env.local
```

4. Add your Mistral API key to `.env.local`:

```
MISTRAL_API_KEY=your_mistral_api_key_here
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts    # Chat API endpoint with Mistral integration
│   │   └── calc/route.ts    # Math calculation endpoint
│   ├── layout.tsx           # Root layout with font setup
│   ├── page.tsx             # Main page with scenario selection
│   └── globals.css          # Global styles and color theme
├── components/
│   ├── ChatInterface.tsx    # Main chat UI component with streaming
│   └── ScenarioSelector.tsx # Initial scenario selection
├── lib/
│   ├── math.ts              # Deterministic mortgage calculations
│   └── mistral.ts           # Mistral API integration & function calling
└── public/
```

## Architecture

### Math Layer (`lib/math.ts`)

All financial calculations are done through deterministic functions:

- EMI calculation using standard mortgage formula
- LTV/down payment validation
- Upfront costs (7% of property price)
- Buy vs Rent analysis based on stay duration

### LLM Layer (`lib/mistral.ts`)

- Handles conversation flow and intent recognition
- Uses function calling to request calculations
- Never performs math directly (prevents hallucinations)

### API Routes

- `/api/chat` - Main conversational endpoint with streaming
- `/api/calc` - Direct calculation endpoint (for testing)

## UAE Mortgage Rules (Hard Constraints)

- **Maximum LTV**: 80% (minimum 20% down payment)
- **Upfront Costs**: 7% of property price (4% transfer + 2% agency + 1% misc)
- **Interest Rate**: 4.5% annual (standard market rate)
- **Maximum Tenure**: 25 years

## Buy vs Rent Logic

- **Stay < 3 years**: Recommend renting (transaction costs too high)
- **Stay > 5 years**: Recommend buying (equity buildup)
- **3-5 years**: Show both options, let user decide

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variable: `MISTRAL_API_KEY`
4. Deploy!

The app will be live at `https://your-project.vercel.app`

## Color Theme

- Primary Background: `#1A1B2F` (Dark navy)
- Secondary Background: `#E4D4B2` (Beige)
- Accent: `#047877` (Teal)

## Font

- Lexend Deca (Google Fonts) - Clean, modern, readable

## Development Notes

- Conversation state is stored in-memory (Map) - resets on server restart
- For production, consider using a database (Redis, Supabase, etc.)
- All math is deterministic and tested
- Function calling ensures LLM never calculates numbers directly

## License

MIT

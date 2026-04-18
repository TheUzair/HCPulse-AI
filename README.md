<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/LangGraph-AI_Agent-blue?logo=python" alt="LangGraph" />
  <img src="https://img.shields.io/badge/Groq-LLM-orange" alt="Groq" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript" alt="TypeScript" />
</p>

# HCPulse AI — AI-First Healthcare Professional CRM

> A production-grade AI-powered CRM system for pharmaceutical field representatives to log, manage, and analyze Healthcare Professional (HCP) interactions using natural language.

---

## Overview

HCPulse AI replaces manual data entry with an **AI chat assistant** powered by LangGraph and Groq LLMs. Field reps can describe their HCP interactions in plain English — the AI agent automatically extracts structured data, logs it to the database, and provides intelligent follow-up suggestions.

### Key Capabilities

- **Dual-Mode Interaction Logging** — Switch between a structured form and a conversational AI chat interface
- **LangGraph AI Agent** — Intent detection → tool routing → structured execution pipeline
- **5 Specialized Tools** — Log, Edit, Get Context, Suggest Next Action, Summarize
- **Real-Time Form ↔ Chat Sync** — Data extracted from chat auto-populates the form via Redux
- **HCP Directory** — Browse, search, and manage healthcare professional profiles
- **Dashboard Analytics** — Quick stats, recent interactions, and action shortcuts

---

## Architecture

```
┌──────────────────────┐       ┌───────────────────────┐       ┌──────────────┐
│   Next.js 15 App     │       │   FastAPI Backend      │       │  PostgreSQL  │
│   (TypeScript)       │──────▶│   (Python 3.11+)      │──────▶│  (Neon/Local)│
│                      │ REST  │                       │ Async │              │
│  • shadcn/ui + TW    │       │  • SQLAlchemy ORM     │       └──────────────┘
│  • Redux Toolkit     │       │  • Repository Pattern │
│  • NextAuth (JWT)    │       │  • Service Layer      │       ┌──────────────┐
│  • App Router        │       │  • LangGraph Agent ───│──────▶│  Groq AI     │
└──────────────────────┘       └───────────────────────┘       │  (LLM API)   │
                                                               └──────────────┘
```

### Tech Stack

| Layer                | Technology                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| **Frontend**         | Next.js 15 (App Router), React 19, TypeScript                             |
| **UI Components**    | shadcn/ui, Radix Primitives, Tailwind CSS, Google Inter                   |
| **State Management** | Redux Toolkit (3 slices: auth, interaction, chat)                         |
| **Authentication**   | NextAuth.js v4 — Google OAuth + Demo credentials (JWT strategy)           |
| **Backend**          | Python 3.11+, FastAPI, Uvicorn                                            |
| **ORM / Database**   | SQLAlchemy 2.0 (async) + asyncpg → PostgreSQL                             |
| **AI Agent**         | LangGraph StateGraph with conditional routing                             |
| **LLM Provider**     | Groq API — `gemma2-9b-it` (primary), `llama-3.3-70b-versatile` (fallback) |
| **Dev Tooling**      | Concurrently, ESLint, Pydantic Settings                                   |

---

## Project Structure

```
HCPulse-AI/
├── backend/                         # FastAPI + LangGraph backend
│   ├── agent/                       # AI agent system
│   │   ├── graph.py                 # LangGraph workflow (StateGraph)
│   │   ├── state.py                 # Agent state schema (TypedDict)
│   │   └── tools/                   # 5 specialized tools
│   │       ├── log_interaction.py   # Extract & save interaction from NL
│   │       ├── edit_interaction.py  # Modify interactions via instructions
│   │       ├── get_hcp_context.py   # Retrieve HCP profile + history
│   │       ├── suggest_next_action.py # AI follow-up recommendations
│   │       └── summarize_interaction.py # Compress notes to summary
│   ├── models/                      # Data layer
│   │   ├── database_models.py       # SQLAlchemy ORM models
│   │   └── schemas.py               # Pydantic v2 request/response
│   ├── repositories/                # Data access (query builders)
│   ├── services/                    # Business logic layer
│   ├── routers/                     # FastAPI route handlers
│   ├── main.py                      # App entry point
│   ├── config.py                    # Environment configuration
│   ├── database.py                  # Async engine + session factory
│   └── requirements.txt
│
├── frontend/                        # Next.js 15 application
│   └── src/
│       ├── app/                     # App Router pages
│       │   ├── login/               # Auth page (Google + Demo)
│       │   └── dashboard/           # Protected dashboard
│       │       ├── hcp/             # HCP directory
│       │       └── interactions/    # Interaction list + new (core feature)
│       ├── components/
│       │   ├── ui/                  # 11 shadcn/ui components
│       │   ├── layout/              # Sidebar + Header
│       │   ├── interactions/        # FormMode + ChatMode
│       │   └── hcp/                 # HCP table with search
│       ├── store/                   # Redux Toolkit
│       │   └── slices/              # auth, interaction, chat
│       ├── lib/                     # API client, auth config, utils
│       └── types/                   # TypeScript interfaces
│
├── package.json                     # Root scripts (concurrently)
├── .gitignore
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **PostgreSQL** 14+ (local or hosted — e.g., Neon, Supabase)
- **Groq API Key** — Free at [console.groq.com](https://console.groq.com)

### 1. Clone & Install

```bash
git clone https://github.com/TheUzair/HCPulse-AI.git
cd HCPulse-AI

# Install root dependencies (concurrently)
npm install

# Install frontend
cd frontend && npm install && cd ..

# Install backend
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 2. Configure Environment

**Backend** — create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/hcpulse_db
GROQ_API_KEY=gsk_your_key_here
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000"]
```

**Frontend** — create `frontend/.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 3. Run Both Servers

```bash
npm run dev
```

This starts both servers concurrently:

- **Frontend** → http://localhost:3000
- **Backend API** → http://localhost:8000
- **API Docs** → http://localhost:8000/docs

---

## LangGraph Agent Architecture

The AI agent uses a **StateGraph** with intent detection and conditional routing to 5 specialized tools:

```
                        ┌──────────────┐
                        │  User Input  │
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │   Intent     │
                        │  Detection   │  (LLM classifies intent)
                        └──────┬───────┘
                               │
          ┌────────────┬───────┼───────┬────────────┐
          │            │       │       │            │
   ┌──────▼──┐  ┌──────▼──┐  ┌▼──────┐  ┌──────▼──┐  ┌──────▼──────┐
   │   Log   │  │  Edit   │  │Context│  │ Suggest │  │  Summarize  │
   │Interact.│  │Interact.│  │  HCP  │  │Next Act.│  │ Interaction │
   └────┬────┘  └────┬────┘  └───┬───┘  └────┬────┘  └──────┬──────┘
        │            │           │            │              │
        └────────────┴───────────┴────────────┴──────────────┘
                               │
                        ┌──────▼───────┐
                        │   Response   │
                        │   to User    │
                        └──────────────┘
```

### Tools

| Tool                      | Purpose                                        | Key Capability                                                       |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| **Log Interaction**       | Capture new interactions from natural language | LLM extracts HCP name, products, sentiment, follow-ups → saves to DB |
| **Edit Interaction**      | Modify existing records                        | LLM interprets edit instructions → applies changes                   |
| **Get HCP Context**       | Retrieve full HCP profile                      | Returns profile + last 20 interactions + overall sentiment           |
| **Suggest Next Action**   | AI follow-up recommendations                   | Generates 3–5 prioritized action items based on history              |
| **Summarize Interaction** | Compress long notes                            | Produces key points, action items, sentiment analysis                |

---

## API Reference

### HCP Endpoints

| Method   | Endpoint        | Description                       |
| -------- | --------------- | --------------------------------- |
| `GET`    | `/api/hcp/`     | List HCPs (paginated, searchable) |
| `POST`   | `/api/hcp/`     | Create new HCP                    |
| `GET`    | `/api/hcp/{id}` | Get HCP by ID                     |
| `PUT`    | `/api/hcp/{id}` | Update HCP                        |
| `DELETE` | `/api/hcp/{id}` | Delete HCP                        |

### Interaction Endpoints

| Method   | Endpoint                  | Description           |
| -------- | ------------------------- | --------------------- |
| `GET`    | `/api/interaction/`       | List interactions     |
| `POST`   | `/api/interaction/`       | Create interaction    |
| `GET`    | `/api/interaction/{id}`   | Get interaction by ID |
| `PUT`    | `/api/interaction/{id}`   | Update interaction    |
| `DELETE` | `/api/interaction/{id}`   | Delete interaction    |
| `GET`    | `/api/interaction/recent` | Recent interactions   |

### AI Chat Endpoint

| Method | Endpoint       | Description              |
| ------ | -------------- | ------------------------ |
| `POST` | `/api/ai/chat` | Send message to AI agent |

**Example Request:**

```json
{
  "message": "I just met Dr. Johnson today and discussed CardioMax for hypertension. She was very interested. Follow up with clinical data next week.",
  "user_id": "uuid-string",
  "history": []
}
```

**Example Response:**

```json
{
  "message": "I've logged your interaction with Dr. Johnson successfully! ...",
  "tool_used": "log_interaction",
  "data": {
    "success": true,
    "interaction_id": "uuid",
    "extracted_data": {
      "hcp_name": "Dr. Johnson",
      "products_discussed": ["CardioMax"],
      "sentiment": "positive",
      "follow_up_actions": ["Send clinical data"]
    }
  }
}
```

---

## Database Schema

```
┌──────────────┐       ┌────────────────┐       ┌──────────────┐
│    users     │       │  interactions  │       │     hcps     │
├──────────────┤       ├────────────────┤       ├──────────────┤
│ id (UUID PK) │◀──┐   │ id (UUID PK)   │   ┌──▶│ id (UUID PK) │
│ email        │   ├───│ user_id (FK)   │   │   │ first_name   │
│ name         │   │   │ hcp_id (FK) ───│───┘   │ last_name    │
│ role         │   │   │ type           │       │ specialty    │
│ created_at   │   │   │ date           │       │ organization │
└──────────────┘   │   │ notes          │       │ email/phone  │
                   │   │ summary        │       │ npi_number   │
┌──────────────┐   │   │ products (JSON)│       └──────────────┘
│ activity_logs│   │   │ sentiment      │
├──────────────┤   │   │ follow_ups     │
│ id (UUID PK) │   │   │ created_at     │
│ user_id (FK)─│───┘   └────────────────┘
│ action       │
│ entity_type  │
│ details(JSON)│
└──────────────┘
```

---

## Scripts

| Command                    | Description                                |
| -------------------------- | ------------------------------------------ |
| `npm run dev`              | Start both backend + frontend concurrently |
| `npm run dev:frontend`     | Start Next.js dev server only              |
| `npm run dev:backend`      | Start FastAPI dev server only              |
| `npm run install:frontend` | Install frontend dependencies              |
| `npm run install:backend`  | Install backend Python dependencies        |

---

## License

This project is licensed under the [MIT License](LICENSE).

# HCPulse AI — Backend

FastAPI backend with LangGraph AI agent for the HCPulse AI CRM system.

---

## Tech Stack

- **Framework:** FastAPI 0.115 + Uvicorn
- **ORM:** SQLAlchemy 2.0 (async) + asyncpg
- **Database:** PostgreSQL
- **AI Agent:** LangGraph (StateGraph with conditional routing)
- **LLM:** Groq API — `gemma2-9b-it` (primary), `llama-3.3-70b-versatile` (fallback)
- **Validation:** Pydantic v2
- **Config:** pydantic-settings (`.env` file)

---

## Architecture

```
backend/
├── main.py                          # FastAPI app, CORS, lifespan, seed endpoint
├── config.py                        # Pydantic Settings (env vars)
├── database.py                      # Async SQLAlchemy engine + session
│
├── models/
│   ├── database_models.py           # User, HCP, Interaction, ActivityLog
│   └── schemas.py                   # Pydantic request/response schemas
│
├── repositories/                    # Data access layer
│   ├── hcp_repository.py            # CRUD + search + pagination
│   └── interaction_repository.py    # CRUD + filter by user/hcp
│
├── services/                        # Business logic
│   ├── hcp_service.py
│   ├── interaction_service.py       # + activity logging
│   └── ai_service.py                # Calls LangGraph agent
│
├── routers/                         # API route handlers
│   ├── hcp.py                       # /api/hcp/*
│   ├── interaction.py               # /api/interaction/*
│   └── ai.py                        # /api/ai/chat
│
├── agent/                           # LangGraph AI agent
│   ├── graph.py                     # StateGraph definition
│   ├── state.py                     # AgentState TypedDict
│   └── tools/
│       ├── log_interaction.py       # Extract structured data from NL
│       ├── edit_interaction.py      # Modify interactions via instructions
│       ├── get_hcp_context.py       # Retrieve HCP profile + history
│       ├── suggest_next_action.py   # AI follow-up recommendations
│       └── summarize_interaction.py # Compress notes to summary
│
└── requirements.txt
```

---

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit with your database URL and Groq API key

# Start server (auto-creates tables on startup)
uvicorn main:app --reload --port 8000

# Seed sample data
curl http://localhost:8000/api/seed
```

---

## Environment Variables

| Variable       | Description                   | Default                                                    |
| -------------- | ----------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string  | `postgresql://postgres:password@localhost:5432/hcpulse_db` |
| `GROQ_API_KEY` | Groq API key for LLM access   | (required)                                                 |
| `JWT_SECRET`   | Secret for JWT token signing  | `change-me-in-production`                                  |
| `FRONTEND_URL` | Frontend origin for CORS      | `http://localhost:3000`                                    |
| `CORS_ORIGINS` | JSON array of allowed origins | `["http://localhost:3000"]`                                |

> **Note:** The `DATABASE_URL` is automatically converted from `postgresql://` to `postgresql+asyncpg://` at runtime. Both formats work.

---

## API Endpoints

### Health Check

```
GET /api/health → { "status": "healthy" }
```

### HCP CRUD — `/api/hcp/`

| Method   | Endpoint        | Description                                   |
| -------- | --------------- | --------------------------------------------- |
| `GET`    | `/api/hcp/`     | List HCPs (supports `?search=` and `?limit=`) |
| `POST`   | `/api/hcp/`     | Create HCP                                    |
| `GET`    | `/api/hcp/{id}` | Get HCP by ID                                 |
| `PUT`    | `/api/hcp/{id}` | Update HCP                                    |
| `DELETE` | `/api/hcp/{id}` | Delete HCP                                    |

### Interaction CRUD — `/api/interaction/`

| Method   | Endpoint                  | Description         |
| -------- | ------------------------- | ------------------- |
| `GET`    | `/api/interaction/`       | List interactions   |
| `POST`   | `/api/interaction/`       | Create interaction  |
| `GET`    | `/api/interaction/{id}`   | Get by ID           |
| `PUT`    | `/api/interaction/{id}`   | Update              |
| `DELETE` | `/api/interaction/{id}`   | Delete              |
| `GET`    | `/api/interaction/recent` | Recent interactions |

### AI Chat — `/api/ai/chat`

```
POST /api/ai/chat
Body: { "message": "...", "user_id": "uuid", "history": [...] }
Response: { "message": "...", "tool_used": "log_interaction", "data": {...} }
```

### Seed Data

```
GET /api/seed → Seeds 3 users, 10 HCPs, 8 interactions
```

---

## LangGraph Agent

The agent uses a `StateGraph` with the following flow:

1. **Intent Detection** — LLM classifies user message into one of 6 intents
2. **Conditional Routing** — Routes to the appropriate tool node
3. **Tool Execution** — Runs the selected tool with database access
4. **Response Generation** — Returns structured data + human-readable message

### Tools

| Tool                         | Intent             | What It Does                                                                                                                                     |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `log_interaction_tool`       | `log_interaction`  | Calls Groq to extract HCP name, products, sentiment, follow-ups from natural language → resolves HCP by name → creates Interaction + ActivityLog |
| `edit_interaction_tool`      | `edit_interaction` | Parses edit instructions via LLM → fetches interaction → applies changes                                                                         |
| `get_hcp_context_tool`       | `get_context`      | Retrieves HCP profile + last 20 interactions + calculates overall sentiment                                                                      |
| `suggest_next_action_tool`   | `suggest_action`   | Builds history context → LLM generates 3–5 prioritized action items                                                                              |
| `summarize_interaction_tool` | `summarize`        | LLM produces key_points, action_items, products, sentiment from long notes                                                                       |

### State Schema

```python
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    intent: Optional[str]
    tool_output: Optional[dict]
    final_response: Optional[str]
```

---

## Database Models

### User

- `id` (UUID PK), `email`, `name`, `image`, `role` (admin/rep/manager), `created_at`, `updated_at`

### HCP

- `id` (UUID PK), `first_name`, `last_name`, `specialty`, `organization`, `email`, `phone`, `address`, `city`, `state`, `npi_number`, timestamps

### Interaction

- `id` (UUID PK), `user_id` (FK→users), `hcp_id` (FK→hcps), `interaction_type` (in_person/phone/email/video), `date`, `notes`, `summary`, `products_discussed` (JSON), `key_topics` (JSON), `sentiment` (positive/neutral/negative), `follow_up_actions` (JSON), `follow_up_date`, timestamps

### ActivityLog

- `id` (UUID PK), `user_id` (FK→users), `action`, `entity_type`, `entity_id`, `details` (JSON), `created_at`

---

## Seed Data

The `/api/seed` endpoint creates:

- **3 Users:** Admin (Uzair Ahmed), Rep (John Smith), Manager (Lisa Park)
- **10 HCPs:** Across Cardiology, Oncology, Neurology, Endocrinology, Rheumatology, Pulmonology, Dermatology, Gastroenterology, Pediatrics, Orthopedics
- **8 Interactions:** Realistic pharma rep logs with products (CardioMax, OncoShield, NeuroCalm, GlucoSteady, FlexiJoint, BreatheEasy, DermaClear, GutBalance), sentiments, and follow-up actions

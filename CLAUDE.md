# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bussola V2** is a Personal Operating System (POS) — a self-hosted monorepo that consolidates finance, health, productivity, calendar, and a password vault into one platform, with an AI brain layer for cross-module insights.

---

## Commands

### Docker (Primary Deployment)
```bash
docker compose up -d --build   # Build and start all services
docker compose logs -f         # Follow logs
docker compose down            # Stop (data persists)
docker compose down -v --rmi all  # Full reset (destroys volumes)
```

### Backend (bussola_api/)
```bash
# Setup
cd bussola_api
python -m venv venvbussola2
source venvbussola2/bin/activate   # Windows: venvbussola2\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# Dev server (hot-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
alembic downgrade -1

# Utility scripts
python scripts/populate_db.py     # Seed demo data
python scripts/create_user.py --email admin@example.com --password secret
```

### Frontend (bussola_web/)
```bash
npm install
npm run dev      # Dev server on http://localhost:5173
npm run build    # Production build
npm run lint     # ESLint check
npm run preview  # Preview production build
```

### API Documentation (when backend is running)
- Scalar: http://localhost:8000/scalar
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Architecture

### Service Layout
- **bussola_api/** — Python 3.12 / FastAPI backend (port 8000)
- **bussola_web/** — React 19 / Vite frontend; Nginx serves the build and proxies `/api/v1` → backend (port 3000 externally)
- **Docker network** `bussola_net` connects containers; SQLite persisted via volume mount at `bussola_api/data/`

### Backend Layer Pattern
```
endpoints/ (HTTP, validation) → services/ (business logic) → models/ (ORM)
```
All routes are prefixed `/api/v1` and registered centrally in `app/api/v1/router.py`.

### Modules & Route Prefixes
| Module | Prefix | Description |
|--------|--------|-------------|
| Financas | `/financas` | Expense/income tracking, categories, recurring transactions |
| Ritmo | `/ritmo` | Health: biometrics, workout plans, diet, meals |
| Registros | `/registros` | Notes (rich text), tasks/subtasks, links |
| Agenda | `/agenda` | Calendar events |
| Cofre | `/cofre` | Fernet-encrypted password vault |
| Panorama | `/panorama` | Dashboard aggregating all modules |
| Auth | `/auth` | JWT + Google OAuth2 |
| AI | `/ai` | AI orchestration endpoint |
| System | `/system` | Health checks |

### AI Brain Layer (`app/services/ai/`)
- **`llm_factory.py`** — Pluggable provider abstraction (Groq/Gemini/OpenAI), controlled by `LLM_PROVIDER` env var
- **`base_schema.py`** — Universal `AtomicSuggestion` contract all agents return
- **`post_processor.py`** — Sanitizes LLM output, fuzzy-matches actions to known enum values
- Specialized LangGraph orchestrators per domain (Finance: CFO, Budget Sentinel; Health: Macro Auditor, Volume Architect; Productivity: Time Strategist; Calendar: Conflict Guardian, etc.)

### Frontend Architecture
- **No Redux** — React Context API only: `AuthContext`, `SystemContext`, `ToastContext`, `ConfirmDialogContext`
- Pages map 1:1 to backend modules under `src/pages/`
- HTTP calls abstracted in `src/services/` (Axios wrappers)
- Entry: `main.jsx` (GoogleOAuthProvider) → `App.jsx` (Context providers) → `routes/index.jsx`

### Authentication
- Local: JWT access tokens (15 min) + refresh tokens (7 days)
- Social: Google OAuth2 verified server-side
- Two deployment modes: `SELF_HOSTED` (first user = admin, no email verification) and `SAAS` (strict rate limiting, email verification required)
- Password vault entries encrypted with Fernet (`ENCRYPTION_KEY`)

---

## Key Configuration

### Backend `.env` (required keys)
```
SECRET_KEY=          # openssl rand -hex 32
ENCRYPTION_KEY=      # Fernet key for vault
DATABASE_URL=sqlite:///./data/bussola.db
LLM_PROVIDER=groq    # groq | gemini | openai
GROQ_API_KEY=
OPENWEATHER_API_KEY=
NEWS_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FRONTEND_URL=http://localhost:5173
DEPLOYMENT_MODE=SELF_HOSTED
```

### Frontend `.env`
```
VITE_GOOGLE_CLIENT_ID=
```

---

## Docs

Detailed module documentation lives in `docs/`:
- `docs/AI.md` — agent design and orchestration patterns
- `docs/SECURITY.md` — auth architecture, JWT flow, RBAC
- `docs/FINANCE.md`, `docs/RITMO.md`, `docs/REGISTROS.md`, `docs/AGENDA.md`, `docs/COFRE.md`, `docs/PANORAMA.md` — module-specific logic

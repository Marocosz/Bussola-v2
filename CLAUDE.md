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
# Setup — the venv dir is `venvbussola` (NOT venvbussola2)
(Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned) ; (& c:\Users\marco\OneDrive\Documentos\Pessoal\Projetos\Bussola-v2\bussola_api\venvbussola\Scripts\Activate.ps1)
cd bussola_api
python -m venv venvbussola
source venvbussola/bin/activate   # Windows: venvbussola\Scripts\activate
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

**Tests** (`bussola_api/`, pytest — deps in `requirements-dev.txt`, config in `pytest.ini`):
```bash
# Windows (invoke through the venv explicitly):
venvbussola/Scripts/python.exe -m pytest -q                 # whole suite
venvbussola/Scripts/python.exe -m pytest tests/test_metas_service.py -q   # one file
venvbussola/Scripts/python.exe -m pytest tests/test_metas_api.py::test_criar_e_listar_via_api -v  # one test
```
`tests/conftest.py` provides an in-memory SQLite `db` fixture, a persisted `user`, and a `client` (FastAPI `TestClient`) that overrides `deps.get_db` + `deps.get_current_user`. Only the `metas`/`financas` layers currently have tests; other modules have none.

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
| Metas | `/financas/metas` | Savings goals ("cofrinhos"): deposits/withdrawals as neutral transfers, scheduled monthly aportes, projection, locked goals |
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

## Conventions & Gotchas (non-obvious)

- **`app/main.py` calls `Base.metadata.create_all()` at import time.** Two consequences: (1) a brand-new model's table is auto-created on app/container boot, so a new table works in prod even without running its migration; (2) `alembic revision --autogenerate` can emit an **empty** migration because importing the app (tests do this via `conftest.py`) already created the table — in that case hand-write the migration's `upgrade()`/`downgrade()` and reconcile an already-populated DB with `alembic stamp head` instead of `upgrade head`.
- **Backend services are singletons** created at module end (`financas_service = FinancasService()`, `metas_service = MetasService()`). Methods take `(db, ..., user_id)` and every query filters by `user_id` for tenant isolation. Follow this shape for new domains.
- **Frontend services are TypeScript (`src/services/api.ts`) even though pages are `.jsx`.** New API wrappers go in `api.ts`: `const response = await api.get(...); return response.data;` — loose typing (`data: any`) is the norm here.
- **Judge frontend changes by build, not lint.** `npm run build` = `vite build` (esbuild strips types, no `tsc` typecheck). `npm run lint` scans only `.js/.jsx` (so `.ts` services aren't linted) and the repo already has ~40 pre-existing errors — the real gate is "build passes + no NEW errors on files you touched".
- **ESLint is strict (eslint-plugin-react-hooks v7) — these are ERRORS:** `react-hooks/set-state-in-effect` (don't `setState` synchronously inside `useEffect`; reset form state via a render-time adjustment guarded by a "prev key" instead), `react-hooks/immutability` (no mutating accumulators inside `map`/`reduce` — hoist to a pure helper), `no-unused-vars` (use bare `catch {` when the error variable is unused).
- **Modals** use the shared `<BaseModal onClose={} className="modal">` (`src/components/BaseModal.jsx`) wrapping `.modal-content` → `.modal-header`/`.modal-body`/`.modal-footer`; fields use `.form-row`/`.form-group`/`.form-input`; icon buttons use `.btn-action-icon .btn-edit`/`.btn-delete`. Mirror `pages/Financas/components/FinancasModals.jsx`.
- **Chart.js has no global registration** — each charting page calls `ChartJS.register(...)` for the elements it needs (idempotent across modules).

## Production (Coolify)

- Deployed on the **Coolify "marocos"** instance at **https://bussola.marocos.dev** (Traefik v3.6 + Let's Encrypt). Build-pack: docker-compose, 3 services — `bussola_backend` (:8000), `frontend` (nginx serving the SPA and proxying `/api/v1` → backend), `bussola_bot` (Discord). The compose uses the external **`coolify`** network. **Auto-deploys on push to `main`** (GitHub webhook). SQLite persists on the mounted volume at `bussola_api/data/`.
- Before changing compose / Dockerfile / healthcheck / network / service name / domain, read `~/.claude/COOLIFY-DEPLOY-CHECKLIST.md`.

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
- Metas has no `docs/METAS.md` yet; its design spec and implementation plan live in `docs/superpowers/specs/2026-07-19-metas-cofrinhos-design.md` and `docs/superpowers/plans/2026-07-19-metas-cofrinhos.md`

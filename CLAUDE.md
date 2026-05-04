# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

家族で共有できる家計簿アプリ (Family household account book app). The entire app lives under `household account book app/` (note the space in the directory name).

## Commands

### Full stack (Docker)

```bash
cd "household account book app"
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

### Backend only

```bash
cd "household account book app/backend"
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend only

```bash
cd "household account book app/frontend"
npm install
npm run dev       # dev server on :3000
npm run build     # tsc + vite build
```

## Architecture

### Backend (`backend/`)

FastAPI app using SQLAlchemy with SQLite. Three core models: `Member`, `Category`, `Transaction`. The DB file is stored at `data/kakeibo.db` (mounted as a Docker volume so it persists across container restarts). `seed.py` runs on every startup via `main.py` to populate default categories if absent.

Routers are split by domain under `routers/`:
- `members` — CRUD for family members (with color)
- `categories` — CRUD for income/expense categories
- `transactions` — CRUD with filters (year, month, type, member, category)
- `reports` — aggregate queries: `GET /reports/monthly/{year}/{month}` and `GET /reports/trend`

Pydantic schemas in `schemas.py` mirror the models with separate `*Create`, `*Update`, and `*Response` variants.

### Frontend (`frontend/src/`)

React 18 + TypeScript + Vite SPA. Routing via `react-router-dom` (four pages). Charts use `recharts`. Forms use `react-hook-form`. Date utilities use `date-fns`.

API calls are centralised in `api/index.ts` using an axios instance (`api/client.ts`) with base URL `/api`. In Docker, Vite proxies `/api` → `http://backend:8000`; the rewrite strips the `/api` prefix before forwarding.

Pages:
- `Dashboard` — current month summary
- `Transactions` — list + create/edit/delete
- `Reports` — pie chart by category + monthly trend bar chart
- `Members` — member management

TypeScript types in `types/index.ts` correspond directly to backend Pydantic response schemas.

## Key Configuration

- `DATABASE_URL` env var controls the SQLite path (default `sqlite:///./data/kakeibo.db`)
- `VITE_API_URL` env var is set in docker-compose but the frontend actually uses the Vite dev proxy (`/api`), not this env var directly
- CORS is fully open (`allow_origins=["*"]`) to support access from phones on the same Wi-Fi

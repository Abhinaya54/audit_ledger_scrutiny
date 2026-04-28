# Ledger Scrutiny

Ledger Scrutiny is a full-stack audit application for General Ledger review.
It provides:

- GL upload and ingestion
- Dynamic column detection for messy real-world headers
- Rule-based and ML-assisted anomaly detection
- Workbook-based review workflow
- Investigation and documentation workspace
- Report export support

## Project Layout

Repository root:

- `audit/` : application source

Application source:

- `audit/backend/` : FastAPI backend
- `audit/frontend/` : React + Vite frontend

Backend key folders:

- `audit/backend/main.py` : FastAPI app entrypoint
- `audit/backend/routers/` : API routes (`/api/auth`, `/api/scrutiny`, `/api/workbooks`)
- `audit/backend/services/` : business/service layer
- `audit/backend/scrutiny/` : ingestion, rule engine, ML, export
- `audit/backend/tests/` : pytest tests

Frontend key folders:

- `audit/frontend/src/pages/` : page-level UI
- `audit/frontend/src/components/` : reusable UI components
- `audit/frontend/src/api/` : backend API clients
- `audit/frontend/src/types/` : TypeScript models

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

## Setup

From repository root (`audit`):

1. Create/activate virtual environment (optional but recommended)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install backend dependencies

```powershell
pip install -r audit/backend/requirements.txt
```

3. Install frontend dependencies

```powershell
cd audit/frontend
npm install
```

## Environment Variables (Backend)

Set these before running backend if you use auth/workbook persistence:

- `MONGO_URI` : MongoDB connection string
- `MONGO_DB_NAME` : MongoDB database name (default used in code if not set)
- `JWT_SECRET_KEY` : JWT signing key
- `ALLOWED_ORIGINS` : optional comma-separated CORS origins (defaults to `*`)

## How to Run

### Run Backend API

```powershell
cd audit/backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

API base URL:

- `http://127.0.0.1:8000`

### Run Frontend

Open a second terminal:

```powershell
cd audit/frontend
npm run dev
```

Frontend dev URL:

- `http://127.0.0.1:5173`

## Build and Test

### Frontend build

```powershell
cd audit/frontend
npm run build
```

### Backend tests

```powershell
cd audit/backend
python -m pytest -q
```

## Upload File Requirements

Core required logical fields:

- `date`
- `ledger_name`
- `amount` source

Amount source rules:

- Use direct `amount` if detected
- If `amount` is missing, derive as: `amount = credit - debit`
- At least one amount source must exist (`amount` OR debit/credit)

Optional fields:

- `narration`
- `voucher_type`

The ingestion system supports normalized matching, synonyms, partial matching,
and fuzzy fallback for inconsistent headers.

## Notes

- Frontend documentation editor uses Quill.
- PDF export is handled in frontend using `jspdf`.
- If you change frontend dependencies and hit Vite optimize cache errors,
  clear `audit/frontend/node_modules/.vite` and restart `npm run dev`.
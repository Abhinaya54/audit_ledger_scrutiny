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

## File-by-File One-Line Explanation

### Root

- `README.md` : project documentation, setup guide, run instructions, and file map.
- `package.json` : root npm script for frontend build in deployment workflows.
- `requirements.txt` : root Python dependency placeholder (legacy/deployment compatibility).

### Backend (`audit/backend`)

- `main.py` : starts FastAPI app, loads env vars, configures CORS, and mounts routers.
- `pipeline.py` : orchestration utility for analysis pipeline tasks.
- `requirements.txt` : backend Python package dependencies.

#### Backend Agents (`audit/backend/agents`)

- `__init__.py` : package marker for agent modules.
- `base_agent.py` : shared base behavior/interface for all backend agents.
- `detector_agent.py` : anomaly/rule detection execution agent.
- `orchestrator.py` : coordinates detector, validator, and reporter agent flow.
- `reporter_agent.py` : prepares consolidated audit findings/report payloads.
- `validator_agent.py` : validates detected results and schema/business consistency.

#### Backend Routers (`audit/backend/routers`)

- `__init__.py` : package marker for API routers.
- `auth.py` : authentication endpoints (login/register/token flows).
- `scrutiny.py` : file analysis, schema preview, and scrutiny export endpoints.
- `workbooks.py` : workbook lifecycle APIs (create/select/configure/ingest).

#### Backend Rules Engine (`audit/backend/rules_engine`)

- `__init__.py` : package marker for rule modules.
- `r1_round_amount.py` : flags suspicious round-number transactions.
- `r2_weekend.py` : flags weekend-posted transactions.
- `r3_period_end.py` : flags period-end concentration activity.
- `r4_weak_narration.py` : flags weak/empty narration quality.
- `r5_duplicate.py` : flags potential duplicate entries.
- `r6_voucher_type.py` : flags risky voucher type usage patterns.

#### Backend Schemas (`audit/backend/schemas`)

- `__init__.py` : package marker for Pydantic schemas.
- `auth.py` : auth request/response schema definitions.
- `scrutiny.py` : scrutiny analysis and preview response schemas.
- `workbook.py` : workbook and entity-config payload schemas.

#### Backend Scrutiny Core (`audit/backend/scrutiny`)

- `__init__.py` : package marker for scrutiny modules.
- `engine.py` : runs full rule execution pipeline over ingested data.
- `exporter.py` : creates formatted scrutiny Excel output.
- `ingestor.py` : robust schema mapping, normalization, validation, and DataFrame preparation.

##### Backend Scrutiny ML (`audit/backend/scrutiny/ml`)

- `__init__.py` : package marker for ML modules.
- `feature_engineering.py` : transforms GL rows into model-ready feature vectors.
- `model.py` : trains/runs Isolation Forest anomaly model.

##### Backend Scrutiny Rules (`audit/backend/scrutiny/rules`)

- `__init__.py` : package marker for scrutiny rule modules.
- `r1_round_amount.py` : rule implementation for round amounts.
- `r2_weekend.py` : rule implementation for weekend entries.
- `r3_period_end.py` : rule implementation for period-end spikes.
- `r4_weak_narration.py` : rule implementation for weak narration.
- `r5_duplicate.py` : rule implementation for duplicate checks.
- `r6_voucher_type.py` : rule implementation for voucher type checks.

#### Backend Services (`audit/backend/services`)

- `__init__.py` : package marker for service modules.
- `auth_service.py` : auth business logic and token/user operations.
- `scrutiny_service.py` : analysis pipeline integration used by scrutiny endpoints.
- `workbook_service.py` : workbook persistence and state update operations.

#### Backend Tests (`audit/backend/tests`)

- `__init__.py` : package marker for tests.
- `conftest.py` : shared pytest fixtures and test setup.
- `test_engine.py` : tests for rule execution engine behavior.
- `test_ingestor.py` : tests for schema detection, mapping, and ingestion validation.
- `test_rules.py` : tests for individual rule module outputs.

### Frontend (`audit/frontend`)

- `index.html` : Vite HTML entry shell.
- `package.json` : frontend dependencies and scripts.
- `eslint.config.js` : linting configuration.
- `vite.config.ts` : Vite build/dev server configuration.
- `tsconfig.json` : shared TypeScript configuration root.
- `tsconfig.app.json` : TypeScript settings for browser app code.
- `tsconfig.node.json` : TypeScript settings for Node/Vite config files.

#### Frontend App Entry (`audit/frontend/src`)

- `main.tsx` : React bootstrap and app mount.
- `App.tsx` : top-level app state and routing/page flow control.
- `index.css` : global styles and editor-related overrides.

#### Frontend API Clients (`audit/frontend/src/api`)

- `authApi.ts` : calls backend auth endpoints.
- `client.ts` : shared fetch wrappers for JSON/blob API calls.
- `scrutinyApi.ts` : calls analyze/schema-preview/export scrutiny APIs.
- `workbooksApi.ts` : calls workbook list/detail/create/config/ingest APIs.

#### Frontend Components (`audit/frontend/src/components`)

##### Auth

- `auth/LoginScreen.tsx` : login UI and auth form interactions.

##### Common

- `common/DataTable.tsx` : reusable table rendering component.
- `common/Disclaimer.tsx` : static disclaimer/info banner component.
- `common/FileUpload.tsx` : reusable upload dropzone/input component.
- `common/MetricCard.tsx` : reusable KPI/summary card component.

##### Layout

- `layout/AppShell.tsx` : main application shell and cross-page workflow container.

##### Scrutiny

- `scrutiny/CategoryChart.tsx` : chart for flagged category distribution.
- `scrutiny/LiveFilters.tsx` : filter controls for scrutiny result slicing.
- `scrutiny/ScrutinyTab.tsx` : scrutiny tab wrapper and interactions.
- `scrutiny/SummaryCards.tsx` : summary cards for totals and risk signals.

#### Frontend Pages (`audit/frontend/src/pages`)

- `AuditReportPage.tsx` : final report/insights page and export actions.
- `ClientDashboardPage.tsx` : client-level dashboard overview screen.
- `DashboardPage.tsx` : primary dashboard landing and metrics.
- `DataIngestionWorkspacePage.tsx` : workbook entity setup and ingestion workspace.
- `FlaggedTransactionsPage.tsx` : overview/investigation/documentation review workspace.
- `PostLoginWorkbooksPage.tsx` : workbook list/create/select after authentication.
- `UploadPage.tsx` : upload/start-analysis page.

#### Frontend Types (`audit/frontend/src/types`)

- `auth.ts` : auth-related TypeScript interfaces.
- `scrutiny.ts` : scrutiny response/request type definitions.
- `workbook.ts` : workbook and ingestion-related TypeScript models.

#### Frontend Utils (`audit/frontend/src/utils`)

- `format.ts` : shared number/date/text formatting helper functions.

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
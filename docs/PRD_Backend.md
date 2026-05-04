# Product Requirements Document — Ledger Scrutiny Backend

**Version:** 2.0  
**Date:** May 4, 2026  
**Status:** Draft  
**Author:** Auto-generated from codebase audit

---

## 1. Product Overview

### 1.1 Purpose

The Ledger Scrutiny Backend is a FastAPI-based REST API that ingests General Ledger (GL) data from CSV/Excel files, applies rule-based and ML-based anomaly detection, and provides audit workbook management for chartered accountants and auditors.

### 1.2 Target Users

- **Statutory Auditors** performing substantive analytical procedures on GL data
- **Internal Audit Teams** monitoring for fraud indicators and control weaknesses
- **Audit Managers** overseeing multiple client engagements via workbooks

### 1.3 Business Context

Indian audit firms process thousands of GL entries per client engagement. Manual scrutiny is error-prone and time-consuming. This system automates detection of common audit red flags (round amounts, weak narrations, duplicate entries, weekend postings, period-end clustering, manual journals) and supplements them with unsupervised ML anomaly detection.

---

## 2. System Architecture

### 2.1 Tech Stack

| Component | Technology | Version |
|---|---|---|
| Framework | FastAPI | ≥0.110.0 |
| Runtime | Python + Uvicorn | 3.11+ |
| Database | MongoDB Atlas | via PyMongo 4.10 |
| Auth | JWT (HS256) via python-jose | — |
| ML | scikit-learn IsolationForest | 1.4.2 |
| Data Processing | pandas / numpy | 2.1.4 / 1.26.4 |
| Export | openpyxl | 3.1.2 |

### 2.2 Module Map

```
backend/
├── main.py                     # FastAPI app, CORS, router mounts
├── pipeline.py                 # CLI pipeline (standalone usage)
├── migrate_data.py             # One-off DB seed script
├── routers/
│   ├── auth.py                 # /api/auth/*     (4 endpoints)
│   ├── scrutiny.py             # /api/scrutiny/*  (3 endpoints)
│   ├── workbooks.py            # /api/workbooks/* (5 endpoints)
│   └── clients.py              # /api/clients/*   (5 endpoints)
├── schemas/
│   ├── auth.py                 # Pydantic models: Signup, Login, UserOut
│   ├── client.py               # Pydantic models: ClientRecord, ClientOut
│   └── workbook.py             # Pydantic models: WorkbookCreate, EntityConfig, WorkbookOut
├── services/
│   ├── auth_service.py         # User CRUD, JWT, bcrypt hashing
│   ├── client_service.py       # Client CRUD (MongoDB)
│   ├── scrutiny_service.py     # Analysis orchestration
│   └── workbook_service.py     # Workbook CRUD, analysis persistence, transaction query
├── scrutiny/
│   ├── ingestor.py             # File parsing, schema detection, column mapping
│   ├── engine.py               # Rule orchestrator (R1–R6)
│   ├── exporter.py             # Excel export with formatting
│   └── ml/
│       ├── feature_engineering.py  # 13 numeric features for IsolationForest
│       └── model.py               # Train / predict / save / load pipeline
└── rules_engine/
    ├── r1_round_amount.py      # R1: amount % 1000 == 0
    ├── r2_weekend.py           # R2: Sunday postings (configurable Saturday)
    ├── r3_period_end.py        # R3: Last 5 days of calendar month
    ├── r4_weak_narration.py    # R4: < 10 chars or generic keywords
    ├── r5_duplicate.py         # R5: Same (date, ledger, amount)
    └── r6_voucher_type.py      # R6: Journal / JV voucher types
```

### 2.3 Router Prefix Map

| Router | Prefix | Auth Required | Endpoints |
|---|---|---|---|
| `scrutiny` | `/api/scrutiny` | No | 3 |
| `auth` | `/api/auth` | Partial | 4 |
| `workbooks` | `/api/workbooks` | Yes (Bearer) | 5 |
| `clients` | `/api/clients` | Yes (Bearer) | 5 |

**Total: 17 endpoints**

---

## 3. Functional Requirements

### 3.1 Authentication Module (`/api/auth`)

| ID | Endpoint | Method | Auth | Description |
|---|---|---|---|---|
| AUTH-1 | `/api/auth/signup` | POST | No | Create user account, return JWT |
| AUTH-2 | `/api/auth/login` | POST | No | Authenticate, return JWT |
| AUTH-3 | `/api/auth/login` | GET | No | Informational help text |
| AUTH-4 | `/api/auth/me` | GET | Bearer | Return current user profile |

**Data Model — User:**

| Field | Type | Constraints |
|---|---|---|
| `name` | string | 2–100 chars |
| `email` | string | 5–320 chars, unique, normalised lowercase |
| `password_hash` | string | bcrypt, min 8 chars plaintext |
| `created_at` | datetime | UTC |

**JWT Payload:** `{ sub: email, uid: ObjectId, iat, exp }` — Default expiry: 720 minutes (12 hours).

---

### 3.2 Scrutiny Module (`/api/scrutiny`)

> [!IMPORTANT]
> This is the core analysis engine. It operates statelessly — upload a file, get results. No database persistence.

| ID | Endpoint | Method | Auth | Description |
|---|---|---|---|---|
| SCR-1 | `/api/scrutiny/schema-preview` | POST | No | Upload file → get column mapping preview |
| SCR-2 | `/api/scrutiny/analyze` | POST | No | Upload file → run rules + ML → return flagged rows |
| SCR-3 | `/api/scrutiny/export` | POST | No | Upload file → run analysis → return .xlsx download |

#### SCR-1: Schema Preview

**Input:** `multipart/form-data` with `file` (CSV/XLSX)

**Processing:**
1. Read file headers
2. Normalise column names (lowercase, strip symbols)
3. Match against canonical schema using alias tables + fuzzy matching (Levenshtein)
4. Compute health metrics (date range, debit/credit totals, missing narrations, duplicate journal IDs)

**Output:**
```json
{
  "original_columns": [...],
  "normalised_columns": [...],
  "mappings": [
    { "canonical": "date", "source_column": "date", "status": "mapped", "confidence": 1.0, "strategy": "exact" },
    { "canonical": "amount", "source_column": "total", "status": "mapped", "confidence": 1.0, "strategy": "exact" }
  ],
  "missing_required": [],
  "rows_detected": 21889,
  "columns_detected": 11,
  "sample_rows": [...],
  "health_summary": {
    "total_transactions": 21889,
    "total_debit": 0.0,
    "total_credit": 0.0,
    "date_from": "2024-04-01",
    "date_to": "2025-03-31",
    "missing_narrations": 15,
    "duplicate_journal_ids": 0,
    "manual_entries": 0
  }
}
```

#### SCR-2: Analyze

**Input:** `multipart/form-data`

| Field | Type | Required | Default |
|---|---|---|---|
| `file` | UploadFile | Yes | — |
| `use_ml` | bool | No | `true` |
| `contamination` | float | No | `0.05` |

**Processing Pipeline:**
1. **Ingest** → parse file, map columns, validate schema, parse dates & amounts
2. **Rule Engine** → apply R1–R6 (vectorised pandas operations)
3. **ML Engine** (if `use_ml=true`) → extract 13 features, fit IsolationForest, predict
4. **Merge** → combine rule + ML flags into unified scrutiny columns
5. **Build response** → summary stats, category counts, flagged rows, review rows

**Output:**
```json
{
  "summary": {
    "total_entries": 21889,
    "rule_flagged": 21889,
    "ml_flagged": 0,
    "total_flagged": 21889,
    "pct_flagged": 100.0
  },
  "category_counts": [
    { "category": "Weak Narration", "count": 21889 },
    { "category": "Period End", "count": 8562 }
  ],
  "flagged_rows": [...],
  "review_rows": [...]
}
```

#### SCR-3: Export

**Input:** Same as SCR-2 plus `approved: bool` (default `false`)

**Behaviour:**
- If `approved=false` → return `400` with message "Audit review is pending."
- If `approved=true` → run analysis, generate two-sheet Excel workbook:
  - **Sheet 1: Suspicious_Transactions** — flagged rows with `Anomaly_Type` and `Reason`
  - **Sheet 2: Summary** — category counts

**Response:** Binary `.xlsx` with `Content-Disposition: attachment`.

---

### 3.3 Scrutiny Rule Engine (R1–R6)

| Rule | ID | Category | Logic | Audit Standard |
|---|---|---|---|---|
| Round Numbers | R1 | Fraud indicator | `amount % 1000 == 0 AND amount ≠ 0` | ACFE Fraud Examiners Manual |
| Weekend Entries | R2 | Unauthorised access | `dayofweek == 6` (Sunday; Saturday configurable) | ISA 240 |
| Period End | R3 | Manipulation risk | Day ≥ (days_in_month − 4), i.e. last 5 days | ISA 560 |
| Weak Narration | R4 | Documentation gap | `len < 10` OR contains generic keywords | ICAI Guidance Note |
| Duplicate Check | R5 | Double payment | Same `(date, ledger_name, amount)` appears >1 time | PCAOB AS 2315 |
| Manual Journal | R6 | Override risk | `voucher_type ∈ {JOURNAL, JV, JOURNAL VOUCHER, MANUAL JV}` | ISA 240 |

**Weak Narration Keywords:** `being`, `adj`, `as discussed`, `adjustment`, `misc`, `trf`, `jv`, `ok`, `entry`, `per discussion`

**Output per row:** `scrutiny_flag` (bool), `scrutiny_category` (comma-separated), `scrutiny_reason` (semicolon-separated)

---

### 3.4 ML Anomaly Detection

**Algorithm:** Isolation Forest (scikit-learn)  
**Parameters:** `n_estimators=200`, `contamination=0.05` (configurable), `random_state=42`

**Feature Vector (13 features):**

| # | Feature | Description |
|---|---|---|
| 1 | `amount` | Raw transaction amount |
| 2 | `log_amount` | `log1p(abs(amount))` — reduces skew |
| 3 | `is_round_1000` | 1 if amount divisible by 1000 |
| 4 | `is_round_10000` | 1 if amount divisible by 10000 |
| 5 | `day_of_week` | 0=Mon … 6=Sun |
| 6 | `day_of_month` | 1–31 |
| 7 | `is_weekend` | 1 if Sat/Sun |
| 8 | `is_period_end` | 1 if day ≥ 26 |
| 9 | `month` | 1–12 |
| 10 | `narration_len` | Character count |
| 11 | `is_manual_journal` | 1 if JV/Journal |
| 12 | `account_freq` | Normalised ledger frequency |
| 13 | `amount_zscore` | Z-score within ledger group |

**Pipeline:** `StandardScaler → IsolationForest`  
**Output:** `ml_anomaly_flag` (-1=anomaly, 1=normal), `ml_anomaly_score` (continuous)

---

### 3.5 Ingestor — Column Mapping

The ingestor uses a 3-tier matching strategy to map uploaded columns to canonical fields:

| Priority | Strategy | Score | Example |
|---|---|---|---|
| 1 | Exact match | 1.0 | `date` → `date` |
| 2 | Prefix/partial | 0.90–0.94 | `vou_type` → `voucher_type` |
| 3 | Fuzzy (Levenshtein) | 0.75+ | `naration` → `narration` |

**Canonical Schema:**

| Canonical Field | Required | Aliases (sample) |
|---|---|---|
| `date` | Yes | `voucher_date`, `vch_date`, `transaction_date`, `posting_date` |
| `ledger_name` | Yes | `particulars`, `account`, `party_name`, `ledger` |
| `amount` | Yes | `amt`, `value`, `total`, `net_amount`, `gross_amount` |
| `narration` | No | `remarks`, `description`, `notes` |
| `voucher_type` | No | `vch_type`, `voucher`, `transaction_type`, `type` |

**Debit/Credit Derivation:** If no `amount` column is found, the ingestor looks for `debit`/`credit` columns and derives `amount = credit - debit`.

**Supported Date Formats:** `DD/MM/YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`, `DD-MM-YYYY`, `YYYY/MM/DD`, `DD Mon YYYY`

**Amount Parsing:** Handles commas (`1,45,000`), currency symbols (`₹`, `Rs`, `INR`), Dr/Cr suffixes, accounting negatives `(1000)`.

---

### 3.6 Workbooks Module (`/api/workbooks`)

> [!NOTE]
> Workbooks provide persistent, user-scoped audit engagements. They store entity configuration, analysis results, and flagged transactions in MongoDB.

| ID | Endpoint | Method | Auth | Description |
|---|---|---|---|---|
| WB-1 | `/api/workbooks` | GET | Bearer | List user's workbooks |
| WB-2 | `/api/workbooks` | POST | Bearer | Create new workbook |
| WB-3 | `/api/workbooks/{id}` | GET | Bearer | Get workbook details |
| WB-4 | `/api/workbooks/{id}/entity-config` | PUT | Bearer | Save entity configuration |
| WB-5 | `/api/workbooks/{id}/ingest` | POST | Bearer | Upload file, run analysis, persist results |

**Data Model — Workbook:**

| Field | Type | Description |
|---|---|---|
| `owner_user_id` | string | FK to user |
| `client_name` | string | 2–200 chars |
| `financial_year` | string | e.g. "FY 2024-25" |
| `functional_currency` | string | e.g. "INR" |
| `engagement_type` | string? | e.g. "Full Audit", "Review" |
| `status` | enum | `Draft` → `In Progress` → `Completed` |
| `risk_score` | int | 0–100, derived from flagged % |
| `entity_config` | object? | Entity name, ledger type, currencies |
| `column_mappings` | dict? | Manual column override map |
| `latest_summary` | object? | Last analysis summary |
| `latest_category_counts` | list? | Last category breakdown |
| `flagged_rows` | list? | All flagged transaction rows |
| `review_rows` | list? | Rows with anomaly annotations |

**Workbook Lifecycle:**
1. **Create** (status=Draft, risk_score=0)
2. **Configure Entity** (status→In Progress)
3. **Ingest & Analyze** (risk_score calculated, results persisted)
4. **Status** → Completed if total_flagged=0, else stays In Progress

---

### 3.7 Clients Module (`/api/clients`)

| ID | Endpoint | Method | Auth | Description |
|---|---|---|---|---|
| CL-1 | `/api/clients` | GET | Bearer | List user's clients |
| CL-2 | `/api/clients` | POST | Bearer | Create client record |
| CL-3 | `/api/clients/{id}` | GET | Bearer | Get client details |
| CL-4 | `/api/clients/{id}` | PUT | Bearer | Update client record |
| CL-5 | `/api/clients/{id}` | DELETE | Bearer | Delete client record |

**Data Model — Client:**

| Field | Type | Constraints |
|---|---|---|
| `client_name` | string | 2–200 chars |
| `industry` | string | 0–100 chars |
| `contact_person` | string | 0–100 chars |
| `email` | string | 0–320 chars |
| `last_audit_date` | string | 0–50 chars |
| `notes` | string | 0–2000 chars |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Current |
|---|---|---|
| Schema preview (21K rows) | < 2s | ~1s |
| Full analysis with ML (21K rows) | < 10s | ~7s |
| Excel export (21K rows) | < 15s | ~12s |
| API cold start | < 3s | ~2s |

### 4.2 Security

- JWT-based auth with bcrypt password hashing
- User-scoped data isolation (workbooks/clients filtered by `owner_user_id`)
- Temp files cleaned in `finally` blocks after processing
- CORS wildcard enabled (suitable for dev; restrict in production)

### 4.3 Data Isolation

All workbook and client queries are filtered by `owner_user_id`. A user cannot access another user's data even with valid ObjectIds.

---

## 5. Environment Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | Yes | — | MongoDB Atlas connection string |
| `MONGO_DB_NAME` | No | `auditdb` | Database name |
| `JWT_SECRET_KEY` | Yes | `change-this-in-production` | HMAC signing key |
| `JWT_EXPIRE_MINUTES` | No | `720` | Token lifetime |
| `ALLOWED_ORIGINS` | No | `*` | CORS origins (comma-separated) |

---

## 6. Error Handling Convention

All errors follow FastAPI's `HTTPException` pattern:

```json
{ "detail": "Human-readable error message" }
```

| Code | Usage |
|---|---|
| `400` | Bad input, schema validation failure, pipeline runtime error |
| `401` | Missing/invalid/expired JWT |
| `404` | Resource not found (workbook, client) |
| `422` | Pydantic validation failure (auto-generated by FastAPI) |
| `500` | Unhandled server error |
| `503` | Database unreachable / MONGO_URI not configured |

---

## 7. Gap Analysis — Current vs Old v1 Spec

Features from the old API documentation that are **not yet implemented**:

| Old Feature | Status | Priority |
|---|---|---|
| `GET /health`, `GET /v2/health` | ❌ Missing | P1 — Easy add |
| Interactive filtering (`POST /filter`) | ⚠️ Partial — `query_transactions_for_user` exists in service but no router | P2 |
| Audit trail Excel export (`POST /audit-trail`) | ⚠️ Partial — export logic exists, no dedicated endpoint | P2 |
| Control weights registry | ❌ Missing | P3 |
| Control weight profiles (CRUD) | ❌ Missing | P3 |
| Control weight validation | ❌ Missing | P3 |
| Entity management (dedicated CRUD) | ⚠️ Replaced by workbook entity-config | P3 |
| Risk tier thresholds (configurable) | ❌ Missing | P3 |
| Risk scoring with weighted controls | ❌ Missing — current system uses simple flagged % | P2 |
| `X-Session-ID` / `X-*` response headers | ❌ Missing | P3 |
| `combine_sheets` multi-sheet support | ❌ Missing — only single-sheet ingestion | P2 |
| `use_plugin_rules` extensibility | ❌ Missing | P3 |

---

## 8. Recommended Next Steps

### P1 — Quick Wins (1–2 days)

1. **Add health endpoint** — `GET /health` returning status, version, timestamp
2. **Add Swagger metadata** — description, tags, contact info for `/docs`
3. **Harden CORS** — replace wildcard with `ALLOWED_ORIGINS` env var in production

### P2 — Core Enhancements (1–2 weeks)

4. **Transaction query endpoint** — expose `query_transactions_for_user` as `POST /api/workbooks/{id}/query`
5. **Multi-sheet ingestion** — support `combine_sheets` for multi-sheet Excel files
6. **Risk scoring v2** — implement weighted control scoring instead of simple flagged percentage
7. **Audit trail export** — dedicated endpoint returning .xlsx with response headers for metadata

### P3 — Advanced Features (2–4 weeks)

8. **Control weights system** — registry, validation, CRUD profiles
9. **Plugin rules** — dynamic rule loading from user-defined scripts
10. **Session tracking** — `X-Session-ID` for audit trail continuity
11. **Configurable thresholds** — per-rule threshold overrides via API

---

## 9. API Quick Reference

### Auth
```bash
# Signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Auditor","email":"a@b.com","password":"12345678"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"12345678"}'

# Get profile
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

### Scrutiny (stateless)
```bash
# Schema preview
curl -X POST http://localhost:8000/api/scrutiny/schema-preview \
  -F "file=@ledger.csv"

# Analyze with ML
curl -X POST http://localhost:8000/api/scrutiny/analyze \
  -F "file=@ledger.csv" -F "use_ml=True" -F "contamination=0.05"

# Export (approved)
curl -X POST http://localhost:8000/api/scrutiny/export \
  -F "file=@ledger.csv" -F "approved=True" --output report.xlsx
```

### Workbooks (authenticated)
```bash
# Create workbook
curl -X POST http://localhost:8000/api/workbooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"ACME Ltd","financial_year":"FY 2024-25","functional_currency":"INR"}'

# Ingest file into workbook
curl -X POST http://localhost:8000/api/workbooks/<id>/ingest \
  -H "Authorization: Bearer <token>" \
  -F "file=@ledger.csv" -F "use_ml=True"
```

### Clients (authenticated)
```bash
# Create client
curl -X POST http://localhost:8000/api/clients \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"ACME Corp","industry":"Manufacturing","contact_person":"","email":"","last_audit_date":"","notes":""}'
```

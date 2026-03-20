# Ledger Scrutiny Assistant

Small audit toolkit: synthetic General Ledger (GL) data generator, rule-based
scrutiny engine (R1–R6), and an Isolation Forest ML detector. Use the CLI
tools or the Streamlit UI to generate data, run detections and export an
Excel scrutiny report.

**Prerequisites**
- Python 3.9+ (tested on 3.10)
- Install dependencies:

```
pip install -r audit/requirements.txt
```

Files of interest:
- `generate.py` — CLI entry for synthetic GL data generation.
- `pipeline.py` — Master pipeline: ingest GL → run rules + ML → export Excel report.
- `ui/app.py` — Streamlit web UI (single-page app) for generation and scrutiny.
- `audit/` — package with generator, scrutiny engine, rules, and models.

Quick usage
-----------

1) Generate synthetic GL (CLI)

```
python audit/generate.py --period Q1 --rows 50000 --seed 42

# Save to custom path:
python audit/generate.py --start 2024-04-01 --end 2025-03-31 --output data/output/my_gl.csv
```

Options
- `--period`: Q1, Q2, Q3, Q4 (resolves to fiscal quarters configured in `generator/config.py`).
- `--start` / `--end`: custom date range (YYYY-MM-DD).
- `--rows`: number of rows to generate (default 50,000).
- `--no-inject`: skip anomaly injection (clean data only).

2) Run the full pipeline (rules + ML)

```
python audit/pipeline.py --input data/output/synthetic_gl.csv --output data/output/scrutiny_report.xlsx

# Skip ML detection:
python audit/pipeline.py --input data/output/synthetic_gl.csv --no-ml
```

The pipeline will validate the input schema, run rule checks (R1–R6), optionally
train/predict an Isolation Forest to flag statistical outliers, and export an Excel
report (`.xlsx`) with flagged transactions.

3) Run the Streamlit UI (recommended for interactive use)

```
pip install streamlit plotly
streamlit run audit/ui/app.py
```

The app has two tabs: **Scrutiny Engine** (upload a GL file, run rules/ML, download report)
and **Generate Test Data** (configure and download synthetic GL CSV).

Data schema
-----------
Required columns for ingestion:
- `date` (YYYY-MM-DD)
- `ledger_name`
- `amount` (numeric)
- `narration`
- `voucher_type`

Outputs
- Generated CSVs and reports are placed under `data/output/` by default.
- Saved ML model: `models/iforest.pkl` (when the pipeline runs ML).

Notes and next steps
- This repository contains some non-source documents (PDF/DOCX) in `audit/`.
  They are ignored by the repo's `.gitignore` and will not be pushed.
-
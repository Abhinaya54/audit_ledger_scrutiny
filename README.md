# Audit Ledger

Minimal project for generating and analyzing synthetic general ledger data.

## Setup

1. Create a virtual environment (recommended):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

## Run

- Open the notebook: `src/notebook.ipynb`

```powershell
jupyter lab
```

- In the notebook, select a cell and press Shift+Enter to run it step-by-step.

- Or run the generator script directly:

```powershell
python src\generator.py
```

## Notes

- Data files are in `src/data` or `data` at the repository root.
- If you run into Excel read/write issues, ensure `openpyxl` is installed.
- The primary sample dataset is `src/data/synthetic_gl_2025.csv`; outputs and exports are written to the `data/` folder.

- See `USAGE.md` for detailed run instructions nd `ABOUT.md` for a short project summary.

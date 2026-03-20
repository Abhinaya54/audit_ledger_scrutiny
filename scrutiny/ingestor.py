# scrutiny/ingestor.py
# File ingestion and validation.
# Reads .csv or .xlsx, validates mandatory columns, normalises types.
# Returns a clean DataFrame ready for the detection engine.

import pandas as pd


MANDATORY_COLUMNS = ["date", "ledger_name", "amount", "narration", "voucher_type"]

DATE_FORMATS = [
    "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y",
    "%d-%m-%Y", "%Y/%m/%d", "%d %b %Y",
]


class SchemaError(Exception):
    """Raised when the uploaded GL file fails schema validation."""
    pass


def ingest(filepath: str) -> pd.DataFrame:
    """
    Load and validate a GL file (.csv or .xlsx).

    Args:
        filepath : path to the uploaded file

    Returns:
        Clean, normalised pd.DataFrame

    Raises:
        SchemaError : with a specific message for every validation failure
    """
    # ── Load file ─────────────────────────────────────────────────────────────
    if filepath.endswith(".xlsx") or filepath.endswith(".xls"):
        df = pd.read_excel(filepath, dtype=str)
    elif filepath.endswith(".csv"):
        df = pd.read_csv(filepath, dtype=str)
    else:
        raise SchemaError("Unsupported file format. Please upload a .csv or .xlsx file.")

    if df.empty:
        raise SchemaError("Uploaded file is empty. Please upload a valid GL file.")

    # ── Normalise column names (lowercase, strip spaces) ─────────────────────
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # ── Check mandatory columns ───────────────────────────────────────────────
    missing = [c for c in MANDATORY_COLUMNS if c not in df.columns]
    if missing:
        raise SchemaError(
            f"Required column(s) missing from the uploaded file: {', '.join(missing)}"
        )

    # ── Parse dates ───────────────────────────────────────────────────────────
    df["date"] = _parse_dates(df["date"])

    # ── Parse amounts ─────────────────────────────────────────────────────────
    df["amount"] = _parse_amounts(df["amount"])

    # ── Handle null narrations ────────────────────────────────────────────────
    df["narration"] = (
        df["narration"]
        .fillna("")
        .replace("Null", "")
        .replace("null", "")
        .replace("NULL", "")
        .str.strip()
    )

    # ── Voucher type: strip + title-case ──────────────────────────────────────
    df["voucher_type"] = df["voucher_type"].fillna("").str.strip()

    return df.reset_index(drop=True)


def _parse_dates(series: pd.Series) -> pd.Series:
    """Try multiple date formats; raise SchemaError if none work."""
    series = series.str.strip()

    # Try pandas auto-detection first (handles most formats)
    parsed = pd.to_datetime(series, errors="coerce", dayfirst=True)

    # For rows that failed, try explicit formats
    failed_mask = parsed.isna()
    if failed_mask.any():
        for fmt in DATE_FORMATS:
            still_failed = parsed.isna()
            if not still_failed.any():
                break
            parsed[still_failed] = pd.to_datetime(
                series[still_failed], format=fmt, errors="coerce"
            )

    # Final check
    still_null = parsed.isna().sum()
    if still_null > 0:
        raise SchemaError(
            f"Column 'date' contains {still_null} unrecognised date value(s). "
            f"Accepted formats: DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY."
        )
    return parsed


def _parse_amounts(series: pd.Series) -> pd.Series:
    """
    Parse amount column. Handles:
    - Plain numbers: '45000', '45000.50'
    - Comma-separated: '1,45,000'
    - Debit/Credit suffix: '45000 Dr', '45000 Cr'
    - Negative for credits: '-45000'
    """
    series = series.str.strip()

    # Remove commas and currency symbols
    series = series.str.replace(",", "", regex=False)
    series = series.str.replace("₹", "", regex=False)
    series = series.str.replace("Rs", "", regex=False)
    series = series.str.replace("INR", "", regex=False)

    # Strip Dr/Cr suffix — keep the number as positive
    series = series.str.replace(r"\s*(Dr|CR|dr|cr|Cr|CR)\s*$", "", regex=True)
    series = series.str.strip()

    numeric = pd.to_numeric(series, errors="coerce")
    bad = numeric.isna().sum()
    if bad > 0:
        raise SchemaError(
            f"Column 'amount' contains {bad} non-numeric value(s). "
            f"Please ensure all amounts are numbers."
        )
    return numeric.abs()   # treat all as positive magnitudes

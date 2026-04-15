# scrutiny/ingestor.py
# File ingestion and validation.
# Reads .csv or .xlsx, validates mandatory columns, normalises types.
# Returns a clean DataFrame ready for the detection engine.

import pandas as pd
import re
from typing import Optional


REQUIRED_COLUMNS = ["date", "ledger_name", "amount"]
OPTIONAL_COLUMNS = ["narration", "voucher_type"]

COLUMN_ALIASES = {
    "date": [
        "date",
        "voucher_date",
        "vch_date",
        "transaction_date",
        "entry_date",
        "posting_date",
    ],
    "ledger_name": [
        "ledger_name",
        "particulars",
        "account",
        "account_name",
        "ledger",
        "ledger_account",
        "name_of_ledger",
    ],
    "narration": [
        "narration",
        "remarks",
        "remark",
        "description",
        "particular_narration",
        "notes",
    ],
    "voucher_type": [
        "voucher_type",
        "vch_type",
        "voucher",
        "voucher_category",
        "transaction_type",
        "type",
    ],
    "amount": [
        "amount",
        "amt",
        "value",
        "transaction_amount",
        "gross_amount",
    ],
}

DEBIT_ALIASES = ["debit", "dr", "dr_amount", "debit_amount", "debit_amt"]
CREDIT_ALIASES = ["credit", "cr", "cr_amount", "credit_amount", "credit_amt"]

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

    # ── Normalise column names (lowercase, strip spaces/symbols) ─────────────
    df.columns = [_normalise_column_name(c) for c in df.columns]

    # ── Map source columns (including Tally exports) to canonical schema ─────
    df = _map_to_canonical_schema(df)

    # ── Check required columns ────────────────────────────────────────────────
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise SchemaError(
            f"Required column(s) missing from the uploaded file: {', '.join(missing)}"
        )

    for col in OPTIONAL_COLUMNS:
        if col not in df.columns:
            df[col] = ""

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


def _normalise_column_name(value: str) -> str:
    normalised = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower())
    normalised = re.sub(r"_+", "_", normalised).strip("_")
    return normalised


def _first_existing_column(columns: set[str], candidates: list[str]) -> Optional[str]:
    for item in candidates:
        if item in columns:
            return item
    return None


def _map_to_canonical_schema(df: pd.DataFrame) -> pd.DataFrame:
    mapped = df.copy()
    available = set(mapped.columns)

    for canonical in ["date", "ledger_name", "narration", "voucher_type"]:
        source = _first_existing_column(available, COLUMN_ALIASES[canonical])
        if source and canonical not in mapped.columns:
            mapped[canonical] = mapped[source]

    amount_source = _first_existing_column(available, COLUMN_ALIASES["amount"])
    if amount_source and "amount" not in mapped.columns:
        mapped["amount"] = mapped[amount_source]

    if "amount" not in mapped.columns:
        debit_source = _first_existing_column(available, DEBIT_ALIASES)
        credit_source = _first_existing_column(available, CREDIT_ALIASES)

        if debit_source or credit_source:
            debit = _parse_optional_amounts(
                mapped[debit_source] if debit_source else pd.Series(["" for _ in range(len(mapped))])
            )
            credit = _parse_optional_amounts(
                mapped[credit_source] if credit_source else pd.Series(["" for _ in range(len(mapped))])
            )

            amount = debit.fillna(0).abs() + credit.fillna(0).abs()
            amount[(debit.isna()) & (credit.isna())] = pd.NA
            mapped["amount"] = amount

    return mapped


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
    numeric = _parse_optional_amounts(series)
    bad = numeric.isna().sum()
    if bad > 0:
        raise SchemaError(
            f"Column 'amount' contains {bad} non-numeric value(s). "
            f"Please ensure all amounts are numbers."
        )
    return numeric.abs()   # treat all as positive magnitudes


def _parse_optional_amounts(series: pd.Series) -> pd.Series:
    cleaned = series.fillna("").astype(str).str.strip()

    # Remove commas and common currency markers.
    cleaned = cleaned.str.replace(",", "", regex=False)
    cleaned = cleaned.str.replace("₹", "", regex=False)
    cleaned = cleaned.str.replace("Rs", "", regex=False)
    cleaned = cleaned.str.replace("INR", "", regex=False)

    # Strip Dr/Cr suffix while preserving absolute value in ingestion.
    cleaned = cleaned.str.replace(r"\s*(Dr|CR|dr|cr|Cr)\s*$", "", regex=True)

    # Handle accounting-style negatives written as (1000).
    cleaned = cleaned.str.replace(r"^\((.*)\)$", r"-\1", regex=True)

    blank = cleaned.eq("")
    numeric = pd.to_numeric(cleaned.mask(blank, pd.NA), errors="coerce")

    invalid = (~blank) & numeric.isna()
    if invalid.any():
        raise SchemaError(
            f"Found {int(invalid.sum())} invalid amount value(s) in amount/debit/credit columns."
        )

    return numeric

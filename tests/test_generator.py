# tests/test_generator.py  —  Mar 23 deliverable
# Unit tests for generator/core.py — generate() function.
# Coverage: row count, column names, date range, amount distribution.

import pytest
import pandas as pd
import numpy as np

from generator.core import generate

EXPECTED_COLUMNS = [
    "voucher_no", "date", "ledger_name", "amount",
    "dr_cr", "narration", "voucher_type", "posted_by",
    "cost_center", "fiscal_year",
]


# ── Row count ─────────────────────────────────────────────────────────────────

def test_generate_default_row_count():
    """Default call produces 50,000 rows."""
    df = generate(seed=42)
    assert len(df) == 50_000


def test_generate_custom_row_count():
    """Passing rows=1000 produces exactly 1,000 rows."""
    df = generate(rows=1_000, seed=1)
    assert len(df) == 1_000


def test_generate_small_row_count():
    """rows=1 edge case — should not raise."""
    df = generate(rows=1, seed=0)
    assert len(df) == 1


# ── Column names ──────────────────────────────────────────────────────────────

def test_generate_column_names():
    """Output DataFrame has all 10 expected columns."""
    df = generate(rows=100, seed=42)
    assert list(df.columns) == EXPECTED_COLUMNS


def test_generate_no_extra_columns():
    """Output DataFrame has exactly 10 columns — no extras."""
    df = generate(rows=100, seed=42)
    assert len(df.columns) == len(EXPECTED_COLUMNS)


# ── Date range ────────────────────────────────────────────────────────────────

def test_generate_dates_within_range():
    """All generated dates fall within the specified start/end range."""
    start = "2024-04-01"
    end   = "2025-03-31"
    df = generate(start_date=start, end_date=end, rows=500, seed=7)

    assert df["date"].min() >= pd.Timestamp(start)
    assert df["date"].max() <= pd.Timestamp(end)


def test_generate_single_day_range():
    """When start == end all dates equal that single day."""
    day = "2024-07-15"
    df = generate(start_date=day, end_date=day, rows=50, seed=3)
    assert (df["date"] == pd.Timestamp(day)).all()


def test_generate_date_dtype():
    """The 'date' column must be datetime64, not object/string."""
    df = generate(rows=50, seed=42)
    assert pd.api.types.is_datetime64_any_dtype(df["date"])


# ── Amount distribution ───────────────────────────────────────────────────────

def test_generate_amounts_positive():
    """All generated amounts are strictly positive."""
    df = generate(rows=1_000, seed=42)
    assert (df["amount"] > 0).all()


def test_generate_amounts_within_config_bounds():
    """Amounts are clipped to [100, 10_000_000] as configured."""
    df = generate(rows=2_000, seed=42)
    assert df["amount"].min() >= 100
    assert df["amount"].max() <= 10_000_000


def test_generate_amount_mean_plausible():
    """
    With log_mean=10.5, log_std=1.5, the arithmetic mean of log-normal
    data should be roughly exp(10.5 + 0.5*1.5²) ≈ 73,000 before clipping.
    After clipping the empirical mean should be between 20,000 and 150,000.
    """
    df = generate(rows=5_000, seed=42)
    mean = df["amount"].mean()
    assert 20_000 < mean < 150_000, f"Unexpected amount mean: {mean:.0f}"


def test_generate_amount_log_right_skew():
    """Log-normal distribution is right-skewed: median < mean."""
    df = generate(rows=5_000, seed=42)
    assert df["amount"].median() < df["amount"].mean()


# ── Reproducibility ───────────────────────────────────────────────────────────

def test_generate_seed_reproducibility():
    """Same seed produces identical DataFrames."""
    df1 = generate(rows=200, seed=99)
    df2 = generate(rows=200, seed=99)
    pd.testing.assert_frame_equal(df1, df2)


def test_generate_different_seeds_differ():
    """Different seeds produce different amounts (with overwhelming probability)."""
    df1 = generate(rows=200, seed=1)
    df2 = generate(rows=200, seed=2)
    assert not (df1["amount"].values == df2["amount"].values).all()


# ── Voucher number format ─────────────────────────────────────────────────────

def test_generate_voucher_no_format():
    """voucher_no values follow the pattern JV-<year>-<5-digit-seq>."""
    df = generate(start_date="2024-04-01", end_date="2025-03-31", rows=10, seed=0)
    pattern = r"^JV-\d{4}-\d{5}$"
    assert df["voucher_no"].str.match(pattern).all()


# ── Categorical columns ───────────────────────────────────────────────────────

def test_generate_dr_cr_values():
    """dr_cr column contains only 'Dr' or 'Cr'."""
    df = generate(rows=500, seed=42)
    assert set(df["dr_cr"].unique()).issubset({"Dr", "Cr"})


def test_generate_voucher_type_distribution():
    """Voucher types are from the configured set."""
    df = generate(rows=1_000, seed=42)
    allowed = {"Journal", "Payment", "Receipt", "Contra"}
    assert set(df["voucher_type"].unique()).issubset(allowed)


def test_generate_cost_center_values():
    """cost_center values are from the configured list."""
    df = generate(rows=500, seed=42)
    allowed = {"Finance", "Operations", "HR", "Sales", "IT", "Admin", "Procurement"}
    assert set(df["cost_center"].unique()).issubset(allowed)

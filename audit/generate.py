#!/usr/bin/env python
# generate.py  — CLI entry point for the synthetic GL generator.
#
# Usage examples:
#   python generate.py                            # full year, 50k rows
#   python generate.py --period Q1               # Q1 only
#   python generate.py --period Q2 --rows 20000  # Q2, 20k rows
#   python generate.py --start 2024-06-01 --end 2024-09-30  # custom range
#   python generate.py --rows 100000 --seed 99   # 100k rows, fixed seed

import argparse
import os
import pandas as pd

from generator.core     import generate
from generator.patterns import inject_all
from generator.config   import CONFIG


QUARTER_MAP = {
    "Q1": ("04-01", "06-30"),
    "Q2": ("07-01", "09-30"),
    "Q3": ("10-01", "12-31"),
    "Q4": ("01-01", "03-31"),
}


def get_date_range(args) -> tuple[str, str]:
    """Resolve start and end date from CLI arguments."""
    if args.start and args.end:
        return args.start, args.end

    if args.period:
        period = args.period.upper()
        if period not in QUARTER_MAP:
            raise ValueError(f"--period must be one of: Q1, Q2, Q3, Q4. Got '{args.period}'")
        start_mm_dd, end_mm_dd = QUARTER_MAP[period]

        # Q4 belongs to the next calendar year in an Apr-Mar fiscal year
        fy_start = pd.Timestamp(CONFIG["fiscal_year_start"])
        if period == "Q4":
            year = fy_start.year + 1
        else:
            year = fy_start.year

        return f"{year}-{start_mm_dd}", f"{year}-{end_mm_dd}"

    # Default: full fiscal year
    return CONFIG["fiscal_year_start"], CONFIG["fiscal_year_end"]


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic General Ledger data for audit testing."
    )
    parser.add_argument("--period", type=str,
                        help="Fiscal quarter: Q1, Q2, Q3, or Q4")
    parser.add_argument("--start",  type=str,
                        help="Custom start date YYYY-MM-DD")
    parser.add_argument("--end",    type=str,
                        help="Custom end date YYYY-MM-DD")
    parser.add_argument("--rows",   type=int, default=None,
                        help="Number of rows to generate (default: 50000)")
    parser.add_argument("--seed",   type=int, default=None,
                        help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--no-inject", action="store_true",
                        help="Skip anomaly injection (generate clean data only)")
    parser.add_argument("--output", type=str, default=None,
                        help="Output CSV path (default: data/output/synthetic_gl.csv)")
    args = parser.parse_args()

    # ── Resolve date range ────────────────────────────────────────────────────
    start, end = get_date_range(args)

    # ── Generate base data ────────────────────────────────────────────────────
    print(f"Generating GL data: {start} -> {end}, rows={args.rows or 50000} ...")
    df = generate(start_date=start, end_date=end, rows=args.rows, seed=args.seed)

    # ── Inject anomaly patterns ───────────────────────────────────────────────
    if not args.no_inject:
        print("Injecting anomaly patterns (R1–R6) ...")
        df = inject_all(df)

    # ── Save ──────────────────────────────────────────────────────────────────
    output_path = args.output or "data/output/synthetic_gl.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Saved {len(df):,} rows -> {output_path}")

    # ── Quick stats ───────────────────────────────────────────────────────────
    print("\n-- Dataset Summary ------------------------------------------")
    print(f"  Total rows      : {len(df):,}")
    print(f"  Date range      : {df['date'].min().date()} -> {df['date'].max().date()}")
    print(f"  Amount range    : Rs.{df['amount'].min():,.0f} -> Rs.{df['amount'].max():,.0f}")
    print(f"  Amount mean     : Rs.{df['amount'].mean():,.0f}")
    print(f"  Voucher types   : {df['voucher_type'].value_counts().to_dict()}")
    print(f"  Round amounts   : {(df['amount'] % 1000 == 0).sum():,}")
    print(f"  Weekend entries : {(df['date'].dt.dayofweek == 6).sum():,}")
    print("-------------------------------------------------------------\n")


if __name__ == "__main__":
    main()

# generator/digital_twin.py
# Digital Twin Generator.
# Given a JSON summary of a real GL's statistics (no actual transaction data),
# produce a synthetic dataset that mirrors those statistics exactly.
# This lets you test against a "clone" of a real company without any privacy risk.

import json
import pandas as pd
import numpy as np
from faker import Faker

from .accounts import ACCOUNTS
from .config import CONFIG

fake = Faker("en_IN")


def create_twin(stats_json: str, rows: int = 50000, seed: int = 42) -> pd.DataFrame:
    """
    Generate a synthetic GL that mirrors a real GL's statistical profile.

    Args:
        stats_json : JSON string with summary statistics from a real GL.
                     See build_stats_from_gl() to generate this JSON.
        rows       : number of rows to generate
        seed       : random seed

    Returns:
        pd.DataFrame — synthetic GL matching the statistical profile

    Example stats_json:
    {
        "amount_mean": 45000,
        "amount_std": 120000,
        "top_accounts": ["Sales Revenue", "Salary Expense", "Rent Expense"],
        "voucher_type_dist": {"Journal": 0.22, "Payment": 0.38, "Receipt": 0.28, "Contra": 0.12},
        "weekday_dist": [0.18, 0.20, 0.19, 0.18, 0.17, 0.05, 0.03],
        "fiscal_year": "FY2024-25",
        "fiscal_year_start": "2024-04-01",
        "fiscal_year_end": "2025-03-31"
    }
    """
    np.random.seed(seed)
    fake.seed_instance(seed)

    stats = json.loads(stats_json) if isinstance(stats_json, str) else stats_json

    # ── Amounts: fit log-normal from mean and std ─────────────────────────────
    mean = stats.get("amount_mean", 36000)
    std  = stats.get("amount_std",  120000)

    # Convert normal mean/std to log-normal parameters
    variance  = std ** 2
    log_mean  = np.log(mean ** 2 / np.sqrt(variance + mean ** 2))
    log_sigma = np.sqrt(np.log(1 + variance / mean ** 2))

    amounts = np.random.lognormal(log_mean, log_sigma, size=rows)
    amounts = np.clip(amounts, CONFIG["amount"]["min"], CONFIG["amount"]["max"])
    amounts = np.round(amounts, 2)

    # ── Dates: respect weekday distribution ───────────────────────────────────
    start = pd.Timestamp(stats.get("fiscal_year_start", CONFIG["fiscal_year_start"]))
    end   = pd.Timestamp(stats.get("fiscal_year_end",   CONFIG["fiscal_year_end"]))

    weekday_probs = stats.get("weekday_dist", [1/7] * 7)
    weekday_probs = np.array(weekday_probs)
    weekday_probs = weekday_probs / weekday_probs.sum()   # normalise to sum=1

    date_range = pd.date_range(start, end, freq="D")
    date_weekday_probs = np.array([weekday_probs[d.dayofweek] for d in date_range])
    date_weekday_probs = date_weekday_probs / date_weekday_probs.sum()

    dates = np.random.choice(date_range, size=rows, p=date_weekday_probs)

    # ── Accounts: use top accounts if provided, else default ──────────────────
    top_accounts = stats.get("top_accounts", ACCOUNTS)

    # ── Voucher types ─────────────────────────────────────────────────────────
    vt_dist  = stats.get("voucher_type_dist", CONFIG["voucher_type_distribution"])
    vt_keys  = list(vt_dist.keys())
    vt_probs = np.array(list(vt_dist.values()))
    vt_probs = vt_probs / vt_probs.sum()

    df = pd.DataFrame(
        {
            "voucher_no":   [f"TWIN-{str(i+1).zfill(5)}" for i in range(rows)],
            "date":          pd.to_datetime(dates),
            "ledger_name":   np.random.choice(top_accounts, size=rows),
            "amount":        amounts,
            "dr_cr":         np.random.choice(["Dr", "Cr"], size=rows),
            "narration":     [fake.sentence(nb_words=8) for _ in range(rows)],
            "voucher_type":  np.random.choice(vt_keys, size=rows, p=vt_probs),
            "posted_by":     [fake.name() for _ in range(rows)],
            "cost_center":   np.random.choice(CONFIG["cost_centres"], size=rows),
            "fiscal_year":   stats.get("fiscal_year", "FY2024-25"),
        }
    )
    return df


def build_stats_from_gl(df: pd.DataFrame) -> dict:
    """
    Extract summary statistics from a REAL GL DataFrame.
    Share this JSON — not the actual data — to create a digital twin.

    Args:
        df : real GL DataFrame (must have: date, ledger_name, amount, voucher_type)

    Returns:
        dict of summary statistics (safe to share — contains no transaction data)
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")

    weekday_counts = df["date"].dt.dayofweek.value_counts(normalize=True).sort_index()
    weekday_dist   = [weekday_counts.get(i, 0.0) for i in range(7)]

    vt_dist = (
        df["voucher_type"].value_counts(normalize=True).to_dict()
        if "voucher_type" in df.columns
        else {}
    )

    stats = {
        "amount_mean":       float(df["amount"].mean()),
        "amount_std":        float(df["amount"].std()),
        "top_accounts":      df["ledger_name"].value_counts().head(30).index.tolist(),
        "voucher_type_dist": vt_dist,
        "weekday_dist":      weekday_dist,
        "fiscal_year_start": str(df["date"].min().date()),
        "fiscal_year_end":   str(df["date"].max().date()),
        "fiscal_year":       "FY-Twin",
        "total_rows":        len(df),
    }
    return stats

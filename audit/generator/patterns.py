# generator/patterns.py
# Anomaly injection functions — one per scrutiny rule (R1–R6).
# Each function takes a DataFrame, modifies a fraction of rows to
# trigger its matching detection rule, and returns the modified DataFrame.

import pandas as pd
import numpy as np

from .config import CONFIG

WEAK_NARRATIONS = [
    "Being adj",
    "As discussed",
    "Adj entry",
    "JV",
    "Being",
    "x",
    "misc",
    "adjustment",
    "adj",
    "Being adjustment",
    "Per discussion",
    "OK",
    "Entry",
    "TRF",
]

ROUND_AMOUNTS = [
    1_000, 2_000, 5_000, 10_000, 15_000, 20_000, 25_000,
    50_000, 75_000, 1_00_000, 2_00_000, 5_00_000, 10_00_000,
]


def inject_round_amounts(df: pd.DataFrame, rate: float = None) -> pd.DataFrame:
    """
    R1 — Round Numbers
    Override ~rate fraction of amounts with round multiples of 1,000.
    """
    rate = rate or CONFIG["injection_rates"]["round_amount"]
    idx = df.sample(frac=rate, random_state=1).index
    df.loc[idx, "amount"] = np.random.choice(ROUND_AMOUNTS, size=len(idx)).astype(float)
    return df


def inject_weekend_postings(df: pd.DataFrame, rate: float = None) -> pd.DataFrame:
    """
    R2 — Weekend Entries
    Re-date ~rate fraction of rows to the nearest upcoming Sunday.
    """
    rate = rate or CONFIG["injection_rates"]["weekend_posting"]
    idx = df.sample(frac=rate, random_state=2).index
    for i in idx:
        date = df.loc[i, "date"]
        days_to_sunday = (6 - date.dayofweek) % 7
        if days_to_sunday == 0:
            days_to_sunday = 7           # already Sunday → push to next Sunday
        df.loc[i, "date"] = date + pd.Timedelta(days=days_to_sunday)
    return df


def inject_period_end_clustering(df: pd.DataFrame, rate: float = None) -> pd.DataFrame:
    """
    R3 — Period End
    Move ~rate fraction of rows into the last 5 days of their current month.
    """
    rate = rate or CONFIG["injection_rates"]["period_end_cluster"]
    idx = df.sample(frac=rate, random_state=3).index
    for i in idx:
        month_end = df.loc[i, "date"] + pd.offsets.MonthEnd(0)
        offset = np.random.randint(0, 5)          # 0–4 days before month end
        df.loc[i, "date"] = month_end - pd.Timedelta(days=offset)
    return df


def inject_weak_narrations(df: pd.DataFrame, rate: float = None) -> pd.DataFrame:
    """
    R4 — Weak Narration
    Replace ~rate fraction of narrations with generic/short text.
    """
    rate = rate or CONFIG["injection_rates"]["weak_narration"]
    idx = df.sample(frac=rate, random_state=4).index
    df.loc[idx, "narration"] = np.random.choice(WEAK_NARRATIONS, size=len(idx))
    return df


def inject_duplicates(df: pd.DataFrame, rate: float = None) -> pd.DataFrame:
    """
    R5 — Duplicate Check
    Duplicate ~rate fraction of rows exactly (same date + ledger + amount).
    Returns the DataFrame with duplicates appended.
    """
    rate = rate or CONFIG["injection_rates"]["duplicate_rows"]
    dupes = df.sample(frac=rate, random_state=5)
    return pd.concat([df, dupes], ignore_index=True)


def inject_manual_journals(df: pd.DataFrame, rate: float = None) -> pd.DataFrame:
    """
    R6 — Manual Journal
    Set ~rate fraction of voucher_type to 'Journal' or 'JV'.
    """
    rate = rate or CONFIG["injection_rates"]["manual_journal"]
    idx = df.sample(frac=rate, random_state=6).index
    df.loc[idx, "voucher_type"] = np.random.choice(["Journal", "JV"], size=len(idx))
    return df


def inject_all(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convenience function: apply all 6 injections in order.
    Call this to get a fully anomaly-seeded dataset in one step.
    """
    df = inject_round_amounts(df)
    df = inject_weekend_postings(df)
    df = inject_period_end_clustering(df)
    df = inject_weak_narrations(df)
    df = inject_manual_journals(df)
    df = inject_duplicates(df)         # last — so duplicates include other injections
    df = df.reset_index(drop=True)
    return df

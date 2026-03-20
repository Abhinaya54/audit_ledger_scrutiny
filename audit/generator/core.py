# generator/core.py
# Core synthetic GL data generator.
# Produces a Pandas DataFrame with 10 columns matching a realistic
# Indian SME General Ledger export (SAP / Tally style).

import pandas as pd
import numpy as np
from faker import Faker

from .accounts import ACCOUNTS
from .config import CONFIG

fake = Faker("en_IN")


def generate(
    start_date: str = None,
    end_date: str = None,
    rows: int = None,
    seed: int = None,
) -> pd.DataFrame:
    """
    Generate synthetic GL journal entries.

    Args:
        start_date : 'YYYY-MM-DD'  (default: fiscal_year_start from config)
        end_date   : 'YYYY-MM-DD'  (default: fiscal_year_end from config)
        rows       : number of rows to generate (default: num_rows from config)
        seed       : random seed for reproducibility (default: from config)

    Returns:
        pd.DataFrame with columns:
        voucher_no, date, ledger_name, amount, dr_cr,
        narration, voucher_type, posted_by, cost_center, fiscal_year
    """
    cfg  = CONFIG
    seed = seed if seed is not None else cfg["random_seed"]
    np.random.seed(seed)
    fake.seed_instance(seed)

    rows  = rows  or cfg["num_rows"]
    start = pd.Timestamp(start_date or cfg["fiscal_year_start"])
    end   = pd.Timestamp(end_date   or cfg["fiscal_year_end"])

    # ── Dates: uniform distribution across the date range ────────────────────
    total_days = (end - start).days + 1
    random_days = np.random.randint(0, total_days, size=rows)
    dates = [start + pd.Timedelta(days=int(d)) for d in random_days]

    # ── Amounts: log-normal distribution ─────────────────────────────────────
    amounts = np.random.lognormal(
        mean=cfg["amount"]["log_mean"],
        sigma=cfg["amount"]["log_std"],
        size=rows,
    )
    amounts = np.clip(amounts, cfg["amount"]["min"], cfg["amount"]["max"])
    amounts = np.round(amounts, 2)

    # ── Voucher types ─────────────────────────────────────────────────────────
    vt_keys  = list(cfg["voucher_type_distribution"].keys())
    vt_probs = list(cfg["voucher_type_distribution"].values())

    df = pd.DataFrame(
        {
            "voucher_no": [
                f"JV-{start.year}-{str(i + 1).zfill(5)}" for i in range(rows)
            ],
            "date":        dates,
            "ledger_name": np.random.choice(ACCOUNTS, size=rows),
            "amount":      amounts,
            "dr_cr":       np.random.choice(["Dr", "Cr"], size=rows),
            "narration":   [fake.sentence(nb_words=8) for _ in range(rows)],
            "voucher_type": np.random.choice(vt_keys, size=rows, p=vt_probs),
            "posted_by":   [fake.name() for _ in range(rows)],
            "cost_center": np.random.choice(cfg["cost_centres"], size=rows),
            "fiscal_year": f"FY{start.year}-{str(start.year + 1)[-2:]}",
        }
    )

    df["date"] = pd.to_datetime(df["date"])
    return df

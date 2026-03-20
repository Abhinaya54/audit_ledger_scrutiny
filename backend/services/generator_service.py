import pandas as pd
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional

from generator.core import generate
from generator import patterns as pat

# In-memory cache for generated datasets
_cache: dict[str, tuple[pd.DataFrame, datetime]] = {}
_MAX_CACHE = 10


def _cleanup():
    cutoff = datetime.now() - timedelta(minutes=10)
    expired = [k for k, (_, t) in _cache.items() if t < cutoff]
    for k in expired:
        del _cache[k]
    # Also enforce max size
    if len(_cache) > _MAX_CACHE:
        oldest = sorted(_cache, key=lambda k: _cache[k][1])
        for k in oldest[: len(_cache) - _MAX_CACHE]:
            del _cache[k]


def generate_data(
    start_date: str,
    end_date: str,
    num_rows: int,
    seed: int,
    inject_r1: bool,
    inject_r2: bool,
    inject_r3: bool,
    inject_r4: bool,
    inject_r5: bool,
    inject_r6: bool,
) -> dict:
    df = generate(start_date=start_date, end_date=end_date, rows=num_rows, seed=seed)

    if inject_r1:
        df = pat.inject_round_amounts(df)
    if inject_r2:
        df = pat.inject_weekend_postings(df)
    if inject_r3:
        df = pat.inject_period_end_clustering(df)
    if inject_r4:
        df = pat.inject_weak_narrations(df)
    if inject_r6:
        df = pat.inject_manual_journals(df)
    if inject_r5:
        df = pat.inject_duplicates(df)
    df = df.reset_index(drop=True)

    stats = {
        "total_rows": len(df),
        "amount_mean": round(float(df["amount"].mean()), 2),
        "round_amounts": int((df["amount"] % 1000 == 0).sum()),
    }

    preview_df = df.head(10).copy()
    preview_df["date"] = preview_df["date"].dt.strftime("%Y-%m-%d")
    preview = preview_df.to_dict(orient="records")

    token = str(uuid4())
    _cleanup()
    _cache[token] = (df, datetime.now())

    return {"stats": stats, "preview": preview, "download_token": token}


def get_cached_csv(token: str) -> Optional[bytes]:
    entry = _cache.get(token)
    if entry is None:
        return None
    df, _ = entry
    export_df = df.copy()
    export_df["date"] = export_df["date"].dt.strftime("%Y-%m-%d")
    return export_df.to_csv(index=False).encode("utf-8")

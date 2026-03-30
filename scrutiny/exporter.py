# scrutiny/exporter.py
# Minimal, crash-proof Excel export for Render free tier (512 MB).
# Uses plain pandas to_excel — no openpyxl styling that could OOM.
# Adds two columns: "Anomaly Type" and "Why Flagged".

import io
import pandas as pd


def export(df: pd.DataFrame, output_path: str = None) -> bytes:
    """Return ALL GL rows as .xlsx with Anomaly Type + Why Flagged columns."""

    out = df.copy().reset_index(drop=True)

    # Add the two audit columns (blank for clean rows)
    out["Anomaly Type"] = ""
    out["Why Flagged"]  = ""

    if "scrutiny_flag" in out.columns:
        mask = out["scrutiny_flag"].astype(bool)
        if "scrutiny_category" in out.columns:
            out.loc[mask, "Anomaly Type"] = out.loc[mask, "scrutiny_category"].fillna("")
        if "scrutiny_reason" in out.columns:
            out.loc[mask, "Why Flagged"] = out.loc[mask, "scrutiny_reason"].fillna("")

    # Drop internal columns
    drop = [
        "scrutiny_flag", "scrutiny_category", "scrutiny_reason",
        "ml_anomaly_flag", "ml_anomaly_score",
    ]
    out = out.drop(columns=[c for c in drop if c in out.columns])

    # Write — plain pandas, no openpyxl styling
    buf = io.BytesIO()
    out.to_excel(buf, index=False, engine="openpyxl")
    buf.seek(0)
    result = buf.read()

    if output_path:
        with open(output_path, "wb") as f:
            f.write(result)

    return result

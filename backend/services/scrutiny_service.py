import os
import tempfile
import pandas as pd
from fastapi import UploadFile

from scrutiny.ingestor import ingest, SchemaError
from scrutiny.engine import run_all_rules
from scrutiny.ml.model import train, predict
from scrutiny.exporter import export


def _read_uploaded_dataframe(path: str) -> pd.DataFrame:
    """Read uploaded file without renaming columns to preserve original structure for export."""
    if path.endswith(".xlsx") or path.endswith(".xls"):
        return pd.read_excel(path)
    return pd.read_csv(path)


def _build_export_dataframe(raw_df: pd.DataFrame, analyzed_df: pd.DataFrame) -> pd.DataFrame:
    """
    Keep uploaded columns exactly as-is and append generated scrutiny columns at the end.
    Row order is preserved from ingestion/analysis.
    """
    export_df = raw_df.copy().reset_index(drop=True)
    analyzed = analyzed_df.reset_index(drop=True)

    export_df["Scrutiny Category"] = analyzed["scrutiny_category"].fillna("")
    export_df["Scrutiny Reason"] = analyzed["scrutiny_reason"].fillna("")

    return export_df


async def save_upload(file: UploadFile) -> str:
    filename = (file.filename or "").lower()
    if filename.endswith(".xlsx"):
        suffix = ".xlsx"
    elif filename.endswith(".xls"):
        suffix = ".xls"
    else:
        suffix = ".csv"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await file.read()
    tmp.write(content)
    tmp.close()
    return tmp.name


def run_analysis(tmp_path: str, use_ml: bool, contamination: float) -> tuple[pd.DataFrame, dict]:
    raw_df = _read_uploaded_dataframe(tmp_path)
    df = ingest(tmp_path)

    df = run_all_rules(df)
    rule_flagged = int(df["scrutiny_flag"].sum())

    ml_flagged = 0
    if use_ml:
        ml_pipeline = train(df, contamination=contamination)
        df = predict(df, ml_pipeline)

        ml_only = (df["ml_anomaly_flag"] == -1) & (~df["scrutiny_flag"])
        df.loc[ml_only, "scrutiny_flag"] = True
        df.loc[ml_only, "scrutiny_category"] = "ML Anomaly"
        df.loc[ml_only, "scrutiny_reason"] = (
            "Statistical outlier detected by Isolation Forest (score: "
            + df.loc[ml_only, "ml_anomaly_score"].round(4).astype(str)
            + ")"
        )
        ml_flagged = int(ml_only.sum())

    total_flagged = int(df["scrutiny_flag"].sum())
    flagged_df = df[df["scrutiny_flag"]].copy()

    # Category counts
    cat_counts = (
        flagged_df["scrutiny_category"]
        .str.split(", ")
        .explode()
        .value_counts()
        .reset_index()
    )
    cat_counts.columns = ["category", "count"]
    category_counts = cat_counts.to_dict(orient="records")

    # Serialize flagged rows
    flagged_df["date"] = flagged_df["date"].dt.strftime("%Y-%m-%d")
    flagged_df = flagged_df.fillna("")
    cols_to_drop = [c for c in ["scrutiny_flag"] if c in flagged_df.columns]
    flagged_rows = flagged_df.drop(columns=cols_to_drop).to_dict(orient="records")

    summary = {
        "total_entries": len(df),
        "rule_flagged": rule_flagged,
        "ml_flagged": ml_flagged,
        "total_flagged": total_flagged,
        "pct_flagged": round(total_flagged / len(df) * 100, 1) if len(df) > 0 else 0,
    }

    export_df = _build_export_dataframe(raw_df, df)

    return export_df, {"summary": summary, "category_counts": category_counts, "flagged_rows": flagged_rows}


def generate_report(df: pd.DataFrame) -> bytes:
    return export(df)

# ui/app.py
# Streamlit single-page web application.
# Two tabs:
#   Tab 1 — Scrutiny Engine : upload GL → run rules + ML → download report
#   Tab 2 — Generate Data   : configure and download synthetic GL data

import io
import sys
import os
import pandas as pd
import streamlit as st
import plotly.express as px

# Allow imports from parent directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrutiny.ingestor  import ingest, SchemaError
from scrutiny.engine    import run_all_rules
from scrutiny.exporter  import export
from scrutiny.ml.model  import train, predict
from generator.core     import generate
from generator.patterns import inject_all
from generator.config   import CONFIG

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Ledger Scrutiny Assistant",
    page_icon="🔍",
    layout="wide",
)

st.title("🔍 Ledger Scrutiny Assistant")
st.caption("Audit Intelligence Suite — Synthetic Data Generator + Anomaly Detection")

tab1, tab2 = st.tabs(["📂 Scrutiny Engine", "⚙️ Generate Test Data"])


# ══════════════════════════════════════════════════════════════════════════════
#  TAB 1 — SCRUTINY ENGINE
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    st.header("Ledger Scrutiny Engine")
    st.info(
        "Upload your General Ledger file (.csv or .xlsx). "
        "The engine will apply 6 rule-based checks (R1–R6) "
        "and an Isolation Forest ML model to flag suspicious transactions.",
        icon="ℹ️",
    )

    # ── Upload ────────────────────────────────────────────────────────────────
    uploaded_file = st.file_uploader(
        "Drop your GL file here or click to browse",
        type=["csv", "xlsx"],
        help="Required columns: date, ledger_name, amount, narration, voucher_type",
    )

    use_ml = st.toggle("Enable Isolation Forest (ML anomaly detection)", value=True)
    contamination = st.slider(
        "ML contamination rate (expected % anomalies)",
        min_value=0.01, max_value=0.20, value=0.05, step=0.01,
        disabled=not use_ml,
        help="Increase to flag more rows; decrease to flag fewer rows.",
    )

    if uploaded_file:
        # ── Save temp file ────────────────────────────────────────────────────
        suffix = ".xlsx" if uploaded_file.name.endswith("xlsx") else ".csv"
        tmp_path = f"data/output/tmp_upload{suffix}"
        os.makedirs("data/output", exist_ok=True)
        with open(tmp_path, "wb") as f:
            f.write(uploaded_file.read())

        # ── Validate ──────────────────────────────────────────────────────────
        try:
            with st.spinner("Validating file schema ..."):
                df = ingest(tmp_path)
        except SchemaError as e:
            st.error(f"❌ Schema Error: {e}")
            st.stop()

        st.success(f"✅ File validated — {len(df):,} entries loaded.")

        # ── Run rules ─────────────────────────────────────────────────────────
        progress_bar = st.progress(0, text="Analysing entries ...")
        progress_bar.progress(20, text=f"Running scrutiny rules on {len(df):,} entries ...")
        df = run_all_rules(df)
        rule_flagged = df["scrutiny_flag"].sum()
        progress_bar.progress(60, text="Rules complete.")

        # ── Run ML ────────────────────────────────────────────────────────────
        if use_ml:
            progress_bar.progress(65, text="Training Isolation Forest ...")
            ml_pipeline = train(df, contamination=contamination)
            df = predict(df, ml_pipeline)

            ml_only = (df["ml_anomaly_flag"] == -1) & (~df["scrutiny_flag"])
            df.loc[ml_only, "scrutiny_flag"]     = True
            df.loc[ml_only, "scrutiny_category"] = "ML Anomaly"
            df.loc[ml_only, "scrutiny_reason"]   = (
                "Statistical outlier detected by Isolation Forest (score: "
                + df.loc[ml_only, "ml_anomaly_score"].round(4).astype(str) + ")"
            )
            progress_bar.progress(90, text="ML detection complete.")

        progress_bar.progress(100, text="Analysis complete.")

        # ── Summary ───────────────────────────────────────────────────────────
        total_flagged = df["scrutiny_flag"].sum()
        pct_flagged   = round(total_flagged / len(df) * 100, 1)

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total Entries",     f"{len(df):,}")
        col2.metric("Rule Flagged",      f"{rule_flagged:,}")
        col3.metric("ML Flagged",        f"{(ml_only.sum() if use_ml else 0):,}")
        col4.metric("Total Flagged",     f"{total_flagged:,}  ({pct_flagged}%)")

        # ── Category breakdown chart ──────────────────────────────────────────
        flagged_df = df[df["scrutiny_flag"]].copy()

        if not flagged_df.empty:
            cat_counts = (
                flagged_df["scrutiny_category"]
                .str.split(", ")
                .explode()
                .value_counts()
                .reset_index()
            )
            cat_counts.columns = ["Category", "Count"]
            fig = px.bar(
                cat_counts, x="Category", y="Count",
                title="Flagged Transactions by Scrutiny Category",
                color="Count",
                color_continuous_scale="Blues",
            )
            st.plotly_chart(fig, use_container_width=True)

        # ── Filter panel ──────────────────────────────────────────────────────
        st.subheader("Filter Results")
        all_categories = [
            "Round Numbers", "Weekend Entries", "Period End",
            "Weak Narration", "Duplicate Check", "Manual Journal", "ML Anomaly",
        ]
        selected_cats = st.multiselect(
            "Show only these categories (leave empty to show all flagged):",
            options=all_categories,
            default=[],
        )

        if selected_cats:
            mask = flagged_df["scrutiny_category"].apply(
                lambda x: any(c in x for c in selected_cats)
            )
            display_df = flagged_df[mask]
        else:
            display_df = flagged_df

        st.dataframe(display_df.reset_index(drop=True), use_container_width=True, height=400)
        st.caption(f"Showing {len(display_df):,} rows")

        # ── Disclaimer ────────────────────────────────────────────────────────
        st.warning(
            "**Disclaimer:** Inclusion of a transaction in this register does not indicate "
            "an error, fraud, or misstatement. It indicates that the transaction meets "
            "predefined scrutiny criteria and requires auditor review.",
            icon="⚠️",
        )

        # ── Download ──────────────────────────────────────────────────────────
        excel_bytes = export(df)
        st.download_button(
            label="📥 Download Scrutiny Report (.xlsx)",
            data=excel_bytes,
            file_name="scrutiny_report.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


# ══════════════════════════════════════════════════════════════════════════════
#  TAB 2 — GENERATE TEST DATA
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    st.header("Synthetic GL Data Generator")
    st.info(
        "Generate realistic fake General Ledger data for testing. "
        "Anomaly patterns matching each scrutiny rule can be injected.",
        icon="ℹ️",
    )

    col_left, col_right = st.columns(2)

    with col_left:
        company_name = st.text_input("Company Name", value="Acme Pvt Ltd")

        fiscal_year = st.selectbox(
            "Fiscal Year",
            ["Apr 2024 – Mar 2025", "Apr 2023 – Mar 2024", "Jan 2024 – Dec 2024"],
        )
        fy_map = {
            "Apr 2024 – Mar 2025": ("2024-04-01", "2025-03-31"),
            "Apr 2023 – Mar 2024": ("2023-04-01", "2024-03-31"),
            "Jan 2024 – Dec 2024": ("2024-01-01", "2024-12-31"),
        }
        fy_start, fy_end = fy_map[fiscal_year]

        period = st.selectbox(
            "Period",
            ["Full Year", "Q1 (Apr–Jun)", "Q2 (Jul–Sep)", "Q3 (Oct–Dec)", "Q4 (Jan–Mar)"],
        )
        period_map = {
            "Full Year":       (fy_start, fy_end),
            "Q1 (Apr–Jun)":    (f"{fy_start[:4]}-04-01", f"{fy_start[:4]}-06-30"),
            "Q2 (Jul–Sep)":    (f"{fy_start[:4]}-07-01", f"{fy_start[:4]}-09-30"),
            "Q3 (Oct–Dec)":    (f"{fy_start[:4]}-10-01", f"{fy_start[:4]}-12-31"),
            "Q4 (Jan–Mar)":    (f"{int(fy_start[:4])+1}-01-01", f"{int(fy_start[:4])+1}-03-31"),
        }
        p_start, p_end = period_map[period]

        num_rows = st.slider("Number of rows", 1000, 100000, 50000, step=1000)
        seed     = st.number_input("Random seed", min_value=0, max_value=9999, value=42)

    with col_right:
        st.markdown("**Anomaly Injection (toggle per rule)**")
        inject_r1 = st.checkbox("R1 — Round Amounts (~15%)",      value=True)
        inject_r2 = st.checkbox("R2 — Weekend Postings (~5%)",    value=True)
        inject_r3 = st.checkbox("R3 — Period End Cluster (~8%)",  value=True)
        inject_r4 = st.checkbox("R4 — Weak Narrations (~10%)",    value=True)
        inject_r5 = st.checkbox("R5 — Duplicate Rows (~2%)",      value=True)
        inject_r6 = st.checkbox("R6 — Manual Journals (~20%)",    value=True)

    if st.button("⚙️ Generate Dataset"):
        with st.spinner(f"Generating {num_rows:,} rows ..."):
            df_gen = generate(
                start_date=p_start, end_date=p_end, rows=num_rows, seed=int(seed)
            )

            # Selective injection
            from generator import patterns as pat
            if inject_r1: df_gen = pat.inject_round_amounts(df_gen)
            if inject_r2: df_gen = pat.inject_weekend_postings(df_gen)
            if inject_r3: df_gen = pat.inject_period_end_clustering(df_gen)
            if inject_r4: df_gen = pat.inject_weak_narrations(df_gen)
            if inject_r6: df_gen = pat.inject_manual_journals(df_gen)
            if inject_r5: df_gen = pat.inject_duplicates(df_gen)
            df_gen = df_gen.reset_index(drop=True)

        st.success(f"✅ Generated {len(df_gen):,} rows.")

        # Preview
        st.subheader("Preview (first 10 rows)")
        st.dataframe(df_gen.head(10), use_container_width=True)

        # Stats
        c1, c2, c3 = st.columns(3)
        c1.metric("Total Rows",    f"{len(df_gen):,}")
        c2.metric("Amount Mean",   f"₹{df_gen['amount'].mean():,.0f}")
        c3.metric("Round Amounts", f"{(df_gen['amount'] % 1000 == 0).sum():,}")

        # Download
        csv_bytes = df_gen.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Download Synthetic GL (.csv)",
            data=csv_bytes,
            file_name=f"synthetic_gl_{p_start[:4]}.csv",
            mime="text/csv",
        )

    # ── How to use ────────────────────────────────────────────────────────────
    with st.expander("ℹ️  How to use this tool"):
        st.markdown("""
**Scrutiny Engine (Tab 1)**
1. Upload your General Ledger as `.csv` or `.xlsx`
2. Required columns: `date`, `ledger_name`, `amount`, `narration`, `voucher_type`
3. Toggle Isolation Forest on/off and set the contamination rate
4. Click the download button to get the Excel scrutiny report

**Generate Test Data (Tab 2)**
1. Pick a fiscal year, period, and row count
2. Toggle which anomaly patterns to inject
3. Click Generate — preview the data and download the CSV
4. Use that CSV in the Scrutiny Engine tab to test the detection pipeline

**Scrutiny Rules**
| Rule | Name | What it catches |
|------|------|----------------|
| R1 | Round Numbers | Amounts that are exact multiples of 1,000 |
| R2 | Weekend Entries | Transactions posted on Sunday |
| R3 | Period End | Entries in the last 5 days of each month |
| R4 | Weak Narration | Short or generic narration text |
| R5 | Duplicate Check | Same date + ledger + amount appearing twice |
| R6 | Manual Journal | Voucher type is 'Journal' or 'JV' |
| ML | ML Anomaly | Statistical outlier (Isolation Forest) |
        """)

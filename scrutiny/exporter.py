# scrutiny/exporter.py
# Excel report exporter.
# Exports ALL GL rows with two extra columns appended:
#   - Anomaly Type  : scrutiny category (blank for clean rows)
#   - Why Flagged   : plain-English reason (blank for clean rows)
# Plus a Summary sheet as the first tab.

import io
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

DISCLAIMER = (
    "AUDIT SCRUTINY REGISTER  \u2013  "
    "Flagged rows are highlighted in amber. Blank 'Anomaly Type' rows are clean entries. "
    "Inclusion of a transaction does NOT indicate error or fraud \u2014 it requires auditor review."
)

# ── Colours ────────────────────────────────────────────────────────────────────
HEADER_FILL     = PatternFill("solid", fgColor="0F4C40")   # dark teal
DISCLAIMER_FILL = PatternFill("solid", fgColor="FFF3CD")   # amber
ROW_CLEAN_ODD   = PatternFill("solid", fgColor="F8FAFB")   # near-white
ROW_CLEAN_EVEN  = PatternFill("solid", fgColor="FFFFFF")
ROW_FLAG_FILL   = PatternFill("solid", fgColor="FFFDE7")   # amber tint for flagged rows
ANOMALY_FILL    = PatternFill("solid", fgColor="FFE082")   # amber for anomaly type cell
REASON_FILL     = PatternFill("solid", fgColor="FFF8E1")   # light amber for reason cell

# ── Fonts ──────────────────────────────────────────────────────────────────────
WHITE_FONT      = Font(color="FFFFFF", bold=True, size=10)
DISCLAIMER_FONT = Font(color="7D5700", bold=True, italic=True, size=9)
BODY_FONT       = Font(size=9)
ANOMALY_FONT    = Font(color="5D4037", bold=True, size=9)
REASON_FONT     = Font(color="5D4037", size=9)

THIN_BORDER = Border(
    left=Side(style="thin"),  right=Side(style="thin"),
    top=Side(style="thin"),   bottom=Side(style="thin"),
)


# ── Summary sheet ──────────────────────────────────────────────────────────────
def _build_summary_sheet(ws_sum, df_all: pd.DataFrame, flagged: pd.DataFrame) -> None:
    HEADING_FILL = PatternFill("solid", fgColor="0F4C40")
    HEADING_FONT = Font(color="FFFFFF", bold=True, size=10)
    LABEL_FONT   = Font(bold=True, size=9)
    VALUE_FONT   = Font(size=9)
    SUBHEAD_FILL = PatternFill("solid", fgColor="D9E1F2")
    SUBHEAD_FONT = Font(bold=True, size=9, color="1A376C")

    total     = len(df_all)
    n_flagged = int(flagged["scrutiny_flag"].sum()) if "scrutiny_flag" in flagged.columns else len(flagged)
    pct       = round(n_flagged / total * 100, 1) if total else 0.0

    row = 1

    for label, value in [
        ("Overview", None),
        ("Total GL Entries", total),
        ("Total Flagged",    n_flagged),
        ("% Flagged",        f"{pct}%"),
    ]:
        if label == "Overview":
            c = ws_sum.cell(row=row, column=1, value=label)
            c.font = HEADING_FONT; c.fill = HEADING_FILL
            ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        else:
            ws_sum.cell(row=row, column=1, value=label).font = LABEL_FONT
            ws_sum.cell(row=row, column=2, value=value).font  = VALUE_FONT
        row += 1

    row += 1

    c = ws_sum.cell(row=row, column=1, value="Counts by Rule")
    c.font = SUBHEAD_FONT; c.fill = SUBHEAD_FILL
    ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1

    ws_sum.cell(row=row, column=1, value="Rule").font  = LABEL_FONT
    ws_sum.cell(row=row, column=2, value="Count").font = LABEL_FONT
    row += 1

    if not flagged.empty and "scrutiny_category" in flagged.columns:
        cat_series = (
            flagged["scrutiny_category"]
            .str.split(", ").explode().str.strip()
        )
        for cat, cnt in cat_series.value_counts().sort_values(ascending=False).items():
            ws_sum.cell(row=row, column=1, value=cat).font      = VALUE_FONT
            ws_sum.cell(row=row, column=2, value=int(cnt)).font = VALUE_FONT
            row += 1

    row += 1

    c = ws_sum.cell(row=row, column=1, value="Top 5 Accounts by Flag Count")
    c.font = SUBHEAD_FONT; c.fill = SUBHEAD_FILL
    ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1

    ws_sum.cell(row=row, column=1, value="Account (Ledger Name)").font = LABEL_FONT
    ws_sum.cell(row=row, column=2, value="Flags").font                 = LABEL_FONT
    row += 1

    if not flagged.empty and "ledger_name" in flagged.columns:
        for acct, cnt in flagged["ledger_name"].value_counts().head(5).items():
            ws_sum.cell(row=row, column=1, value=acct).font     = VALUE_FONT
            ws_sum.cell(row=row, column=2, value=int(cnt)).font = VALUE_FONT
            row += 1

    ws_sum.column_dimensions["A"].width = 40
    ws_sum.column_dimensions["B"].width = 12


# ── Main export ────────────────────────────────────────────────────────────────
def export(df: pd.DataFrame, output_path: str = None) -> bytes:
    """
    Export ALL GL rows to Excel with two extra columns:
      - Anomaly Type  (blank for clean rows)
      - Why Flagged   (blank for clean rows)
    Flagged rows are highlighted in amber.
    """
    out_df = df.copy().reset_index(drop=True)

    # ── Drop internal scrutiny columns; keep clean GL cols only ───────────────
    drop_cols = ["scrutiny_flag", "scrutiny_category", "scrutiny_reason",
                 "ml_anomaly_flag", "ml_anomaly_score"]

    # Build the two new display columns BEFORE dropping the source cols
    out_df["Anomaly Type"] = out_df.get("scrutiny_category", "").where(
        out_df.get("scrutiny_flag", pd.Series(False, index=out_df.index)), other=""
    )
    out_df["Why Flagged"] = out_df.get("scrutiny_reason", "").where(
        out_df.get("scrutiny_flag", pd.Series(False, index=out_df.index)), other=""
    )

    # Boolean mask for flagged rows (used for row colouring)
    is_flagged = out_df.get("scrutiny_flag", pd.Series(False, index=out_df.index)).astype(bool)

    # Drop internal cols
    out_df = out_df.drop(columns=[c for c in drop_cols if c in out_df.columns])

    final_cols = list(out_df.columns)   # GL cols + Anomaly Type + Why Flagged

    # ── Write to buffer ───────────────────────────────────────────────────────
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        out_df.to_excel(writer, sheet_name="GL Data", index=False, startrow=2)

    buffer.seek(0)
    wb = load_workbook(buffer)
    ws = wb["GL Data"]

    # ── Disclaimer (row 1) ────────────────────────────────────────────────────
    ws.insert_rows(1)
    ws.insert_rows(1)
    d = ws.cell(row=1, column=1, value=DISCLAIMER)
    d.font      = DISCLAIMER_FONT
    d.fill      = DISCLAIMER_FILL
    d.alignment = Alignment(wrap_text=True, vertical="center")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(final_cols))
    ws.row_dimensions[1].height = 36

    # ── Header row (row 3) ────────────────────────────────────────────────────
    header_row = 3
    for col_idx in range(1, len(final_cols) + 1):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.fill      = HEADER_FILL
        cell.font      = WHITE_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border    = THIN_BORDER
    ws.row_dimensions[header_row].height = 28

    # ── Data rows ─────────────────────────────────────────────────────────────
    anomaly_col_idx = final_cols.index("Anomaly Type") + 1 if "Anomaly Type" in final_cols else None
    reason_col_idx  = final_cols.index("Why Flagged")  + 1 if "Why Flagged"  in final_cols else None

    for row_idx in range(header_row + 1, ws.max_row + 1):
        data_row = row_idx - (header_row + 1)   # 0-based index into original df
        flagged_row = bool(is_flagged.iloc[data_row]) if data_row < len(is_flagged) else False

        base_fill = ROW_FLAG_FILL if flagged_row else (
            ROW_CLEAN_ODD if row_idx % 2 == 0 else ROW_CLEAN_EVEN
        )

        for col_idx in range(1, len(final_cols) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.border = THIN_BORDER

            if col_idx == anomaly_col_idx:
                cell.fill      = ANOMALY_FILL if flagged_row else ROW_CLEAN_EVEN
                cell.font      = ANOMALY_FONT if flagged_row else BODY_FONT
                cell.alignment = Alignment(vertical="center", wrap_text=True)
            elif col_idx == reason_col_idx:
                cell.fill      = REASON_FILL if flagged_row else ROW_CLEAN_EVEN
                cell.font      = REASON_FONT if flagged_row else BODY_FONT
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            else:
                cell.fill      = base_fill
                cell.font      = BODY_FONT
                cell.alignment = Alignment(vertical="center")

        if flagged_row:
            ws.row_dimensions[row_idx].height = 28  # a bit taller for wrapped reason

    # ── Column widths ─────────────────────────────────────────────────────────
    fixed = {
        "date": 13, "ledger_name": 28, "amount": 14,
        "narration": 35, "voucher_type": 16,
        "Anomaly Type": 24, "Why Flagged": 60,
    }
    for col_idx, col_name in enumerate(final_cols, start=1):
        col_letter = get_column_letter(col_idx)
        if col_name in fixed:
            ws.column_dimensions[col_letter].width = fixed[col_name]
        else:
            max_len = max(
                len(str(col_name)),
                *[len(str(ws.cell(row=r, column=col_idx).value or ""))
                  for r in range(header_row, min(ws.max_row + 1, header_row + 50))],
            )
            ws.column_dimensions[col_letter].width = min(max_len + 2, 40)

    ws.freeze_panes = f"A{header_row + 1}"

    # ── Summary sheet (first tab) ─────────────────────────────────────────────
    ws_sum = wb.create_sheet(title="Summary")
    _build_summary_sheet(
        ws_sum, df,
        df[df["scrutiny_flag"]].copy() if "scrutiny_flag" in df.columns else out_df
    )
    wb.move_sheet("Summary", offset=-wb.index(ws_sum))

    # ── Save ──────────────────────────────────────────────────────────────────
    final_buf = io.BytesIO()
    wb.save(final_buf)
    final_buf.seek(0)
    excel_bytes = final_buf.read()

    if output_path:
        with open(output_path, "wb") as f:
            f.write(excel_bytes)
        print(f"Report saved: {output_path}  ({int(is_flagged.sum()):,} flagged rows)")

    return excel_bytes

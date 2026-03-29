# scrutiny/exporter.py
# Exports ALL GL rows to Excel with two extra columns:
#   "Anomaly Type"  — rule categories (blank for clean rows)
#   "Why Flagged"   — plain-English reason (blank for clean rows)
# Flagged rows are highlighted amber. Clean rows alternate white/light-grey.

import io
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


DISCLAIMER = (
    "AUDIT SCRUTINY REGISTER — Flagged rows are highlighted in amber. "
    "Blank 'Anomaly Type' rows are clean entries. "
    "Inclusion does NOT indicate error or fraud — it requires auditor review."
)

HEADER_FILL     = PatternFill("solid", fgColor="0F4C40")
DISCLAIMER_FILL = PatternFill("solid", fgColor="FFF3CD")
ROW_ODD         = PatternFill("solid", fgColor="F8FAFB")
ROW_EVEN        = PatternFill("solid", fgColor="FFFFFF")
ROW_FLAG        = PatternFill("solid", fgColor="FFFDE7")
ANOMALY_FILL    = PatternFill("solid", fgColor="FFE082")
REASON_FILL     = PatternFill("solid", fgColor="FFF8E1")

WHITE_BOLD      = Font(color="FFFFFF", bold=True, size=10)
DISCLAIMER_FONT = Font(color="7D5700", bold=True, italic=True, size=9)
BODY            = Font(size=9)
ANOMALY_FONT    = Font(color="5D4037", bold=True, size=9)
REASON_FONT     = Font(color="5D4037", size=9)

BORDER = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"),  bottom=Side(style="thin"),
)


def _summary_sheet(ws, df_all, flagged):
    H_FILL = PatternFill("solid", fgColor="0F4C40")
    H_FONT = Font(color="FFFFFF", bold=True, size=10)
    LF     = Font(bold=True, size=9)
    VF     = Font(size=9)
    SF     = PatternFill("solid", fgColor="D9E1F2")
    SFt    = Font(bold=True, size=9, color="1A376C")

    total     = len(df_all)
    n_flag    = int(flagged["scrutiny_flag"].sum()) if "scrutiny_flag" in flagged.columns else 0
    pct       = round(n_flag / total * 100, 1) if total else 0.0
    row = 1

    for lbl, val in [("Overview", None), ("Total GL Entries", total),
                      ("Total Flagged", n_flag), ("% Flagged", f"{pct}%")]:
        if lbl == "Overview":
            c = ws.cell(row=row, column=1, value=lbl)
            c.font = H_FONT; c.fill = H_FILL
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        else:
            ws.cell(row=row, column=1, value=lbl).font = LF
            ws.cell(row=row, column=2, value=val).font  = VF
        row += 1

    row += 1
    c = ws.cell(row=row, column=1, value="Counts by Rule")
    c.font = SFt; c.fill = SF
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1
    ws.cell(row=row, column=1, value="Rule").font  = LF
    ws.cell(row=row, column=2, value="Count").font = LF
    row += 1

    if not flagged.empty and "scrutiny_category" in flagged.columns:
        cats = (flagged["scrutiny_category"]
                .str.split(", ").explode().str.strip()
                .value_counts().sort_values(ascending=False))
        for cat, cnt in cats.items():
            ws.cell(row=row, column=1, value=cat).font      = VF
            ws.cell(row=row, column=2, value=int(cnt)).font = VF
            row += 1

    row += 1
    c = ws.cell(row=row, column=1, value="Top 5 Accounts by Flag Count")
    c.font = SFt; c.fill = SF
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1
    ws.cell(row=row, column=1, value="Account").font = LF
    ws.cell(row=row, column=2, value="Flags").font   = LF
    row += 1

    if not flagged.empty and "ledger_name" in flagged.columns:
        for acct, cnt in flagged["ledger_name"].value_counts().head(5).items():
            ws.cell(row=row, column=1, value=acct).font     = VF
            ws.cell(row=row, column=2, value=int(cnt)).font = VF
            row += 1

    ws.column_dimensions["A"].width = 40
    ws.column_dimensions["B"].width = 12


def export(df: pd.DataFrame, output_path: str = None) -> bytes:
    """Export ALL GL rows with Anomaly Type + Why Flagged columns."""

    out = df.copy().reset_index(drop=True)

    # Build the two new columns using .loc (safe, no .where/.get)
    out["Anomaly Type"] = ""
    out["Why Flagged"]  = ""

    if "scrutiny_flag" in out.columns and "scrutiny_category" in out.columns:
        mask = out["scrutiny_flag"].astype(bool)
        out.loc[mask, "Anomaly Type"] = out.loc[mask, "scrutiny_category"].fillna("")
        out.loc[mask, "Why Flagged"]  = out.loc[mask, "scrutiny_reason"].fillna("") \
            if "scrutiny_reason" in out.columns else ""

    # Keep a boolean mask for row colouring before we drop the flag col
    is_flagged = out["scrutiny_flag"].astype(bool) if "scrutiny_flag" in out.columns \
        else pd.Series(False, index=out.index)

    # Drop internal columns
    drop = ["scrutiny_flag", "scrutiny_category", "scrutiny_reason",
            "ml_anomaly_flag", "ml_anomaly_score"]
    out = out.drop(columns=[c for c in drop if c in out.columns])

    cols = list(out.columns)  # GL cols + Anomaly Type + Why Flagged

    # Write via pandas first (handles dtypes / dates cleanly)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        out.to_excel(writer, sheet_name="GL Data", index=False, startrow=2)
    buf.seek(0)
    wb = load_workbook(buf)
    ws = wb["GL Data"]

    # Insert 2 rows at top for disclaimer
    ws.insert_rows(1)
    ws.insert_rows(1)

    # Disclaimer row 1
    d = ws.cell(row=1, column=1, value=DISCLAIMER)
    d.font = DISCLAIMER_FONT
    d.fill = DISCLAIMER_FILL
    d.alignment = Alignment(wrap_text=True, vertical="center")
    if len(cols) > 1:
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(cols))
    ws.row_dimensions[1].height = 36

    # Header row is now row 3
    HDR = 3
    for ci in range(1, len(cols) + 1):
        c = ws.cell(row=HDR, column=ci)
        c.fill      = HEADER_FILL
        c.font      = WHITE_BOLD
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border    = BORDER
    ws.row_dimensions[HDR].height = 28

    # Identify column indices for the two special cols
    a_idx = cols.index("Anomaly Type") + 1 if "Anomaly Type" in cols else None
    w_idx = cols.index("Why Flagged")  + 1 if "Why Flagged"  in cols else None

    # Style data rows
    for ri in range(HDR + 1, ws.max_row + 1):
        di = ri - (HDR + 1)   # 0-based index into is_flagged
        flagged_row = bool(is_flagged.iloc[di]) if di < len(is_flagged) else False
        base = ROW_FLAG if flagged_row else (ROW_ODD if ri % 2 == 0 else ROW_EVEN)

        for ci in range(1, len(cols) + 1):
            cell = ws.cell(row=ri, column=ci)
            cell.border = BORDER
            if ci == a_idx:
                cell.fill      = ANOMALY_FILL if flagged_row else ROW_EVEN
                cell.font      = ANOMALY_FONT if flagged_row else BODY
                cell.alignment = Alignment(vertical="center", wrap_text=True)
            elif ci == w_idx:
                cell.fill      = REASON_FILL if flagged_row else ROW_EVEN
                cell.font      = REASON_FONT if flagged_row else BODY
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            else:
                cell.fill      = base
                cell.font      = BODY
                cell.alignment = Alignment(vertical="center")

        if flagged_row:
            ws.row_dimensions[ri].height = 28

    # Column widths
    WIDTHS = {
        "date": 13, "ledger_name": 28, "amount": 14,
        "narration": 35, "voucher_type": 16,
        "Anomaly Type": 26, "Why Flagged": 60,
    }
    for ci, col_name in enumerate(cols, start=1):
        letter = get_column_letter(ci)
        if col_name in WIDTHS:
            ws.column_dimensions[letter].width = WIDTHS[col_name]
        else:
            # auto-fit based on sample rows
            sample_lens = [
                len(str(ws.cell(row=r, column=ci).value or ""))
                for r in range(HDR, min(ws.max_row + 1, HDR + 50))
            ]
            best = max([len(str(col_name))] + sample_lens)
            ws.column_dimensions[letter].width = min(best + 2, 40)

    ws.freeze_panes = f"A{HDR + 1}"

    # Summary tab (first)
    ws_sum = wb.create_sheet(title="Summary")
    flagged_df = df[df["scrutiny_flag"]].copy() if "scrutiny_flag" in df.columns else pd.DataFrame()
    _summary_sheet(ws_sum, df, flagged_df)
    wb.move_sheet("Summary", offset=-wb.index(ws_sum))

    # Save
    out_buf = io.BytesIO()
    wb.save(out_buf)
    out_buf.seek(0)
    result = out_buf.read()

    if output_path:
        with open(output_path, "wb") as f:
            f.write(result)

    return result

# scrutiny/exporter.py
# Excel report exporter.
# Takes the flagged DataFrame and produces a styled .xlsx file with:
# - Mandatory disclaimer at the top
# - All original GL columns preserved
# - Scrutiny Category and Scrutiny Reason as the final two columns
# - Styled: bold header, alternating row colours, auto-fit columns

import io
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side
)
from openpyxl.utils import get_column_letter

DISCLAIMER = (
    "Inclusion of a transaction in the Ledger Scrutiny Register does not indicate an error, "
    "fraud, or misstatement. It indicates that the transaction meets predefined scrutiny "
    "criteria and requires auditor review."
)

# Colours
HEADER_FILL    = PatternFill("solid", fgColor="1A376C")
DISCLAIMER_FILL= PatternFill("solid", fgColor="FFF3CD")
ROW_FILL_ODD   = PatternFill("solid", fgColor="F2F6FC")
ROW_FILL_EVEN  = PatternFill("solid", fgColor="FFFFFF")
CATEGORY_FILL  = PatternFill("solid", fgColor="E8F4FD")

WHITE_FONT     = Font(color="FFFFFF", bold=True, size=10)
DISCLAIMER_FONT= Font(color="7D5700", bold=True, italic=True, size=9)
BODY_FONT      = Font(size=9)
CATEGORY_FONT  = Font(color="1A376C", bold=True, size=9)

THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)


def _build_summary_sheet(ws_sum, df_all: pd.DataFrame, flagged: pd.DataFrame) -> None:
    """
    Populate the Summary worksheet with three sections:
      1. Overview — total rows, total flagged, % flagged
      2. Counts by Rule — one row per scrutiny category
      3. Top 5 Accounts — ledger_name accounts with the most flags
    """
    HEADING_FILL = PatternFill("solid", fgColor="1A376C")
    HEADING_FONT = Font(color="FFFFFF", bold=True, size=10)
    LABEL_FONT   = Font(bold=True, size=9)
    VALUE_FONT   = Font(size=9)
    SUBHEAD_FILL = PatternFill("solid", fgColor="D9E1F2")
    SUBHEAD_FONT = Font(bold=True, size=9, color="1A376C")

    total      = len(df_all)
    n_flagged  = int(flagged["scrutiny_flag"].sum()) if "scrutiny_flag" in flagged.columns else len(flagged)
    pct        = round(n_flagged / total * 100, 1) if total else 0.0

    row = 1

    # ── Section 1: Overview ───────────────────────────────────────────────────
    for label, value in [
        ("Overview", None),
        ("Total GL Entries",  total),
        ("Total Flagged",     n_flagged),
        ("% Flagged",         f"{pct}%"),
    ]:
        if label == "Overview":
            c = ws_sum.cell(row=row, column=1, value=label)
            c.font = HEADING_FONT;  c.fill = HEADING_FILL
            ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        else:
            ws_sum.cell(row=row, column=1, value=label).font  = LABEL_FONT
            ws_sum.cell(row=row, column=2, value=value).font  = VALUE_FONT
        row += 1

    row += 1  # blank row

    # ── Section 2: Counts by Rule ─────────────────────────────────────────────
    c = ws_sum.cell(row=row, column=1, value="Counts by Rule")
    c.font = SUBHEAD_FONT;  c.fill = SUBHEAD_FILL
    ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1

    ws_sum.cell(row=row, column=1, value="Rule").font  = LABEL_FONT
    ws_sum.cell(row=row, column=2, value="Count").font = LABEL_FONT
    row += 1

    # Explode multi-rule rows into individual categories
    if not flagged.empty and "scrutiny_category" in flagged.columns:
        cat_series = (
            flagged["scrutiny_category"]
            .str.split(", ")
            .explode()
            .str.strip()
        )
        cat_counts = cat_series.value_counts().sort_values(ascending=False)
        for cat, cnt in cat_counts.items():
            ws_sum.cell(row=row, column=1, value=cat).font  = VALUE_FONT
            ws_sum.cell(row=row, column=2, value=int(cnt)).font = VALUE_FONT
            row += 1

    row += 1  # blank row

    # ── Section 3: Top 5 Accounts ─────────────────────────────────────────────
    c = ws_sum.cell(row=row, column=1, value="Top 5 Accounts by Flag Count")
    c.font = SUBHEAD_FONT;  c.fill = SUBHEAD_FILL
    ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1

    ws_sum.cell(row=row, column=1, value="Account (Ledger Name)").font = LABEL_FONT
    ws_sum.cell(row=row, column=2, value="Flags").font                 = LABEL_FONT
    row += 1

    if not flagged.empty and "ledger_name" in flagged.columns:
        top5 = flagged["ledger_name"].value_counts().head(5)
        for acct, cnt in top5.items():
            ws_sum.cell(row=row, column=1, value=acct).font        = VALUE_FONT
            ws_sum.cell(row=row, column=2, value=int(cnt)).font    = VALUE_FONT
            row += 1

    # Auto-fit column widths
    ws_sum.column_dimensions["A"].width = 36
    ws_sum.column_dimensions["B"].width = 12


def export(df: pd.DataFrame, output_path: str = None) -> bytes:
    """
    Export the flagged GL rows to a styled Excel file.

    Args:
        df          : DataFrame containing ALL rows (flagged and unflagged).
                      Only rows where scrutiny_flag == True are exported.
        output_path : if provided, saves the file to this path.
                      Always returns the file as bytes for Streamlit download.

    Returns:
        bytes — the .xlsx file content
    """
    # ── Filter: keep only flagged rows ────────────────────────────────────────
    flagged = df[df["scrutiny_flag"]].copy().reset_index(drop=True)

    if flagged.empty:
        # Return an empty sheet with a message
        flagged = pd.DataFrame({"Message": ["No transactions flagged for scrutiny."]})

    # ── Reorder columns: original first, then scrutiny columns ───────────────
    scrutiny_cols = ["scrutiny_category", "scrutiny_reason"]
    ml_cols       = [c for c in ["ml_anomaly_flag", "ml_anomaly_score"] if c in flagged.columns]
    other_cols    = [c for c in flagged.columns
                     if c not in scrutiny_cols + ml_cols + ["scrutiny_flag"]]
    final_cols    = other_cols + scrutiny_cols + ml_cols
    final_cols    = [c for c in final_cols if c in flagged.columns]
    flagged       = flagged[final_cols]

    # ── Write to bytes buffer ─────────────────────────────────────────────────
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        flagged.to_excel(writer, sheet_name="Scrutiny Register", index=False, startrow=2)

    buffer.seek(0)
    wb = load_workbook(buffer)
    ws = wb["Scrutiny Register"]

    # ── Disclaimer row (row 1) ────────────────────────────────────────────────
    ws.insert_rows(1)
    ws.insert_rows(1)
    disclaimer_cell = ws.cell(row=1, column=1)
    disclaimer_cell.value = disclaimer_cell.value = DISCLAIMER
    disclaimer_cell.font  = DISCLAIMER_FONT
    disclaimer_cell.fill  = DISCLAIMER_FILL
    disclaimer_cell.alignment = Alignment(wrap_text=True, vertical="center")
    ws.merge_cells(
        start_row=1, start_column=1,
        end_row=1,   end_column=len(final_cols)
    )
    ws.row_dimensions[1].height = 40

    # ── Header row (row 3 after insertions) ───────────────────────────────────
    header_row = 3
    for col_idx, col_name in enumerate(final_cols, start=1):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.font      = WHITE_FONT
        cell.fill      = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border    = THIN_BORDER

    # ── Data rows ─────────────────────────────────────────────────────────────
    for row_idx in range(header_row + 1, ws.max_row + 1):
        fill = ROW_FILL_ODD if (row_idx % 2 == 0) else ROW_FILL_EVEN
        for col_idx in range(1, len(final_cols) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill      = fill
            cell.font      = BODY_FONT
            cell.border    = THIN_BORDER
            cell.alignment = Alignment(vertical="center", wrap_text=False)

            # Highlight scrutiny category and reason columns in light blue
            col_name = final_cols[col_idx - 1]
            if col_name in ("scrutiny_category", "scrutiny_reason"):
                cell.fill = CATEGORY_FILL
                cell.font = CATEGORY_FONT

    # ── Auto-fit column widths ────────────────────────────────────────────────
    for col_idx, col_name in enumerate(final_cols, start=1):
        col_letter = get_column_letter(col_idx)
        max_length = max(
            len(str(col_name)),
            *[
                len(str(ws.cell(row=r, column=col_idx).value or ""))
                for r in range(header_row, min(ws.max_row + 1, header_row + 50))
            ],
        )
        ws.column_dimensions[col_letter].width = min(max_length + 2, 45)

    # ── Freeze panes below header ─────────────────────────────────────────────
    ws.freeze_panes = f"A{header_row + 1}"

    # ── Summary sheet ─────────────────────────────────────────────────────────
    ws_sum = wb.create_sheet(title="Summary")
    _build_summary_sheet(ws_sum, df, df[df["scrutiny_flag"]].copy() if "scrutiny_flag" in df.columns else flagged)
    # Place Summary as the first tab
    wb.move_sheet("Summary", offset=-wb.index(ws_sum))

    # ── Save ──────────────────────────────────────────────────────────────────
    output_buffer = io.BytesIO()
    wb.save(output_buffer)
    output_buffer.seek(0)
    excel_bytes = output_buffer.read()

    if output_path:
        with open(output_path, "wb") as f:
            f.write(excel_bytes)
        print(f"Report saved: {output_path}  ({len(flagged):,} flagged rows)")

    return excel_bytes

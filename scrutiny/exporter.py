# scrutiny/exporter.py
# Excel report exporter.
# Produces a styled .xlsx with audit findings front-and-centre:
#   Sheet 1 "Flagged Transactions" : Sr. No., key GL cols, Anomaly Type(s),
#       Audit Finding (why flagged), individual R1-R6 flag columns, rest of GL
#   Sheet 2 "Summary"              : overview, rule counts, top accounts  (1st tab)
#   Sheet 3 "Rule Breakdown"       : per-rule transaction listing

import io
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

DISCLAIMER = (
    "AUDIT SCRUTINY REGISTER  \u2013  "
    "Inclusion of a transaction does NOT indicate error, fraud, or misstatement. "
    "It indicates the transaction meets predefined scrutiny criteria and requires auditor review."
)

# Rule registry \u2014 must match engine.py RULES keys exactly
RULE_LABELS  = [
    "Round Numbers", "Weekend Entries", "Period End",
    "Weak Narration", "Duplicate Check", "Manual Journal",
]
RULE_COLUMNS = [
    "R1: Round No.", "R2: Weekend",   "R3: Period-End",
    "R4: Weak Narr.", "R5: Duplicate", "R6: Manual JV",
]
RULE_DESCRIPTIONS = {
    "Round Numbers":   "R1 \u2013 Round Number: Transaction amount is a multiple of 1,000 / 10,000.",
    "Weekend Entries": "R2 \u2013 Weekend Entry: Transaction was posted on a Sunday.",
    "Period End":      "R3 \u2013 Period-End: Entry made within the critical 5-day period-end window.",
    "Weak Narration":  "R4 \u2013 Weak Narration: Narration is too short or uses generic placeholder text.",
    "Duplicate Check": "R5 \u2013 Duplicate: Multiple entries found with same date, ledger, and amount.",
    "Manual Journal":  "R6 \u2013 Manual Journal: Manual Journal Voucher (JV) detected; requires source verification.",
}

# Priority GL columns shown first in the output (before scrutiny cols)
PRIORITY_GL = ["date", "ledger_name", "amount", "narration", "voucher_type"]

# ── Colours ────────────────────────────────────────────────────────────────────
HEADER_FILL     = PatternFill("solid", fgColor="0F4C40")   # dark teal (matches app)
RULE_HDR_FILL   = PatternFill("solid", fgColor="2E7D32")   # dark green for rule cols
DISCLAIMER_FILL = PatternFill("solid", fgColor="FFF3CD")   # amber
ROW_FILL_ODD    = PatternFill("solid", fgColor="F0F9F7")   # light teal
ROW_FILL_EVEN   = PatternFill("solid", fgColor="FFFFFF")
REASON_FILL     = PatternFill("solid", fgColor="FFFDE7")   # light yellow for reason
CATEGORY_FILL   = PatternFill("solid", fgColor="E0F2F1")   # light teal for category
RULE_TICK_FILL  = PatternFill("solid", fgColor="E8F5E9")   # light green for \u2713
RULE_BLANK_FILL = PatternFill("solid", fgColor="FAFAFA")   # near-white for blank rule

# ── Fonts ──────────────────────────────────────────────────────────────────────
WHITE_FONT      = Font(color="FFFFFF", bold=True, size=10)
GREEN_HDR_FONT  = Font(color="FFFFFF", bold=True, size=9)
DISCLAIMER_FONT = Font(color="7D5700", bold=True, italic=True, size=9)
BODY_FONT       = Font(size=9)
REASON_FONT     = Font(color="5D4037", size=9)             # dark amber text
CATEGORY_FONT   = Font(color="004D40", bold=True, size=9)  # dark teal text
RULE_TICK_FONT  = Font(color="1B5E20", bold=True, size=10) # green \u2713

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

    # Section 1: Overview
    for label, value in [
        ("Overview", None),
        ("Total GL Entries", total),
        ("Total Flagged",    n_flagged),
        ("% Flagged",        f"{pct}%"),
    ]:
        if label == "Overview":
            c = ws_sum.cell(row=row, column=1, value=label)
            c.font = HEADING_FONT;  c.fill = HEADING_FILL
            ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        else:
            ws_sum.cell(row=row, column=1, value=label).font = LABEL_FONT
            ws_sum.cell(row=row, column=2, value=value).font = VALUE_FONT
        row += 1

    row += 1  # blank row

    # Section 2: Counts by Rule
    c = ws_sum.cell(row=row, column=1, value="Counts by Rule")
    c.font = SUBHEAD_FONT;  c.fill = SUBHEAD_FILL
    ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1

    ws_sum.cell(row=row, column=1, value="Rule").font  = LABEL_FONT
    ws_sum.cell(row=row, column=2, value="Count").font = LABEL_FONT
    row += 1

    if not flagged.empty and "scrutiny_category" in flagged.columns:
        cat_series = (
            flagged["scrutiny_category"]
            .str.split(", ")
            .explode()
            .str.strip()
        )
        for cat, cnt in cat_series.value_counts().sort_values(ascending=False).items():
            ws_sum.cell(row=row, column=1, value=cat).font      = VALUE_FONT
            ws_sum.cell(row=row, column=2, value=int(cnt)).font = VALUE_FONT
            row += 1

    row += 1  # blank row

    # Section 3: Top 5 Accounts
    c = ws_sum.cell(row=row, column=1, value="Top 5 Accounts by Flag Count")
    c.font = SUBHEAD_FONT;  c.fill = SUBHEAD_FILL
    ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    row += 1

    ws_sum.cell(row=row, column=1, value="Account (Ledger Name)").font = LABEL_FONT
    ws_sum.cell(row=row, column=2, value="Flags").font                 = LABEL_FONT
    row += 1

    if not flagged.empty and "ledger_name" in flagged.columns:
        for acct, cnt in flagged["ledger_name"].value_counts().head(5).items():
            ws_sum.cell(row=row, column=1, value=acct).font       = VALUE_FONT
            ws_sum.cell(row=row, column=2, value=int(cnt)).font   = VALUE_FONT
            row += 1

    ws_sum.column_dimensions["A"].width = 40
    ws_sum.column_dimensions["B"].width = 12


# ── Rule Breakdown sheet ───────────────────────────────────────────────────────
def _build_rule_breakdown_sheet(wb, flagged: pd.DataFrame) -> None:
    """One section per rule listing only the transactions that triggered it."""
    ws = wb.create_sheet(title="Rule Breakdown")

    SUBHEAD_FILL = PatternFill("solid", fgColor="0F4C40")
    SUBHEAD_FONT = Font(color="FFFFFF", bold=True, size=10)
    COL_HDR_FILL = PatternFill("solid", fgColor="E0F2F1")
    COL_HDR_FONT = Font(bold=True, size=9, color="004D40")
    VALUE_FONT   = Font(size=9)

    display_cols = [c for c in
                    ["Sr. No.", "date", "ledger_name", "amount",
                     "narration", "Anomaly Type(s)", "Audit Finding \u2013 Why Flagged"]
                    if c in flagged.columns]

    current_row = 1

    for rule_label, rule_col in zip(RULE_LABELS, RULE_COLUMNS):
        if rule_col not in flagged.columns:
            continue
        rule_df = flagged[flagged[rule_col] == "\u2713"][display_cols].copy()
        if rule_df.empty:
            continue

        # Rule heading row
        desc = RULE_DESCRIPTIONS.get(rule_label, rule_label)
        cell = ws.cell(row=current_row, column=1,
                       value=f"{desc}  ({len(rule_df)} transaction(s))")
        cell.fill = SUBHEAD_FILL
        cell.font = SUBHEAD_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.merge_cells(
            start_row=current_row, start_column=1,
            end_row=current_row,   end_column=len(display_cols)
        )
        ws.row_dimensions[current_row].height = 24
        current_row += 1

        # Column headers
        for col_idx, col_name in enumerate(display_cols, start=1):
            c = ws.cell(row=current_row, column=col_idx, value=col_name)
            c.fill      = COL_HDR_FILL
            c.font      = COL_HDR_FONT
            c.border    = THIN_BORDER
            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        current_row += 1

        # Data rows
        for _, row_data in rule_df.iterrows():
            for col_idx, col_name in enumerate(display_cols, start=1):
                val  = row_data[col_name]
                cell = ws.cell(row=current_row, column=col_idx, value=val)
                cell.font   = VALUE_FONT
                cell.border = THIN_BORDER
                cell.alignment = Alignment(
                    vertical="top",
                    wrap_text=(col_name in ("Audit Finding \u2013 Why Flagged", "narration"))
                )
                if col_name == "Audit Finding \u2013 Why Flagged":
                    cell.fill = REASON_FILL
                    cell.font = REASON_FONT
                elif col_name == "Anomaly Type(s)":
                    cell.fill = CATEGORY_FILL
                    cell.font = CATEGORY_FONT
            ws.row_dimensions[current_row].height = 30
            current_row += 1

        current_row += 2  # blank rows between rule sections

    # Column widths for this sheet
    col_widths = {
        "Sr. No.": 7, "date": 13, "ledger_name": 28, "amount": 14,
        "narration": 32, "Anomaly Type(s)": 24,
        "Audit Finding \u2013 Why Flagged": 58,
    }
    for col_idx, col_name in enumerate(display_cols, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = col_widths.get(col_name, 18)


# ── Main export function ───────────────────────────────────────────────────────
def export(df: pd.DataFrame, output_path: str = None) -> bytes:
    """
    Export flagged GL rows to a styled, audit-ready Excel file.

    Args:
        df          : DataFrame with ALL rows; only scrutiny_flag==True are exported.
        output_path : optional path to save the file.

    Returns:
        bytes \u2014 the .xlsx content
    """
    flagged = df[df["scrutiny_flag"]].copy().reset_index(drop=True)

    if flagged.empty:
        flagged = pd.DataFrame({"Message": ["No transactions flagged for scrutiny."]})
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            flagged.to_excel(writer, sheet_name="Flagged Transactions", index=False)
        buffer.seek(0)
        return buffer.read()

    # ── 1. Add Sr. No. ────────────────────────────────────────────────────────
    flagged.insert(0, "Sr. No.", range(1, len(flagged) + 1))

    # ── 2. Add per-rule flag columns (✓ / blank) ──────────────────────────────
    for rule_label, col_name in zip(RULE_LABELS, RULE_COLUMNS):
        flagged[col_name] = (
            flagged["scrutiny_category"]
            .str.contains(rule_label, regex=False)
            .map({True: "\u2713", False: ""})
        )

    # ── 3. Rename scrutiny columns to audit-friendly names ────────────────────
    flagged = flagged.rename(columns={
        "scrutiny_category": "Anomaly Type(s)",
        "scrutiny_reason":   "Audit Finding \u2013 Why Flagged",
    })

    # ── 4. Column ordering ────────────────────────────────────────────────────
    #   [Sr. No.] [priority GL] [Anomaly Type] [Audit Finding] [R1-R6] [ML] [rest]
    ml_cols   = [c for c in ["ml_anomaly_flag", "ml_anomaly_score"] if c in flagged.columns]
    front     = (["Sr. No."] + [c for c in PRIORITY_GL if c in flagged.columns]
                 + ["Anomaly Type(s)", "Audit Finding \u2013 Why Flagged"]
                 + RULE_COLUMNS + ml_cols)
    remaining = [c for c in flagged.columns
                 if c not in front and c != "scrutiny_flag"]
    final_cols = front + remaining
    final_cols = [c for c in final_cols if c in flagged.columns]
    flagged    = flagged[final_cols]

    # ── 5. Write base Excel ───────────────────────────────────────────────────
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        flagged.to_excel(writer, sheet_name="Flagged Transactions", index=False, startrow=2)

    buffer.seek(0)
    wb = load_workbook(buffer)
    ws = wb["Flagged Transactions"]

    # ── 6. Disclaimer row ─────────────────────────────────────────────────────
    ws.insert_rows(1)
    ws.insert_rows(1)
    d = ws.cell(row=1, column=1, value=DISCLAIMER)
    d.font      = DISCLAIMER_FONT
    d.fill      = DISCLAIMER_FILL
    d.alignment = Alignment(wrap_text=True, vertical="center")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(final_cols))
    ws.row_dimensions[1].height = 38

    # ── 7. Header row (row 3 after two insertions) ────────────────────────────
    header_row = 3
    for col_idx, col_name in enumerate(final_cols, start=1):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.fill      = RULE_HDR_FILL if col_name in RULE_COLUMNS else HEADER_FILL
        cell.font      = GREEN_HDR_FONT if col_name in RULE_COLUMNS else WHITE_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border    = THIN_BORDER
    ws.row_dimensions[header_row].height = 30

    # ── 8. Data rows ──────────────────────────────────────────────────────────
    for row_idx in range(header_row + 1, ws.max_row + 1):
        base_fill = ROW_FILL_ODD if (row_idx % 2 == 0) else ROW_FILL_EVEN
        for col_idx, col_name in enumerate(final_cols, start=1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.border = THIN_BORDER

            if col_name == "Audit Finding \u2013 Why Flagged":
                cell.fill      = REASON_FILL
                cell.font      = REASON_FONT
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            elif col_name == "Anomaly Type(s)":
                cell.fill      = CATEGORY_FILL
                cell.font      = CATEGORY_FONT
                cell.alignment = Alignment(vertical="center", wrap_text=True)
            elif col_name in RULE_COLUMNS:
                cell.fill      = RULE_TICK_FILL if cell.value == "\u2713" else RULE_BLANK_FILL
                cell.font      = RULE_TICK_FONT  if cell.value == "\u2713" else BODY_FONT
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.fill      = base_fill
                cell.font      = BODY_FONT
                cell.alignment = Alignment(vertical="center", wrap_text=False)

        ws.row_dimensions[row_idx].height = 32  # tall enough for wrapped reason text

    # ── 9. Column widths ──────────────────────────────────────────────────────
    fixed_widths = {
        "Sr. No.":                        7,
        "date":                           13,
        "ledger_name":                    28,
        "amount":                         14,
        "narration":                      35,
        "voucher_type":                   16,
        "Anomaly Type(s)":                26,
        "Audit Finding \u2013 Why Flagged": 62,
        "R1: Round No.":                  14,
        "R2: Weekend":                    13,
        "R3: Period-End":                 14,
        "R4: Weak Narr.":                 14,
        "R5: Duplicate":                  13,
        "R6: Manual JV":                  13,
        "ml_anomaly_flag":                16,
        "ml_anomaly_score":               16,
    }
    for col_idx, col_name in enumerate(final_cols, start=1):
        col_letter = get_column_letter(col_idx)
        if col_name in fixed_widths:
            ws.column_dimensions[col_letter].width = fixed_widths[col_name]
        else:
            max_len = max(
                len(str(col_name)),
                *[len(str(ws.cell(row=r, column=col_idx).value or ""))
                  for r in range(header_row, min(ws.max_row + 1, header_row + 50))],
            )
            ws.column_dimensions[col_letter].width = min(max_len + 2, 40)

    ws.freeze_panes = f"A{header_row + 1}"

    # ── 10. Summary sheet (first tab) ─────────────────────────────────────────
    ws_sum = wb.create_sheet(title="Summary")
    _build_summary_sheet(
        ws_sum, df,
        df[df["scrutiny_flag"]].copy() if "scrutiny_flag" in df.columns else flagged
    )
    wb.move_sheet("Summary", offset=-wb.index(ws_sum))

    # ── 11. Rule Breakdown sheet ──────────────────────────────────────────────
    _build_rule_breakdown_sheet(wb, flagged)

    # ── 12. Save ──────────────────────────────────────────────────────────────
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    excel_bytes = out.read()

    if output_path:
        with open(output_path, "wb") as f:
            f.write(excel_bytes)
        print(f"Report saved: {output_path}  ({len(flagged):,} flagged rows)")

    return excel_bytes

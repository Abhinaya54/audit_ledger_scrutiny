# scrutiny/exporter.py
# Excel export helper with layout formatting for readability.
# Preserves incoming DataFrame column names and order as provided.

import io
import pandas as pd
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter


def export(df: pd.DataFrame, output_path: str = None) -> bytes:
    """Export DataFrame to Excel while preserving incoming column names and order."""

    out = df.copy().reset_index(drop=True)

    # Write with a header filter so Excel's built-in search works per column.
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        out.to_excel(writer, index=False, sheet_name="Scrutiny Report")
        ws = writer.sheets["Scrutiny Report"]

        # Header styling for readability.
        header_font = Font(bold=True)
        header_alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        for cell in ws[1]:
            cell.font = header_font
            cell.alignment = header_alignment

        # Slightly taller header row to avoid clipping for wrapped names.
        ws.row_dimensions[1].height = 30

        # Auto-fit each column width from header and cell contents.
        for idx, col_name in enumerate(out.columns, start=1):
            col_letter = get_column_letter(idx)
            max_len = len(str(col_name))

            for value in out.iloc[:, idx - 1]:
                if pd.isna(value):
                    continue
                max_len = max(max_len, len(str(value)))

            # Add breathing room and keep a practical cap for very long text columns.
            ws.column_dimensions[col_letter].width = min(max_len + 2, 60)

        ws.auto_filter.ref = ws.dimensions
        ws.freeze_panes = "A2"
    buf.seek(0)
    result = buf.read()

    if output_path:
        with open(output_path, "wb") as f:
            f.write(result)

    return result

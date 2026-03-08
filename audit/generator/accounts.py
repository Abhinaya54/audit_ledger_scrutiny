# generator/accounts.py
# Chart of accounts for an Indian SME company.
# 50+ accounts across 7 groups — used to populate ledger_name column.

ACCOUNTS = [
    # ── Revenue ───────────────────────────────────────────────────────────────
    "Sales Revenue",
    "Service Income",
    "Interest Income",
    "Dividend Income",
    "Other Operating Income",
    "Export Sales",
    "Domestic Sales",

    # ── Cost of Sales ─────────────────────────────────────────────────────────
    "Cost of Goods Sold",
    "Direct Labour",
    "Freight Inward",
    "Raw Material Consumption",
    "Packing Material Cost",
    "Manufacturing Overhead",

    # ── Operating Expenses ────────────────────────────────────────────────────
    "Rent Expense",
    "Salary Expense",
    "Electricity Expense",
    "Telephone Expense",
    "Internet Expense",
    "Depreciation Expense",
    "Repairs and Maintenance",
    "Marketing and Advertising",
    "Travel and Conveyance",
    "Printing and Stationery",
    "Staff Welfare",
    "Security Charges",
    "Housekeeping Expense",

    # ── Administrative ────────────────────────────────────────────────────────
    "Office Supplies",
    "Legal and Professional Fees",
    "Audit Fees",
    "Insurance Expense",
    "Bank Charges",
    "Subscription and Membership",
    "Courier and Postage",
    "Miscellaneous Expense",

    # ── Assets ────────────────────────────────────────────────────────────────
    "Cash in Hand",
    "Current Account - HDFC",
    "Current Account - SBI",
    "Accounts Receivable",
    "Advance to Suppliers",
    "Inventory - Raw Material",
    "Inventory - Finished Goods",
    "Prepaid Expenses",
    "Security Deposits",
    "Office Equipment",
    "Furniture and Fixtures",
    "Computer Hardware",

    # ── Liabilities ───────────────────────────────────────────────────────────
    "Accounts Payable",
    "Advance from Customers",
    "Salary Payable",
    "GST Payable",
    "TDS Payable",
    "TCS Payable",
    "Loans from Bank",
    "Directors Loan",
    "Accrued Expenses",

    # ── Capital ───────────────────────────────────────────────────────────────
    "Share Capital",
    "Retained Earnings",
    "General Reserve",
    "Capital Reserve",
]

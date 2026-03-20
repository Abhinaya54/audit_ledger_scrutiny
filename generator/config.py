# generator/config.py
# All configurable parameters for the synthetic GL generator.
# Change values here — never hardcode in other files.

CONFIG = {
    # ── Fiscal year ───────────────────────────────────────────────────────────
    "fiscal_year_start": "2024-04-01",
    "fiscal_year_end":   "2025-03-31",

    # ── Dataset size ──────────────────────────────────────────────────────────
    "num_rows":    50000,
    "random_seed": 42,

    # ── Amount distribution (log-normal) ─────────────────────────────────────
    # log_mean=10.5 → average amount ~INR 36,000
    # log_std=1.5   → wide spread from ~100 to multi-lakh
    "amount": {
        "log_mean": 10.5,
        "log_std":  1.5,
        "min":      100,
        "max":      10_000_000,
    },

    # ── Anomaly injection rates ───────────────────────────────────────────────
    # Each rate is the fraction of rows that will trigger the matching rule.
    "injection_rates": {
        "round_amount":       0.15,   # R1 — Round Numbers
        "weekend_posting":    0.05,   # R2 — Weekend Entries
        "period_end_cluster": 0.08,   # R3 — Period End
        "weak_narration":     0.10,   # R4 — Weak Narration
        "duplicate_rows":     0.02,   # R5 — Duplicate Check
        "manual_journal":     0.20,   # R6 — Manual Journal
    },

    # ── Voucher type mix ──────────────────────────────────────────────────────
    "voucher_type_distribution": {
        "Journal": 0.20,
        "Payment": 0.35,
        "Receipt": 0.30,
        "Contra":  0.15,
    },

    # ── Cost centres ──────────────────────────────────────────────────────────
    "cost_centres": [
        "Finance", "Operations", "HR", "Sales", "IT", "Admin", "Procurement",
    ],
}

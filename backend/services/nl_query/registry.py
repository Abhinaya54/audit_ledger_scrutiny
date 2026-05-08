# backend/services/nl_query/registry.py
#
# SINGLE SOURCE OF TRUTH: scrutiny/engine.py RULES dict.
#
# This module reads the existing rules_engine labels from the scrutiny
# engine and enriches them with NL-specific metadata (keywords, thresholds).
# Controls that only exist for NL query purposes (not yet implemented as
# rule functions) are appended as "planned" extensions.

from scrutiny.engine import RULES

# ── NL metadata keyed by the EXACT label from scrutiny/engine.py RULES ──
# These labels MUST match the keys in engine.RULES to stay cohesive.
_NL_METADATA = {
    "Round Numbers": {
        "keywords": ["round number", "round amount", "round figure", "near materiality"],
        "default_threshold": None,
    },
    "Weekend Entries": {
        "keywords": ["weekend", "sunday", "saturday", "weekend entry", "holiday"],
        "default_threshold": None,
    },
    "Period End": {
        "keywords": ["period end", "month end", "year end", "closing entry"],
        "default_threshold": None,
    },
    "Weak Narration": {
        "keywords": [
            "weak narration", "narration quality", "poor narration",
            "generic narration", "short narration", "vague narration",
        ],
        "default_threshold": None,
    },
    "Duplicate Check": {
        "keywords": ["duplicate", "duplicate posting", "duplicate entries", "double posting", "double entry", "repeated entry"],
        "default_threshold": None,
    },
    "Manual Journal": {
        "keywords": [
            "manual journal", "journal entry", "journal voucher",
            "jv", "manual entry", "manual entries", "manual jv",
        ],
        "default_threshold": None,
    },
}

# ── Build CONTROL_REGISTRY from the real engine rules ──
CONTROL_REGISTRY = []
for label in RULES:
    meta = _NL_METADATA.get(label, {"keywords": [], "default_threshold": None})
    CONTROL_REGISTRY.append({
        "id": label,          # Use the engine label as the canonical ID
        "label": label,
        "keywords": meta["keywords"],
        "default_threshold": meta["default_threshold"],
        "has_rule_fn": True,  # This control is backed by a real rule function
    })

# ── Planned controls (NL-only, no rule function yet) ──
# These are exposed for NL query matching but don't have a corresponding
# check_*() function in rules_engine/. They will be promoted to full rules
# when their implementations are added.
_PLANNED_CONTROLS = [
    {
        "id": "High Value Transactions",
        "label": "High Value Transactions",
        "keywords": ["high value", "large transaction", "big amount"],
        "default_threshold": 100_000,
        "has_rule_fn": False,
    },
    {
        "id": "Suspense Account",
        "label": "Suspense Account",
        "keywords": ["suspense", "clearing account", "suspense account"],
        "default_threshold": None,
        "has_rule_fn": False,
    },
    {
        "id": "Tax & TDS Compliance",
        "label": "Tax & TDS Compliance",
        "keywords": ["tax", "tds", "withholding tax", "gst", "vat"],
        "default_threshold": None,
        "has_rule_fn": False,
    },
]

CONTROL_REGISTRY.extend(_PLANNED_CONTROLS)

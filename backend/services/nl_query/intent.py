# backend/services/nl_query/intent.py

from typing import List, Dict
from .registry import CONTROL_REGISTRY

def build_intent(matched_controls: List[str], filters: Dict) -> str:
    """Builds human-readable intent strings."""
    if not matched_controls and not filters:
        return "General scrutiny of flagged anomalies"
        
    parts = []
    
    # Control labels
    control_labels = []
    for ctrl_id in matched_controls:
        registry_ctrl = next((c for c in CONTROL_REGISTRY if c["id"] == ctrl_id), None)
        if registry_ctrl:
            control_labels.append(registry_ctrl["label"])
            
    if control_labels:
        parts.append(f"Filter {', '.join(control_labels)} anomalies")
        
    # Amount filters
    if "amount_min" in filters and "amount_max" in filters:
        parts.append(f"amount between {filters['amount_min']:,.0f} and {filters['amount_max']:,.0f}")
    elif "amount_min" in filters:
        parts.append(f"amount > {filters['amount_min']:,.0f}")
    elif "amount_max" in filters:
        parts.append(f"amount < {filters['amount_max']:,.0f}")
        
    # Voucher types
    if "voucher_types" in filters:
        parts.append(f"for {', '.join(filters['voucher_types'])} vouchers")
        
    # Dates
    if "months" in filters:
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        months_str = ", ".join([month_names[m-1] for m in filters["months"]])
        parts.append(f"in {months_str}")
        
    if "quarters" in filters:
        quarters_str = ", ".join([f"Q{q}" for q in filters["quarters"]])
        parts.append(f"in {quarters_str}")
        
    if not parts:
        return "General scrutiny of flagged anomalies"
        
    # Join parts logically
    res = parts[0]
    if len(parts) > 1:
        res += " and " + " and ".join(parts[1:])
        
    return res

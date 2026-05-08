# backend/services/nl_query/warnings.py

from typing import List, Dict, Optional
from .registry import CONTROL_REGISTRY

def generate_warnings(
    matched_controls: List[str],
    parsed_filters: Dict,
    entity_thresholds: Optional[Dict[str, float]] = None,
) -> List[str]:
    """
    Compares user-requested amount thresholds against the entity's original control thresholds.
    """
    warnings = []
    
    # user_min is what the user is ASKING for (e.g., "above 10,000")
    user_min = parsed_filters.get("amount_min")
    if user_min is None:
        return warnings

    # Check against matched controls
    for ctrl_id in matched_controls:
        # Find in registry to get the label
        registry_ctrl = next((c for c in CONTROL_REGISTRY if c["id"] == ctrl_id), None)
        if not registry_ctrl:
            continue

        threshold = None
        if entity_thresholds and ctrl_id in entity_thresholds:
            threshold = entity_thresholds[ctrl_id]
        else:
            threshold = registry_ctrl.get("default_threshold")
    
        if threshold is not None:
            # If user asks for a filter LOWER than the control threshold, warn them.
            if user_min < threshold:
                warnings.append(
                    f"Warning: Your requested threshold ({user_min:,.0f}) is lower than the "
                    f"{registry_ctrl['label']} control threshold ({threshold:,.0f}). "
                    f"Results will only include records already flagged at the higher threshold."
                )
                
    return warnings

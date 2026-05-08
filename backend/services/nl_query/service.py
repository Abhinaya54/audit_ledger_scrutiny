# backend/services/nl_query/service.py

from typing import Dict, Optional
from .parsers import DeterministicParser, MockLLMParser
from .warnings import generate_warnings
from .intent import build_intent

_det_parser = DeterministicParser()
_llm_parser = MockLLMParser()

def parse_nl_query(
    query: str,
    parser_type: str = "auto",
    entity_thresholds: Optional[Dict[str, float]] = None,
) -> Dict:
    """
    Orchestrates the NL query parsing process.
    """
    det_parser = _det_parser
    llm_parser = _llm_parser
    
    # Selection logic
    if parser_type == "deterministic":
        parse_result = det_parser.parse(query)
    elif parser_type == "llm":
        parse_result = llm_parser.parse(query)
    else: # auto
        # Prefer deterministic
        parse_result = det_parser.parse(query)
        
        # Fallback to LLM if no controls matched and it's not a simple filter query,
        # or if explicit tax/TDS intent is detected.
        query_lower = query.lower()
        if not parse_result.matched_controls:
            if "tax" in query_lower or "tds" in query_lower:
                parse_result = llm_parser.parse(query)
            elif not parse_result.filters:
                # If truly nothing found, let LLM have a go
                parse_result = llm_parser.parse(query)

    # Generate intent and warnings
    intent = build_intent(parse_result.matched_controls, parse_result.filters)
    warnings = generate_warnings(
        parse_result.matched_controls, 
        parse_result.filters, 
        entity_thresholds
    )
    
    return {
        "matched_controls": parse_result.matched_controls,
        "filters": parse_result.filters,
        "intent": intent,
        "assumptions": parse_result.assumptions,
        "rationale": parse_result.rationale,
        "warnings": warnings,
        "parser_used": parse_result.parser_used
    }

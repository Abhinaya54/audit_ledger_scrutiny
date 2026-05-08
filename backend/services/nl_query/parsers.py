# backend/services/nl_query/parsers.py

import re
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from .registry import CONTROL_REGISTRY

@dataclass
class ParseResult:
    matched_controls: List[str] = field(default_factory=list)
    filters: Dict[str, Any] = field(default_factory=dict)
    assumptions: List[str] = field(default_factory=list)
    rationale: str = ""
    parser_used: str = "deterministic"

class BaseParser(ABC):
    @abstractmethod
    def parse(self, query: str) -> ParseResult:
        pass

def parse_amount(text: str) -> Optional[float]:
    """Extracts numeric amounts handling k, lakh, crore, million, etc."""
    text = text.lower().replace(",", "")
    
    # regex for number followed by optional multiplier (with word boundary, no bare 'm')
    match = re.search(r"(\d+(?:\.\d+)?)\s*(k|thousand|lakh|lac|lacs|crore|cr|crores|million|mn)?\b", text)
    if not match:
        return None
    
    val = float(match.group(1))
    multiplier = match.group(2)
    
    if not multiplier:
        # If no multiplier, ensure the number isn't immediately followed by a word
        # (e.g., "3 months" should not be parsed as amount 3)
        remaining = text[match.end():].strip()
        if remaining and re.match(r"^[a-z]", remaining):
            return None
            
    if multiplier in ["k", "thousand"]:
        val *= 1_000
    elif multiplier in ["lakh", "lac", "lacs"]:
        val *= 100_000
    elif multiplier in ["crore", "cr", "crores"]:
        val *= 10_000_000
    elif multiplier in ["million", "mn"]:
        val *= 1_000_000
        
    return val

def parse_range(text: str) -> Dict[str, Optional[float]]:
    """Detects between X and Y, above X, below X, etc."""
    text = text.lower()
    result = {"min": None, "max": None}
    
    # "between X and Y"
    between_match = re.search(r"between\s+(.*?)\s+and\s+(.*)", text)
    if between_match:
        result["min"] = parse_amount(between_match.group(1))
        result["max"] = parse_amount(between_match.group(2))
        return result
    
    # "above X", "more than X", "at least X", "> X"
    above_match = re.search(r"(?:above|more than|at least|>|greater than)\s+([\d\.,\s]*[a-z]*)", text)
    if above_match:
        result["min"] = parse_amount(above_match.group(1))
        return result
        
    # "below X", "less than X", "at most X", "< X"
    below_match = re.search(r"(?:below|less than|at most|<)\s+([\d\.,\s]*[a-z]*)", text)
    if below_match:
        result["max"] = parse_amount(below_match.group(1))
        return result
        
    return result

def parse_voucher_types(text: str) -> List[str]:
    """Extracts mentioned voucher types."""
    types = ["journal", "payment", "receipt", "contra", "sales", "purchase"]
    found = []
    text = text.lower()
    for t in types:
        if t in text:
            found.append(t)
    return found

def parse_dates(text: str) -> Dict[str, List[Any]]:
    """Month names/abbreviations, quarter references."""
    months_map = {
        "jan": 1, "january": 1,
        "feb": 2, "february": 2,
        "mar": 3, "march": 3,
        "apr": 4, "april": 4,
        "may": 5,
        "jun": 6, "june": 6,
        "jul": 7, "july": 7,
        "aug": 8, "august": 8,
        "sep": 9, "september": 9,
        "oct": 10, "october": 10,
        "nov": 11, "november": 11,
        "dec": 12, "december": 12
    }
    
    text = text.lower()
    found_months = []
    for name, val in months_map.items():
        # Match whole word to avoid "mar" matching "market"
        if re.search(rf"\b{name}\b", text):
            if val not in found_months:
                found_months.append(val)
    
    found_quarters = []
    quarter_matches = re.findall(r"(?:q|quarter)\s*([1-4])", text)
    for q in quarter_matches:
        found_quarters.append(int(q))
        
    return {"months": sorted(found_months), "quarters": sorted(found_quarters)}

def match_controls(text: str) -> List[str]:
    """Matches query against CONTROL_REGISTRY keywords."""
    text = text.lower()
    matched = []
    for ctrl in CONTROL_REGISTRY:
        for kw in ctrl["keywords"]:
            if kw in text:
                matched.append(ctrl["id"])
                break
    return matched

class DeterministicParser(BaseParser):
    def parse(self, query: str) -> ParseResult:
        matched = match_controls(query)
        range_info = parse_range(query)
        vouchers = parse_voucher_types(query)
        dates = parse_dates(query)
        
        filters = {}
        if range_info["min"] is not None:
            filters["amount_min"] = range_info["min"]
        if range_info["max"] is not None:
            filters["amount_max"] = range_info["max"]
        if vouchers:
            filters["voucher_types"] = vouchers
        if dates["months"]:
            filters["months"] = dates["months"]
        if dates["quarters"]:
            filters["quarters"] = dates["quarters"]
            
        assumptions = []
        # Add assumptions based on keywords
        if "jv" in query.lower() or "journal" in query.lower():
            assumptions.append("Interpreted 'jv' or 'journal' as Manual Journal control")
            
        rationale = f"Matched {len(matched)} controls based on keywords. "
        if filters:
            rationale += f"Extracted {len(filters)} structured filters."
            
        return ParseResult(
            matched_controls=matched,
            filters=filters,
            assumptions=assumptions,
            rationale=rationale,
            parser_used="deterministic"
        )

class MockLLMParser(BaseParser):
    def parse(self, query: str) -> ParseResult:
        # Mock semantic interpretation
        query_lower = query.lower()
        
        # Fallback logic for TDS/Tax if present in query
        if "tax" in query_lower or "tds" in query_lower:
            return ParseResult(
                matched_controls=["Tax & TDS Compliance"],
                filters={"intent": "tax_compliance_check"},
                assumptions=["Query mentions tax/TDS; using semantic fallback"],
                rationale="Mock LLM detected tax/compliance intent.",
                parser_used="llm"
            )
            
        return ParseResult(
            matched_controls=[],
            filters={},
            assumptions=["Mock LLM did not find specific semantic matches"],
            rationale="Query handled by mock LLM fallback.",
            parser_used="llm"
        )

# backend/schemas/nl_query.py

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal, Any

class NLQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    parser_type: Literal["auto", "deterministic", "llm"] = "auto"
    entity_thresholds: Optional[Dict[str, float]] = None

class NLQueryResponse(BaseModel):
    matched_controls: List[str]
    filters: Dict[str, Any]
    intent: str
    assumptions: List[str]
    rationale: str
    warnings: List[str]
    parser_used: Literal["deterministic", "llm"]

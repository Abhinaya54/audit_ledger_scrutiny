# backend/routers/nl_query.py

from fastapi import APIRouter, HTTPException
from schemas.nl_query import NLQueryRequest, NLQueryResponse
from services.nl_query.service import parse_nl_query

router = APIRouter()

@router.post("/parse", response_model=NLQueryResponse)
async def parse_query(request: NLQueryRequest):
    """
    Accepts a natural language query and returns structured filters and matched controls.
    """
    return parse_nl_query(
        query=request.query,
        parser_type=request.parser_type,
        entity_thresholds=request.entity_thresholds
    )

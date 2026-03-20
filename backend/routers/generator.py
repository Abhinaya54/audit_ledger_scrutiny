from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from schemas.generator import GenerateRequest
from services.generator_service import generate_data, get_cached_csv

router = APIRouter()


@router.post("/generate")
async def generate(req: GenerateRequest):
    result = generate_data(
        start_date=req.start_date,
        end_date=req.end_date,
        num_rows=req.num_rows,
        seed=req.seed,
        inject_r1=req.inject_r1,
        inject_r2=req.inject_r2,
        inject_r3=req.inject_r3,
        inject_r4=req.inject_r4,
        inject_r5=req.inject_r5,
        inject_r6=req.inject_r6,
    )
    return result


@router.get("/download/{token}")
async def download(token: str):
    csv_bytes = get_cached_csv(token)
    if csv_bytes is None:
        raise HTTPException(status_code=404, detail="Download token expired or not found.")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=synthetic_gl.csv"},
    )

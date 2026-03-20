import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

from services.scrutiny_service import save_upload, run_analysis, generate_report
from scrutiny.ingestor import SchemaError

router = APIRouter()


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    use_ml: bool = Form(True),
    contamination: float = Form(0.05),
):
    tmp_path = await save_upload(file)
    try:
        df, result = run_analysis(tmp_path, use_ml, contamination)
        return result
    except SchemaError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        os.unlink(tmp_path)


@router.post("/export")
async def export_report(
    file: UploadFile = File(...),
    use_ml: bool = Form(True),
    contamination: float = Form(0.05),
):
    tmp_path = await save_upload(file)
    try:
        df, _ = run_analysis(tmp_path, use_ml, contamination)
        excel_bytes = generate_report(df)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=scrutiny_report.xlsx"},
        )
    except SchemaError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        os.unlink(tmp_path)

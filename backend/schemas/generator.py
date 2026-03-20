from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    start_date: str
    end_date: str
    num_rows: int = Field(default=50000, ge=1000, le=100000)
    seed: int = Field(default=42, ge=0, le=9999)
    inject_r1: bool = True
    inject_r2: bool = True
    inject_r3: bool = True
    inject_r4: bool = True
    inject_r5: bool = True
    inject_r6: bool = True


class GenerateStats(BaseModel):
    total_rows: int
    amount_mean: float
    round_amounts: int


class GenerateResponse(BaseModel):
    stats: GenerateStats
    preview: list[dict]
    download_token: str

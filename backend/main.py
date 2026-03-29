import sys
import os

# Add parent directory so we can import generator/ and scrutiny/ modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import scrutiny, generator

app = FastAPI(title="Audit Anomaly Detection API", version="1.0.0")

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scrutiny.router, prefix="/api/scrutiny", tags=["Scrutiny"])
app.include_router(generator.router, prefix="/api/generator", tags=["Generator"])

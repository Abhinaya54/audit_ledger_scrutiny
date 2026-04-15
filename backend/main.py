import sys
import os

# Add parent directory so we can import generator/ and scrutiny/ modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import scrutiny, generator, auth

app = FastAPI(title="Audit Anomaly Detection API", version="1.0.0")

# Allow all origins — no cookies/auth used so wildcard is safe
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = _origins_env.split(",") if _origins_env and _origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(scrutiny.router, prefix="/api/scrutiny", tags=["Scrutiny"])
app.include_router(generator.router, prefix="/api/generator", tags=["Generator"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

import sys
import os

# Add backend directory to import local modules when running main.py directly.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Load local environment variables (e.g., MONGO_URI) for development runs.
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import scrutiny, auth, workbooks, clients

app = FastAPI(title="Audit Anomaly Detection API", version="1.0.0")

# Allow all origins — no cookies/auth used so wildcard is safe
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = _origins_env.split(",") if _origins_env and _origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(scrutiny.router, prefix="/api/scrutiny", tags=["Scrutiny"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(workbooks.router, prefix="/api/workbooks", tags=["Workbooks"])
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

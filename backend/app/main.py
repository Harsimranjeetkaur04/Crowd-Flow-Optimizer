import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import limiter, router
from app.database import init_db
from slowapi import _rate_limit_exceeded_handler

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent.parent / ".env")


def _check_required_env_vars() -> None:
    """Check that required environment variables are set. Fail fast on startup."""
    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret:
        print("[WARNING] JWT_SECRET is not explicitly set in .env. Using development default.")
    allowed_origins = os.getenv("ALLOWED_ORIGINS")
    if not allowed_origins:
        print("[INFO] ALLOWED_ORIGINS defaulted to http://localhost:5173.")

_check_required_env_vars()


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(title="Crowd Flow Optimiser API", version="0.1.0")
    origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    return app


app = create_app()

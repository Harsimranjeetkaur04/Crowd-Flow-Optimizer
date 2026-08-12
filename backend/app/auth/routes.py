"""Authentication API endpoints for venue operators."""

from __future__ import annotations

from uuid import uuid4
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.auth.security import create_access_token, decode_access_token, hash_password, verify_password
from app.database import SessionLocal, UserModel


router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory user database store
USER_DB: dict[str, dict] = {}
USER_BY_EMAIL: dict[str, str] = {}


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5)
    password: str = Field(min_length=6)
    name: str = Field(default="Venue Operator")


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest) -> dict:
    email_clean = req.email.strip().lower()
    if email_clean in USER_BY_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )

    user_id = str(uuid4())
    pass_hash = hash_password(req.password)
    user_record = {
        "id": user_id,
        "email": email_clean,
        "name": req.name,
        "password_hash": pass_hash,
    }

    USER_DB[user_id] = user_record
    USER_BY_EMAIL[email_clean] = user_id

    # Persist in DB table
    db = SessionLocal()
    try:
        db_user = UserModel(id=user_id, email=email_clean, name=req.name, password_hash=pass_hash)
        db.add(db_user)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

    token = create_access_token(user_id=user_id, email=email_clean)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": email_clean, "name": req.name},
    }


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest) -> dict:
    email_clean = req.email.strip().lower()
    user_id = USER_BY_EMAIL.get(email_clean)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user = USER_DB[user_id]
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user_id=user_id, email=email_clean)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]},
    }


@router.get("/me")
def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )

    user_id = payload.get("sub")
    user = USER_DB.get(user_id)
    if not user:
        # Fallback for demo token
        return {"id": user_id, "email": payload.get("email"), "name": "Venue Operator"}

    return {"id": user["id"], "email": user["email"], "name": user["name"]}

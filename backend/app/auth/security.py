"""Authentication security utilities: JWT token generation and password hashing."""

from __future__ import annotations

import hashlib
import os
import time
import jwt


SECRET_KEY = os.getenv("JWT_SECRET", "crowdflow-ai-super-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 86400  # 24 hours


def hash_password(password: str) -> str:
    """Hash a password securely using SHA-256 with salt."""
    salt = "crowdflow_salt_"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against stored hash."""
    return hash_password(plain_password) == hashed_password


def create_access_token(user_id: str, email: str) -> str:
    """Create a signed JWT access token."""
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + ACCESS_TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None

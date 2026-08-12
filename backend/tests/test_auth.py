"""Tests for authentication endpoints (register, login, me)."""

from fastapi.testclient import TestClient
from app.main import app


def test_register_login_and_me_flow() -> None:
    client = TestClient(app)

    # 1. Register new operator
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "email": "operator@stadium.com",
            "password": "securepassword123",
            "name": "Stadium Operations Lead",
        },
    )
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert reg_data["access_token"]
    assert reg_data["user"]["email"] == "operator@stadium.com"

    # 2. Login
    login_resp = client.post(
        "/api/auth/login",
        json={
            "email": "operator@stadium.com",
            "password": "securepassword123",
        },
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    token = login_data["access_token"]

    # 3. Get profile with Bearer token
    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "operator@stadium.com"


def test_login_with_wrong_password_fails() -> None:
    client = TestClient(app)
    client.post(
        "/api/auth/register",
        json={"email": "user2@stadium.com", "password": "correctpassword"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": "user2@stadium.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401

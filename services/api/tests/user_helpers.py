"""Helpers for seeding users directly in isolated API tests."""

from datetime import datetime, timezone
from uuid import uuid4

from passlib.hash import bcrypt

from services import create_user


def create_test_user(
    email: str,
    password: str,
    *,
    role: str = "user",
    name: str | None = None,
) -> dict:
    """Create a user without exercising the production account-creation API."""
    user_id = str(uuid4())
    user = {
        "id": user_id,
        "email": email,
        "hashed_password": bcrypt.hash(password),
        "is_active": True,
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    profile = {
        "id": str(uuid4()),
        "user_id": user_id,
        "name": name,
        "phone": None,
        "address": None,
    }
    return create_user(user, profile)

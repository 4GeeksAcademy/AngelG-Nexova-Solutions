import hashlib
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.hash import bcrypt
from pydantic import BaseModel, field_validator

from email_service import send_password_reset_email
from services import (
    consume_reset_token,
    create_reset_token,
    get_profile_by_user_id,
    get_reset_token_by_hash,
    get_user_by_email,
    get_user_by_id,
    invalidate_active_reset_tokens,
    update_user
)


load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES = int(
    os.getenv("PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES", "30")
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

GENERIC_FORGOT_PASSWORD_MESSAGE = (
    "Si esa dirección está registrada, recibirás un enlace "
    "para restablecer tu contraseña."
)


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_REGEX.match(value):
            raise ValueError("Email inválido")

        return value


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")

        return value


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")

        return value


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_frontend_url() -> str:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    codespace_name = os.getenv("CODESPACE_NAME")
    forwarding_domain = os.getenv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN")

    if (
        os.getenv("CODESPACES")
        and frontend_url.startswith("http://localhost")
        and codespace_name
        and forwarding_domain
    ):
        return f"https://{codespace_name}-3000.{forwarding_domain}"

    return frontend_url.rstrip("/")


def create_access_token(user_id: str):
    expiration = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": user_id,
        "exp": expiration
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=ALGORITHM
    )


def get_current_user(
    token: str = Depends(oauth2_scheme)
):
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id or not isinstance(user_id, str):
            raise HTTPException(
                status_code=401,
                detail="Token inválido o expirado"
            )

        user = get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Usuario no válido"
            )

        if not user.get("is_active", True):
            raise HTTPException(
                status_code=401,
                detail="Usuario inactivo"
            )

        return user

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Token inválido o expirado"
        )


@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends()
):
    # Swagger llama "username" al campo.
    # Nosotros usamos ese campo para enviar el email.

    user = get_user_by_email(form.username)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos"
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos"
        )

    try:
        if not bcrypt.verify(
            form.password,
            user["hashed_password"]
        ):
            raise HTTPException(
                status_code=401,
                detail="Email o contraseña incorrectos"
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error al verificar contraseña para usuario %s", user["id"])
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos"
        )

    token = create_access_token(
        user["id"]
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user)
):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "role": current_user["role"],
        "profile": get_profile_by_user_id(
            current_user["id"]
        )
    }


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    user = get_user_by_email(data.email)

    if user:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # Evita user enumeration: nunca revelamos si el email existe.
        invalidate_active_reset_tokens(user["id"], now_iso)

        reset_token = secrets.token_urlsafe(32)

        create_reset_token({
            "id": str(uuid4()),
            "user_id": user["id"],
            "token_hash": hash_reset_token(reset_token),
            "created_at": now_iso,
            "expires_at": (
                now + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES)
            ).isoformat(),
            "used_at": None
        })

        reset_url = f"{get_frontend_url()}/reset-password?token={reset_token}"

        try:
            send_password_reset_email(user["email"], reset_url)
        except Exception:
            logger.exception(
                "Error al enviar email de restablecimiento a %s", user["email"]
            )

    return {"message": GENERIC_FORGOT_PASSWORD_MESSAGE}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    token_hash = hash_reset_token(data.token)
    token_record = get_reset_token_by_hash(token_hash)

    if not token_record:
        raise HTTPException(
            status_code=400,
            detail="Token inválido"
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    if token_record["used_at"] is not None:
        raise HTTPException(
            status_code=400,
            detail="El token ya fue utilizado"
        )

    if token_record["expires_at"] <= now_iso:
        raise HTTPException(
            status_code=400,
            detail="El token expiró"
        )

    user = get_user_by_id(token_record["user_id"])

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Token inválido"
        )

    # Marca el token como usado de forma condicionada (uso único / anti-carrera)
    # antes de tocar la contraseña, para que un intento concurrente no pueda
    # reutilizar el mismo token.
    consumed = consume_reset_token(token_hash, now_iso, now_iso)

    if not consumed:
        raise HTTPException(
            status_code=400,
            detail="El token ya fue utilizado"
        )

    try:
        update_user(
            user["id"],
            {"hashed_password": bcrypt.hash(data.new_password)}
        )
    except Exception:
        logger.exception("Error al actualizar contraseña con reset token para usuario %s", user["id"])
        raise HTTPException(
            status_code=500,
            detail={
                "code": "PASSWORD_UPDATE_FAILED",
                "message": "No se pudo restablecer la contraseña.",
            }
        )

    return {"message": "Contraseña actualizada correctamente"}


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        if not bcrypt.verify(
            data.current_password,
            current_user["hashed_password"]
        ):
            raise HTTPException(
                status_code=400,
                detail="La contraseña actual es incorrecta"
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error al verificar contraseña actual para usuario %s", current_user["id"])
        raise HTTPException(
            status_code=400,
            detail="La contraseña actual es incorrecta"
        )

    try:
        update_user(
            current_user["id"],
            {"hashed_password": bcrypt.hash(data.new_password)}
        )
    except Exception:
        logger.exception("Error al actualizar contraseña para usuario %s", current_user["id"])
        raise HTTPException(
            status_code=500,
            detail={
                "code": "PASSWORD_UPDATE_FAILED",
                "message": "No se pudo actualizar la contraseña.",
            }
        )

    return {"message": "Contraseña actualizada correctamente"}
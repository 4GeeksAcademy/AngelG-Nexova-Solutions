import logging
import secrets
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from passlib.hash import bcrypt
from pydantic import BaseModel, ConfigDict

from auth import get_current_user
from auth import issue_password_reset
from services import (
    create_user,
    delete_user,
    get_all_users,
    get_profile_by_user_id,
    get_user_by_email,
    get_user_by_id,
    update_user
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/users",
    tags=["users"]
)


class Role(str, Enum):
    admin = "admin"
    manager = "manager"
    supervisor = "supervisor"
    user = "user"


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None


class AdminUserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    role: Role
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class UserListItemResponse(BaseModel):
    id: str
    role: Role
    is_active: bool


class UserDetailResponse(UserListItemResponse):
    email: str
    created_at: str


class AdminUserResponse(UserDetailResponse):
    name: str | None = None
    password_setup_email_sent: bool | None = None


class UserProfileResponse(BaseModel):
    id: str
    name: str | None = None
    phone: str | None = None
    address: str | None = None


class UserRegistrationResponse(BaseModel):
    message: str


class UserDeleteResponse(BaseModel):
    message: str


def public_user(user: dict):
    return {
        "id": user["id"],
        "email": user["email"],
        "is_active": user["is_active"],
        "role": user["role"],
        "created_at": user["created_at"]
    }


def owner_or_admin(
    user_id: str,
    current_user: dict
):
    if (
        current_user["id"] != user_id
        and current_user["role"] != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="No tenés permiso"
        )


def require_admin(current_user: dict):
    if current_user.get("role") != Role.admin.value:
        raise HTTPException(status_code=403, detail="Solo un administrador puede gestionar usuarios.")


def ensure_another_admin_remains(target_id: str, changes: dict | None = None):
    target = get_user_by_id(target_id)
    if not target or target.get("role") != Role.admin.value:
        return
    changes = changes or {}
    removes_admin = (
        changes.get("role") not in (None, Role.admin, Role.admin.value)
        or changes.get("is_active") is False
        or changes.get("delete") is True
    )
    if removes_admin and not any(
        user["id"] != target_id
        and user.get("role") == Role.admin.value
        and user.get("is_active", True)
        for user in get_all_users()
    ):
        raise HTTPException(
            status_code=400,
            detail="Debe permanecer al menos un administrador activo.",
        )


@router.post("", response_model=UserRegistrationResponse)
def register(data: UserCreate):

    if get_user_by_email(data.email):
        raise HTTPException(
            status_code=400,
            detail="El email ya está registrado"
        )

    user_id = str(uuid4())

    try:
        hashed_password = bcrypt.hash(data.password)
    except Exception:
        logger.exception("Error al generar hash de contraseña durante registro")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "REGISTRATION_FAILED",
                "message": "No se pudo completar el registro.",
            }
        )

    user = {
        "id": user_id,
        "email": data.email,
        "hashed_password": hashed_password,
        "is_active": True,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    profile = {
        "id": str(uuid4()),
        "user_id": user_id,
        "name": data.name,
        "phone": data.phone,
        "address": data.address
    }

    create_user(
        user,
        profile
    )

    # The client proceeds to login separately; do not echo submitted
    # credentials, email, or profile data in this unauthenticated response.
    return {"message": "Registro completado correctamente."}


@router.get("", response_model=list[AdminUserResponse])
def list_users(
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)
    return [
        AdminUserResponse(
            id=user["id"],
            email=user["email"],
            role=user["role"],
            is_active=user.get("is_active", True),
            created_at=user["created_at"],
            name=(get_profile_by_user_id(user["id"]) or {}).get("name"),
        )
        for user in get_all_users()
    ]


@router.post("/admin", response_model=AdminUserResponse, status_code=201)
def create_managed_user(
    data: AdminUserCreate,
    current_user: dict = Depends(get_current_user),
):
    require_admin(current_user)
    if get_user_by_email(data.email):
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    user_id = str(uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        # The account receives a random undisclosed credential and must use the
        # one-time email link to choose a password.
        "hashed_password": bcrypt.hash(secrets.token_urlsafe(48)),
        "is_active": True,
        "role": data.role.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    profile = {
        "id": str(uuid4()),
        "user_id": user_id,
        "name": data.name,
        "phone": data.phone,
        "address": data.address,
    }
    create_user(user, profile)
    email_sent = issue_password_reset(user)
    return AdminUserResponse(
        id=user_id,
        email=user["email"],
        role=user["role"],
        is_active=user["is_active"],
        created_at=user["created_at"],
        name=profile["name"],
        password_setup_email_sent=email_sent,
    )


@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    owner_or_admin(
        user_id,
        current_user
    )

    user = get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado"
        )

    return public_user(user)


@router.put("/{user_id}", response_model=UserDetailResponse)
def edit_user(
    user_id: str,
    data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)
    if not get_user_by_id(user_id):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    changes = data.model_dump(
        exclude_none=True
    )

    if "email" in changes:
        existing_user = get_user_by_email(
            changes["email"]
        )

        if (
            existing_user
            and existing_user["id"] != user_id
        ):
            raise HTTPException(
                status_code=400,
                detail="El email ya está registrado"
            )

    if "password" in changes:
        try:
            changes["hashed_password"] = bcrypt.hash(
                changes.pop("password")
            )
        except Exception:
            logger.exception("Error al generar hash de contraseña al editar usuario %s", user_id)
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "PASSWORD_UPDATE_FAILED",
                    "message": "No se pudo actualizar la contraseña.",
                }
            )

    if "role" in changes:
        changes["role"] = changes["role"].value

    if user_id == current_user["id"] and changes.get("is_active") is False:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta.")
    ensure_another_admin_remains(user_id, changes)

    user = update_user(
        user_id,
        changes
    )

    return public_user(user)


@router.delete("/{user_id}", response_model=UserDeleteResponse)
def remove_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)

    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")

    if not get_user_by_id(user_id):
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado"
        )

    ensure_another_admin_remains(user_id, {"delete": True})

    delete_user(user_id)

    return {
        "message": "Usuario eliminado"
    }


@router.post("/{user_id}/force-password-reset", response_model=UserDeleteResponse)
def force_password_reset(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    require_admin(current_user)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    try:
        update_user(
            user_id,
            {"hashed_password": bcrypt.hash(secrets.token_urlsafe(48))},
        )
    except Exception:
        logger.exception("Error al invalidar credenciales del usuario %s", user_id)
        raise HTTPException(status_code=500, detail="No se pudo iniciar el cambio de contraseña.")
    if not issue_password_reset(user):
        raise HTTPException(
            status_code=503,
            detail="No se pudo enviar el enlace de cambio de contraseña. Inténtalo de nuevo.",
        )
    return {"message": "Se envió un enlace para establecer una nueva contraseña."}
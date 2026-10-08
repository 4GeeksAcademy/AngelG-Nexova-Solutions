import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from services import (
    get_profile_by_user_id,
    update_profile
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/profiles",
    tags=["profiles"]
)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


@router.get("/me")
def get_my_profile(
    current_user: dict = Depends(get_current_user)
):
    profile = get_profile_by_user_id(
        current_user["id"]
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Perfil no encontrado"
        )

    return profile


@router.put("/me")
def edit_my_profile(
    data: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    changes = data.model_dump(
        exclude_none=True
    )

    try:
        return update_profile(
            current_user["id"],
            changes
        )
    except Exception:
        logger.exception(
            "Error al actualizar perfil del usuario %s", current_user["id"]
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "PROFILE_UPDATE_FAILED",
                "message": "No se pudo actualizar el perfil.",
            }
        )
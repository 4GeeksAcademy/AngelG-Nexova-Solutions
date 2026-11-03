from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from auth import get_current_user
from database import get_db
from telemetry.analysis import TechnicalReport, technical_report

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/report", response_model=TechnicalReport)
def get_report(
    start: datetime | None = None, end: datetime | None = None,
    session: Session = Depends(get_db), user: dict = Depends(get_current_user),
):
    if user.get("role") not in {"admin", "manager", "supervisor"}:
        raise HTTPException(status_code=403, detail="Solo admin, manager o supervisor pueden consultar telemetría técnica.")
    try:
        return technical_report(session, start, end)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from auth import get_current_user
from cache import TELEMETRY_REPORT_PREFIX, report_cache
from database import get_db
from telemetry.analysis import TechnicalReport, technical_report

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/report", response_model=TechnicalReport)
def get_report(
    start: datetime | None = None, end: datetime | None = None,
    session: Session = Depends(get_db), user: dict = Depends(get_current_user),
):
    if user.get("role") not in {"admin", "manager"}:
        raise HTTPException(status_code=403, detail="Solo admin o manager pueden consultar telemetría técnica.")
    try:
        for value in (start, end):
            if value is not None and value.tzinfo is None:
                raise ValueError("Las fechas requieren zona horaria.")
        normalized_start = start.astimezone(timezone.utc) if start is not None else None
        normalized_end = end.astimezone(timezone.utc) if end is not None else None
        if normalized_start is not None and normalized_end is not None and normalized_start >= normalized_end:
            raise ValueError("start debe ser anterior a end.")
        start_key = normalized_start.isoformat() if normalized_start is not None else "<open>"
        end_key = normalized_end.isoformat() if normalized_end is not None else "<open>"
        cache_key = f"{TELEMETRY_REPORT_PREFIX}{start_key}:{end_key}"
        cache_revision = report_cache.revision(TELEMETRY_REPORT_PREFIX)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    except Exception:
        cache_revision = -1
    try:
        cached_report = report_cache.get(cache_key)
    except Exception:
        cached_report = None
    if isinstance(cached_report, TechnicalReport):
        return cached_report
    try:
        report = technical_report(session, normalized_start, normalized_end)
        now = datetime.now(timezone.utc)
        recent_cutoff = now.timestamp() - 15
        is_recent_or_open = (
            normalized_start is None or normalized_end is None
            or normalized_end.timestamp() > recent_cutoff
        )
        ttl_seconds = 15 if is_recent_or_open else 300
        try:
            if cache_revision >= 0:
                report_cache.set_if_revision(
                    cache_key, report, ttl_seconds,
                    TELEMETRY_REPORT_PREFIX, cache_revision,
                )
        except Exception:
            pass
        return report
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None

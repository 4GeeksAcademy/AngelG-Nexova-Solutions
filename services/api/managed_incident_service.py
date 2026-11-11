"""Read-only query operations shared by the incident API and internal agent."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, func, or_
from sqlmodel import Session, select

from incident_models import ManagedIncident


def _matches_search_terms(terms: list[str]):
    columns = (
        ManagedIncident.id,
        ManagedIncident.client_name,
        ManagedIncident.title,
        ManagedIncident.description,
        ManagedIncident.status,
        ManagedIncident.severity,
        ManagedIncident.responsible_area,
        ManagedIncident.assigned_to,
        ManagedIncident.type,
    )

    def normalized_column(column):
        expression = func.lower(func.coalesce(column, ""))
        for accented, plain in (
            ("á", "a"),
            ("é", "e"),
            ("í", "i"),
            ("ó", "o"),
            ("ú", "u"),
            ("ü", "u"),
            ("ñ", "n"),
        ):
            expression = func.replace(expression, accented, plain)
        return expression

    return and_(
        *(
            or_(
                *[
                    normalized_column(column).contains(term, autoescape=True)
                    for column in columns
                ]
            )
            for term in terms
        )
    )


def search_managed_incidents(
    session: Session,
    *,
    terms: list[str],
    status: str | None,
    limit: int,
) -> list[ManagedIncident]:
    """Search active incidents for operational callers, without changing data."""
    statement = select(ManagedIncident).where(ManagedIncident.is_archived.is_(False))
    if status is not None:
        statement = statement.where(ManagedIncident.status == status)
    if terms:
        statement = statement.where(_matches_search_terms(terms))
    statement = statement.order_by(
        ManagedIncident.created_at.desc(), ManagedIncident.id
    ).limit(limit)
    return list(session.exec(statement).all())


def list_managed_incidents(
    session: Session,
    *,
    status: str | None,
    severity: str | None,
    incident_type: str | None,
    responsible_area: str | None,
    overdue_sla: bool | None,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[list[ManagedIncident], int]:
    """List incidents using the managed-incidents API's existing filters."""
    statement = select(ManagedIncident).where(ManagedIncident.is_archived.is_(False))
    for column, value in (
        (ManagedIncident.status, status),
        (ManagedIncident.severity, severity),
        (ManagedIncident.type, incident_type),
        (ManagedIncident.responsible_area, responsible_area),
    ):
        if value is not None:
            statement = statement.where(column == value)

    now = datetime.now(timezone.utc)
    if search and search.strip():
        term = search.strip().lower()
        statement = statement.where(
            or_(
                *[
                    func.lower(func.coalesce(column, "")).contains(
                        term, autoescape=True
                    )
                    for column in (
                        ManagedIncident.id,
                        ManagedIncident.title,
                        ManagedIncident.description,
                        ManagedIncident.client_name,
                        ManagedIncident.assigned_to,
                    )
                ]
            )
        )
    if overdue_sla is True:
        statement = statement.where(
            ManagedIncident.type == "sla_breach",
            ManagedIncident.sla_deadline < now,
            ManagedIncident.status.notin_(["resolved", "closed"]),
        )
    elif overdue_sla is False:
        statement = statement.where(
            (ManagedIncident.type != "sla_breach")
            | (ManagedIncident.sla_deadline >= now)
            | (ManagedIncident.status.in_(["resolved", "closed"]))
        )

    total = session.exec(
        select(func.count()).select_from(statement.subquery())
    ).one()
    items = session.exec(
        statement.order_by(ManagedIncident.created_at.desc(), ManagedIncident.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return list(items), total
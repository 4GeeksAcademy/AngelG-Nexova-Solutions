"""Read-only, bounded tools for the authenticated internal Nexova agent."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, case, func, or_, text
from sqlalchemy.exc import DBAPIError, TimeoutError as SQLAlchemyTimeoutError
from sqlmodel import Session, select

import database
from inventory_models import Item, Movement
from managed_incident_service import search_managed_incidents


logger = logging.getLogger(__name__)

# Bound database work for each tool invocation. PostgreSQL applies this per
# statement; callers never control the timeout or the SQL executed.
AGENT_TOOL_STATEMENT_TIMEOUT_MS = 3_000
MAX_INCIDENT_RESULTS = 5
MAX_INVENTORY_RESULTS = 10
MAX_TOOL_QUERY_LENGTH = 200
IncidentStatusFilter = Literal[
    "open", "assigned", "in_progress", "resolved", "closed", "reopened"
]
_SEARCH_STOP_WORDS = {
    "a", "al", "alguna", "algunas", "algunos", "como", "con", "cual",
    "cuales", "cuanto", "cuantos", "de", "del", "desde", "donde", "el",
    "en", "es", "esta", "estan", "hay", "la", "las", "lo", "los", "me",
    "mi", "mis", "necesito", "para", "por", "que", "quien", "quiero",
    "saber", "se", "sobre", "un", "una", "unas", "unos", "y", "busca",
    "buscar", "muestra", "mostrar", "dame", "dime", "indica", "incidencia",
    "incidencias", "incidente", "incidentes", "ticket", "tickets", "inventario",
    "stock", "existencias", "articulo", "articulos", "producto", "productos",
    "material", "materiales", "unidad", "unidades", "disponible", "disponibles",
    "actual", "actuales", "todas", "todos",
    "abierta", "abiertas", "abierto", "abiertos", "asignada", "asignadas",
    "asignado", "asignados", "resuelta", "resueltas", "resuelto", "resueltos",
    "cerrada", "cerradas", "cerrado", "cerrados", "reabierta", "reabiertas",
    "reabierto", "reabiertos", "pendiente", "pendientes", "en", "curso",
}
_SEARCH_STOP_WORDS.update(
    {
        "abierta", "abiertas", "abierto", "abiertos", "asignada", "asignadas",
        "asignado", "asignados", "resuelta", "resueltas", "resuelto", "resueltos",
        "cerrada", "cerradas", "cerrado", "cerrados", "reabierta", "reabiertas",
        "reabierto", "reabiertos", "pendiente", "pendientes", "curso",
    }
)


def _search_terms(query: str) -> list[str]:
    normalized = query.casefold().translate(str.maketrans("áéíóúüñ", "aeiouun"))
    return [
        term
        for term in re.findall(r"[a-z0-9]+", normalized)
        if term not in _SEARCH_STOP_WORDS and len(term) > 1
    ][:5]


def _matches_search_terms(columns: tuple[object, ...], terms: list[str]):
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


class IncidentToolItem(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    client_name: str | None
    title: str
    description: str
    status: str
    severity: str
    responsible_area: str
    assigned_to: str | None
    sla_deadline: datetime | None


class IncidentToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "invalid_query", "unavailable", "timeout"]
    message: str
    items: list[IncidentToolItem] = Field(default_factory=list)


class InventoryToolItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    sku: str | None
    category: str
    office: str
    unit_of_measure: str
    current_stock: Decimal
    reorder_point: Decimal
    reorder_alert: bool


class InventoryToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "invalid_query", "unavailable", "timeout"]
    message: str
    items: list[InventoryToolItem] = Field(default_factory=list)


def _is_statement_timeout(exc: Exception) -> bool:
    if isinstance(exc, SQLAlchemyTimeoutError):
        return True
    if isinstance(exc, DBAPIError):
        original = exc.orig
        if getattr(original, "sqlstate", None) == "57014":
            return True
        if type(original).__name__ == "OperationalError":
            message = str(original).casefold()
            return any(
                marker in message
                for marker in ("timeout expired", "timed out", "connect timeout")
            )
    return False


def _set_statement_timeout(session: Session) -> None:
    """Set a transaction-local timeout where the active DB supports it."""
    if session.get_bind().dialect.name == "postgresql":
        session.execute(
            text("SELECT set_config('statement_timeout', :timeout, true)"),
            {"timeout": f"{AGENT_TOOL_STATEMENT_TIMEOUT_MS}ms"},
        )


def _incident_error(status: Literal["unavailable", "timeout"]) -> IncidentToolResult:
    if status == "timeout":
        return IncidentToolResult(
            status=status,
            message="La consulta de incidencias tardó demasiado; inténtalo de nuevo.",
        )
    return IncidentToolResult(
        status=status,
        message="La consulta de incidencias no está disponible en este momento.",
    )


def _inventory_error(status: Literal["unavailable", "timeout"]) -> InventoryToolResult:
    if status == "timeout":
        return InventoryToolResult(
            status=status,
            message="La consulta de inventario tardó demasiado; inténtalo de nuevo.",
        )
    return InventoryToolResult(
        status=status,
        message="La consulta de inventario no está disponible en este momento.",
    )


def search_incidents_tool(
    query: str,
    *,
    status: IncidentStatusFilter | None = None,
    limit: int = MAX_INCIDENT_RESULTS,
) -> IncidentToolResult:
    """Search active incidents using a literal term; never writes to storage."""
    raw_query = query.strip() if isinstance(query, str) else ""
    if not raw_query or len(raw_query) > MAX_TOOL_QUERY_LENGTH:
        return IncidentToolResult(
            status="invalid_query",
            message="Indica un término de hasta 200 caracteres para buscar incidencias.",
        )
    terms = _search_terms(raw_query)
    if not terms and status is None:
        return IncidentToolResult(
            status="invalid_query",
            message="Indica un ID, cliente, responsable, área o término de la incidencia.",
        )

    bounded_limit = max(1, min(limit, MAX_INCIDENT_RESULTS))
    if database.engine is None:
        return _incident_error("unavailable")

    try:
        with Session(database.engine) as session:
            _set_statement_timeout(session)
            incidents = search_managed_incidents(
                session,
                terms=terms,
                status=status,
                limit=bounded_limit,
            )
        return IncidentToolResult(
            status="ok",
            message=(
                f"Se encontraron {len(incidents)} incidencias coincidentes."
                if incidents
                else "No se encontraron incidencias coincidentes."
            ),
            items=[IncidentToolItem.model_validate(item) for item in incidents],
        )
    except Exception as exc:
        if _is_statement_timeout(exc):
            return _incident_error("timeout")
        logger.warning("Internal agent incident query failed (%s)", type(exc).__name__)
        return _incident_error("unavailable")


def search_inventory_tool(
    query: str,
    *,
    office: Literal["valencia", "miami"] | None = None,
    limit: int = MAX_INVENTORY_RESULTS,
) -> InventoryToolResult:
    """Search inventory items and derive stock from movement history."""
    raw_query = query.strip() if isinstance(query, str) else ""
    if not raw_query or len(raw_query) > MAX_TOOL_QUERY_LENGTH:
        return InventoryToolResult(
            status="invalid_query",
            message="Indica un término de hasta 200 caracteres para buscar en el inventario.",
        )
    terms = _search_terms(raw_query)
    if not terms and office is not None:
        terms = [office]
    if not terms:
        return InventoryToolResult(
            status="invalid_query",
            message="Indica el nombre, SKU, categoría u oficina del artículo.",
        )

    bounded_limit = max(1, min(limit, MAX_INVENTORY_RESULTS))
    stock_by_item = (
        select(
            Movement.item_id,
            func.sum(
                case(
                    (Movement.movement_type == "outbound", -Movement.quantity),
                    else_=Movement.quantity,
                )
            ).label("current_stock"),
        )
        .group_by(Movement.item_id)
        .subquery()
    )
    statement = (
        select(Item, func.coalesce(stock_by_item.c.current_stock, 0))
        .outerjoin(stock_by_item, stock_by_item.c.item_id == Item.id)
        .where(
            _matches_search_terms(
                (Item.name, Item.sku, Item.category, Item.office), terms
            )
        )
    )
    if office is not None:
        statement = statement.where(Item.office == office)
    statement = statement.order_by(Item.name, Item.id).limit(bounded_limit)

    if database.engine is None:
        return _inventory_error("unavailable")

    try:
        with Session(database.engine) as session:
            _set_statement_timeout(session)
            rows = session.exec(statement).all()
        items = [
            InventoryToolItem(
                id=item.id,
                name=item.name,
                sku=item.sku,
                category=item.category,
                office=item.office,
                unit_of_measure=item.unit_of_measure,
                current_stock=Decimal(stock),
                reorder_point=item.reorder_point,
                reorder_alert=Decimal(stock) <= item.reorder_point,
            )
            for item, stock in rows
        ]
        return InventoryToolResult(
            status="ok",
            message=(
                f"Se encontraron {len(items)} artículos coincidentes."
                if items
                else "No se encontraron artículos coincidentes."
            ),
            items=items,
        )
    except Exception as exc:
        if _is_statement_timeout(exc):
            return _inventory_error("timeout")
        logger.warning("Internal agent inventory query failed (%s)", type(exc).__name__)
        return _inventory_error("unavailable")

"""Seed the canonical Hito 4 inventory and managed-incident dataset.

Run only against an isolated development/test database whose schema has
already been created by the API:
    uv run --directory services/api python seed_hito4.py \
        --confirm-development-database

This command is insert-only. It does not create users, send notifications,
create tables, or modify legacy inventory/incidents.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlmodel import Session, select

import incident_models  # noqa: F401 — register managed incident tables
import inventory_models  # noqa: F401 — register canonical inventory tables
from database import engine
from incident_models import IncidentAuditEvent, ManagedIncident
from inventory_models import Item, Lot, Movement, require_unified_inventory
from seed_inventory import existing_tinydb_user_uuid


_UTC = timezone.utc
_SEED_START = datetime(2026, 10, 1, 9, 0, tzinfo=_UTC)

ITEMS = (
    {
        "office": "valencia",
        "name": 'Portátil de soporte 14"',
        "category": "it_equipment",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("3"),
        "lot_tracked": False,
        "inbound": Decimal("10"),
        "outbound": Decimal("2"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "count_correction",
    },
    {
        "office": "valencia",
        "name": "Auriculares de soporte",
        "category": "it_equipment",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("8"),
        "lot_tracked": False,
        "inbound": Decimal("24"),
        "outbound": Decimal("5"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "damaged",
    },
    {
        "office": "valencia",
        "name": "Cuadernos A4",
        "category": "office_supplies",
        "unit_of_measure": "box",
        "reorder_point": Decimal("5"),
        "lot_tracked": False,
        "inbound": Decimal("20"),
        "outbound": Decimal("3"),
        "adjustment": Decimal("-2"),
        "adjustment_reason": "count_correction",
    },
    {
        "office": "valencia",
        "name": "Credenciales de acceso",
        "category": "office_supplies",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("10"),
        "lot_tracked": False,
        "inbound": Decimal("50"),
        "outbound": Decimal("8"),
        "adjustment": Decimal("-2"),
        "adjustment_reason": "damaged",
    },
    {
        "office": "valencia",
        "name": "Vales de certificación de liderazgo",
        "category": "training_materials",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("2"),
        "lot_tracked": True,
        "inbound": Decimal("12"),
        "outbound": Decimal("4"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "count_correction",
        "lots": (("SEED-H4-VAL-LEAD-2026", None),),
    },
    {
        "office": "valencia",
        "name": "Kit de bienvenida Nexova",
        "category": "branded_merchandise",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("3"),
        "lot_tracked": False,
        "inbound": Decimal("8"),
        "outbound": Decimal("2"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "lost",
    },
    {
        "office": "miami",
        "name": 'Portátil de soporte 14"',
        "category": "it_equipment",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("4"),
        "lot_tracked": False,
        "inbound": Decimal("8"),
        "outbound": Decimal("3"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "count_correction",
    },
    {
        "office": "miami",
        "name": "Auriculares de soporte",
        "category": "it_equipment",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("10"),
        "lot_tracked": False,
        "inbound": Decimal("20"),
        "outbound": Decimal("10"),
        "adjustment": Decimal("-2"),
        "adjustment_reason": "damaged",
    },
    {
        "office": "miami",
        "name": "Material de oficina",
        "category": "office_supplies",
        "unit_of_measure": "box",
        "reorder_point": Decimal("6"),
        "lot_tracked": False,
        "inbound": Decimal("15"),
        "outbound": Decimal("4"),
        "adjustment": Decimal("1"),
        "adjustment_reason": "count_correction",
    },
    {
        "office": "miami",
        "name": "Monitores de oficina",
        "category": "office_supplies",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("3"),
        "lot_tracked": False,
        "inbound": Decimal("5"),
        "outbound": Decimal("2"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "damaged",
    },
    {
        "office": "miami",
        "name": "Vales de examen de certificación",
        "category": "training_materials",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("2"),
        "lot_tracked": True,
        "inbound": Decimal("10"),
        "outbound": Decimal("3"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "count_correction",
        "lots": (
            ("SEED-H4-MIA-CERT-2026", None),
            ("SEED-H4-MIA-CERT-EXPIRED", date(2025, 12, 31)),
        ),
    },
    {
        "office": "miami",
        "name": "Kit de bienvenida Nexova",
        "category": "branded_merchandise",
        "unit_of_measure": "unit",
        "reorder_point": Decimal("2"),
        "lot_tracked": False,
        "inbound": Decimal("7"),
        "outbound": Decimal("2"),
        "adjustment": Decimal("-1"),
        "adjustment_reason": "lost",
    },
)

INCIDENTS = (
    {
        "id": "seed-h4-incident-001",
        "client_name": "Cliente de tecnología",
        "channel": "helpdesk_ticket",
        "type": "sla_breach",
        "severity": "critical",
        "responsible_area": "customer_support",
        "title": "SLA de soporte en riesgo",
        "description": "El backlog del cliente supera el tiempo de respuesta acordado.",
        "assigned_to": "Equipo de soporte",
        "sla_deadline": datetime(2026, 10, 31, 12, 0, tzinfo=_UTC),
        "status_path": ("assigned", "in_progress"),
    },
    {
        "id": "seed-h4-incident-002",
        "client_name": "Cliente de retail",
        "channel": "email",
        "type": "sla_breach",
        "severity": "high",
        "responsible_area": "customer_support",
        "title": "Seguimiento de SLA de retail",
        "description": "La cola de atención requiere seguimiento preventivo.",
        "assigned_to": "Equipo de soporte",
        "sla_deadline": datetime(2026, 11, 2, 12, 0, tzinfo=_UTC),
        "status_path": ("assigned",),
    },
    {
        "id": "seed-h4-incident-003",
        "client_name": "Cliente de servicios financieros",
        "channel": "client_call",
        "type": "client_escalation",
        "severity": "high",
        "responsible_area": "talent_selection",
        "title": "Escalación por proceso de selección",
        "description": "El cliente solicita una actualización del proceso.",
        "assigned_to": "Equipo de selección",
        "sla_deadline": None,
        "status_path": ("assigned", "in_progress"),
    },
    {
        "id": "seed-h4-incident-004",
        "client_name": None,
        "channel": "dashboard",
        "type": "data_issue",
        "severity": "medium",
        "responsible_area": "hr_internal",
        "title": "Corrección de registro interno",
        "description": "Un dato de un registro interno requiere revisión.",
        "assigned_to": None,
        "sla_deadline": None,
        "status_path": (),
    },
    {
        "id": "seed-h4-incident-005",
        "client_name": "Cliente de tecnología",
        "channel": "slack",
        "type": "system_outage",
        "severity": "critical",
        "responsible_area": "technology",
        "title": "Interrupción temporal del helpdesk",
        "description": "El acceso al helpdesk se restableció y se verificó.",
        "assigned_to": "Equipo de Tecnología",
        "sla_deadline": None,
        "status_path": ("assigned", "in_progress", "resolved"),
    },
    {
        "id": "seed-h4-incident-006",
        "client_name": "Cliente de retail",
        "channel": "helpdesk_ticket",
        "type": "staffing_gap",
        "severity": "medium",
        "responsible_area": "customer_support",
        "title": "Cobertura de turno de soporte",
        "description": "Hace falta redistribuir la cobertura de un turno.",
        "assigned_to": "Equipo de soporte",
        "sla_deadline": None,
        "status_path": ("assigned",),
    },
    {
        "id": "seed-h4-incident-007",
        "client_name": None,
        "channel": "email",
        "type": "compliance_flag",
        "severity": "high",
        "responsible_area": "hr_internal",
        "title": "Revisión interna de cumplimiento",
        "description": "Se solicita una revisión interna del procedimiento.",
        "assigned_to": None,
        "sla_deadline": None,
        "status_path": (),
    },
    {
        "id": "seed-h4-incident-008",
        "client_name": "Cliente de formación",
        "channel": "dashboard",
        "type": "data_issue",
        "severity": "low",
        "responsible_area": "corporate_training",
        "title": "Ajuste de inscripción a formación",
        "description": "La inscripción se corrigió y quedó confirmada.",
        "assigned_to": "Equipo de formación",
        "sla_deadline": None,
        "status_path": ("assigned", "in_progress", "resolved", "closed"),
    },
    {
        "id": "seed-h4-incident-009",
        "client_name": "Cliente de servicios financieros",
        "channel": "client_call",
        "type": "sla_breach",
        "severity": "critical",
        "responsible_area": "customer_support",
        "title": "Recurrencia de incidencia SLA",
        "description": "El problema reapareció después de haberse resuelto.",
        "assigned_to": "Equipo de soporte",
        "sla_deadline": datetime(2026, 10, 30, 12, 0, tzinfo=_UTC),
        "status_path": ("assigned", "in_progress", "resolved", "reopened"),
    },
    {
        "id": "seed-h4-incident-010",
        "client_name": "Cliente de tecnología",
        "channel": "email",
        "type": "data_issue",
        "severity": "low",
        "responsible_area": "talent_selection",
        "title": "Duplicado de candidatura",
        "description": "Se detectó un registro duplicado pendiente de revisión.",
        "assigned_to": None,
        "sla_deadline": None,
        "status_path": (),
    },
    {
        "id": "seed-h4-incident-011",
        "client_name": "Cliente de retail",
        "channel": "slack",
        "type": "client_escalation",
        "severity": "medium",
        "responsible_area": "sales",
        "title": "Seguimiento de conversación comercial",
        "description": "El equipo debe confirmar los próximos pasos con el cliente.",
        "assigned_to": "Equipo comercial",
        "sla_deadline": None,
        "status_path": ("assigned", "in_progress"),
    },
    {
        "id": "seed-h4-incident-012",
        "client_name": "Cliente de tecnología",
        "channel": "helpdesk_ticket",
        "type": "sla_breach",
        "severity": "high",
        "responsible_area": "customer_support",
        "title": "SLA vencido con incidencia resuelta",
        "description": "La incidencia se resolvió y conserva el vencimiento histórico.",
        "assigned_to": "Equipo de soporte",
        "sla_deadline": datetime(2026, 10, 29, 12, 0, tzinfo=_UTC),
        "status_path": ("assigned", "in_progress", "resolved"),
    },
)


class SeedDataConflict(RuntimeError):
    """Raised when an existing record conflicts with deterministic seed data."""


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=_UTC)
    return value.astimezone(_UTC)


def _same_datetime(left: datetime | None, right: datetime | None) -> bool:
    return left is None and right is None or (
        left is not None and right is not None and _utc(left) == _utc(right)
    )


def _seed_lots(
    session: Session,
    item: Item,
    lots: tuple[tuple[str, date | None], ...],
    stats: dict[str, Any],
) -> list[Lot]:
    seeded: list[Lot] = []
    for lot_index, (code, expiry_date) in enumerate(lots):
        received_at = _SEED_START + timedelta(minutes=lot_index)
        lot = session.exec(
            select(Lot).where(Lot.item_id == item.id, Lot.lot_code == code)
        ).first()
        if lot is None:
            lot = Lot(
                item_id=item.id,
                lot_code=code,
                expiry_date=expiry_date,
                received_at=received_at,
            )
            session.add(lot)
            session.flush()
            stats["lots_inserted"] += 1
            stats["lots_inserted_codes"].append(code)
        elif lot.expiry_date != expiry_date or not _same_datetime(
            lot.received_at, received_at
        ):
            raise SeedDataConflict(
                f"El lote {code} ya existe con datos distintos; no se modificó."
            )
        else:
            stats["lots_existing"] += 1
            stats["lots_existing_codes"].append(code)
        if expiry_date is None or expiry_date >= _SEED_START.date():
            seeded.append(lot)
    return seeded


def _seed_item_movements(
    session: Session,
    item: Item,
    data: dict[str, Any],
    item_index: int,
    lots: list[Lot],
    stats: dict[str, Any],
) -> Decimal:
    base_time = _SEED_START + timedelta(minutes=item_index * 5)
    lot = lots[0] if lots else None
    expected_movements = (
        ("inbound", data["inbound"], None, base_time),
        ("outbound", data["outbound"], None, base_time + timedelta(minutes=1)),
        (
            "adjustment",
            data["adjustment"],
            data["adjustment_reason"],
            base_time + timedelta(minutes=2),
        ),
    )
    for movement_type, quantity, reason, created_at in expected_movements:
        matches = session.exec(
            select(Movement).where(Movement.item_id == item.id)
        ).all()
        existing = next(
            (
                movement
                for movement in matches
                if _same_datetime(movement.created_at, created_at)
            ),
            None,
        )
        if existing is not None:
            if (
                existing.lot_id != (lot.id if lot else None)
                or existing.movement_type != movement_type
                or existing.quantity != quantity
                or existing.reason != reason
            ):
                raise SeedDataConflict(
                    f"El movimiento reservado para {item.office}/{item.name} "
                    "ya existe con datos distintos; no se modificó."
                )
            stats["movements_existing"] += 1
            stats["movements_existing_keys"].append(
                f"{item.office}/{item.name}/{movement_type}/{created_at.isoformat()}"
            )
            continue
        session.add(
            Movement(
                item_id=item.id,
                lot_id=lot.id if lot else None,
                movement_type=movement_type,
                quantity=quantity,
                reason=reason,
                created_at=created_at,
            )
        )
        stats["movements_inserted"] += 1
        stats["movements_inserted_keys"].append(
            f"{item.office}/{item.name}/{movement_type}/{created_at.isoformat()}"
        )
    session.flush()
    movements = session.exec(
        select(Movement).where(Movement.item_id == item.id)
    ).all()
    stock = Decimal("0")
    for movement in movements:
        if movement.movement_type in {"inbound", "adjustment"}:
            stock += movement.quantity
        else:
            stock -= movement.quantity
    return stock


def _incident_seed_values(
    data: dict[str, Any],
    actor_id: str,
    actor_email: str | None,
    index: int,
) -> tuple[ManagedIncident, list[IncidentAuditEvent]]:
    created_at = _SEED_START + timedelta(hours=index)
    current_status = "open"
    resolved_at = None
    closed_at = None
    updated_at = created_at
    events = [
        IncidentAuditEvent(
            id=f"{data['id']}-event-00",
            incident_id=data["id"],
            change_type="created",
            old_value=None,
            new_value="open",
            occurred_at=created_at,
            actor_id=actor_id,
            actor_email=actor_email,
        )
    ]
    event_index = 1
    event_time = created_at
    if data["assigned_to"] is not None:
        event_time += timedelta(minutes=event_index)
        events.append(
            IncidentAuditEvent(
                id=f"{data['id']}-event-{event_index:02d}",
                incident_id=data["id"],
                change_type="assigned_to",
                old_value=None,
                new_value=data["assigned_to"],
                occurred_at=event_time,
                actor_id=actor_id,
                actor_email=actor_email,
            )
        )
        event_index += 1
    for next_status in data["status_path"]:
        event_time += timedelta(minutes=1)
        old_status = current_status
        current_status = next_status
        if current_status == "resolved":
            resolved_at = event_time
        elif current_status == "closed":
            closed_at = event_time
        events.append(
            IncidentAuditEvent(
                id=f"{data['id']}-event-{event_index:02d}",
                incident_id=data["id"],
                change_type="status",
                old_value=old_status,
                new_value=current_status,
                occurred_at=event_time,
                actor_id=actor_id,
                actor_email=actor_email,
            )
        )
        event_index += 1
    updated_at = event_time
    incident = ManagedIncident(
        id=data["id"],
        client_name=data["client_name"],
        channel=data["channel"],
        type=data["type"],
        severity=data["severity"],
        responsible_area=data["responsible_area"],
        title=data["title"],
        description=data["description"],
        status=current_status,
        assigned_to=data["assigned_to"],
        sla_deadline=data["sla_deadline"],
        resolved_at=resolved_at,
        closed_at=closed_at,
        created_at=created_at,
        updated_at=updated_at,
        is_archived=False,
    )
    return incident, events


def _incident_matches(existing: ManagedIncident, expected: ManagedIncident) -> bool:
    fields = (
        "id",
        "client_name",
        "channel",
        "type",
        "severity",
        "responsible_area",
        "title",
        "description",
        "status",
        "assigned_to",
        "is_archived",
    )
    if any(getattr(existing, field) != getattr(expected, field) for field in fields):
        return False
    datetime_fields = (
        "sla_deadline",
        "resolved_at",
        "closed_at",
        "created_at",
        "updated_at",
    )
    return all(
        _same_datetime(getattr(existing, field), getattr(expected, field))
        for field in datetime_fields
    )


def _audit_matches(
    existing: IncidentAuditEvent, expected: IncidentAuditEvent
) -> bool:
    return (
        existing.id == expected.id
        and existing.incident_id == expected.incident_id
        and existing.change_type == expected.change_type
        and existing.old_value == expected.old_value
        and existing.new_value == expected.new_value
        and existing.actor_id == expected.actor_id
        and existing.actor_email == expected.actor_email
        and _same_datetime(existing.occurred_at, expected.occurred_at)
    )


def seed_hito4(
    session: Session, actor_id: str, actor_email: str | None = None
) -> dict[str, Any]:
    """Insert missing canonical seed rows and report deterministic outcomes."""
    if not actor_id:
        raise ValueError("actor_id must belong to an existing user")

    stats: dict[str, Any] = {
        "items_inserted": 0,
        "items_existing": 0,
        "items_inserted_keys": [],
        "items_existing_keys": [],
        "lots_inserted": 0,
        "lots_existing": 0,
        "lots_inserted_codes": [],
        "lots_existing_codes": [],
        "movements_inserted": 0,
        "movements_existing": 0,
        "movements_inserted_keys": [],
        "movements_existing_keys": [],
        "incidents_inserted": 0,
        "incidents_existing": 0,
        "incidents_inserted_ids": [],
        "incidents_existing_ids": [],
        "audit_events_inserted": 0,
        "audit_events_existing": 0,
        "audit_events_inserted_ids": [],
        "audit_events_existing_ids": [],
        "stock": {},
    }

    with session.begin():
        if session.get_bind().dialect.name == "postgresql":
            session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_key)"),
                {"lock_key": 731_204_204},
            )

        for item_index, data in enumerate(ITEMS):
            matching_items = session.exec(
                select(Item).where(
                    Item.office == data["office"],
                    Item.name == data["name"],
                )
            ).all()
            if len(matching_items) > 1:
                raise SeedDataConflict(
                    f"Hay varios artículos para {data['office']}/{data['name']}."
                )
            item = matching_items[0] if matching_items else None
            item_values = {
                key: data[key]
                for key in (
                    "office",
                    "name",
                    "category",
                    "unit_of_measure",
                    "reorder_point",
                    "lot_tracked",
                )
            }
            if item is None:
                item = Item(
                    **item_values,
                    created_at=_SEED_START,
                    updated_at=_SEED_START,
                )
                session.add(item)
                session.flush()
                stats["items_inserted"] += 1
                stats["items_inserted_keys"].append(
                    f"{item.office}/{item.name}"
                )
            elif any(
                getattr(item, field) != value
                for field, value in item_values.items()
            ):
                raise SeedDataConflict(
                    f"El artículo {data['office']}/{data['name']} ya existe "
                    "con datos distintos; no se modificó."
                )
            else:
                stats["items_existing"] += 1
                stats["items_existing_keys"].append(
                    f"{item.office}/{item.name}"
                )

            lots = _seed_lots(session, item, data.get("lots", ()), stats)
            if item.lot_tracked and not lots:
                raise SeedDataConflict(
                    f"Falta un lote vigente para {data['office']}/{data['name']}."
                )
            current_stock = _seed_item_movements(
                session, item, data, item_index, lots, stats
            )
            if current_stock < 0:
                raise SeedDataConflict(
                    f"El seed produciría stock negativo para {item.office}/{item.name}."
                )
            stats["stock"][f"{item.office}/{item.name}"] = {
                "current_stock": current_stock,
                "reorder_point": item.reorder_point,
                "reorder_alert": current_stock <= item.reorder_point,
            }

        for index, data in enumerate(INCIDENTS, start=1):
            incident, audit_events = _incident_seed_values(
                data, actor_id, actor_email, index
            )
            existing_incident = session.get(ManagedIncident, incident.id)
            if existing_incident is None:
                session.add(incident)
                stats["incidents_inserted"] += 1
                stats["incidents_inserted_ids"].append(incident.id)
            elif _incident_matches(existing_incident, incident):
                stats["incidents_existing"] += 1
                stats["incidents_existing_ids"].append(incident.id)
            else:
                raise SeedDataConflict(
                    f"La incidencia {incident.id} ya existe con datos distintos."
                )

            for expected_event in audit_events:
                existing_event = session.get(IncidentAuditEvent, expected_event.id)
                if existing_event is None:
                    session.add(expected_event)
                    stats["audit_events_inserted"] += 1
                    stats["audit_events_inserted_ids"].append(expected_event.id)
                elif _audit_matches(existing_event, expected_event):
                    stats["audit_events_existing"] += 1
                    stats["audit_events_existing_ids"].append(expected_event.id)
                else:
                    raise SeedDataConflict(
                        f"El evento {expected_event.id} ya existe con datos distintos."
                    )

        session.flush()
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm-development-database",
        action="store_true",
        required=True,
        help="confirma que DATABASE_URL apunta a una base aislada de desarrollo/pruebas",
    )
    parser.parse_args()
    if engine is None:
        raise SystemExit(
            "DATABASE_URL no está configurada; no se realizó ninguna escritura."
        )

    require_unified_inventory(engine)
    actor_id = existing_tinydb_user_uuid()
    with Session(engine) as session:
        stats = seed_hito4(session, actor_id)

    print(
        "Seed Hito 4 completado. "
        f"artículos={stats['items_inserted']} nuevos/"
        f"{stats['items_existing']} existentes; "
        f"lotes={stats['lots_inserted']} nuevos/{stats['lots_existing']} existentes; "
        f"movimientos={stats['movements_inserted']} nuevos/"
        f"{stats['movements_existing']} existentes; "
        f"incidencias={stats['incidents_inserted']} nuevas/"
        f"{stats['incidents_existing']} existentes; "
        f"eventos de auditoría={stats['audit_events_inserted']} nuevos/"
        f"{stats['audit_events_existing']} existentes."
    )
    print(
        "Elementos nuevos/existentes: "
        f"artículos={stats['items_inserted_keys']}/{stats['items_existing_keys']}; "
        f"lotes={stats['lots_inserted_codes']}/{stats['lots_existing_codes']}; "
        f"movimientos={stats['movements_inserted_keys']}/"
        f"{stats['movements_existing_keys']}; "
        f"incidencias={stats['incidents_inserted_ids']}/"
        f"{stats['incidents_existing_ids']}."
    )
    for key, stock in stats["stock"].items():
        print(
            f"  {key}: stock={stock['current_stock']}, "
            f"reorden={stock['reorder_point']}, alerta={stock['reorder_alert']}"
        )


if __name__ == "__main__":
    main()

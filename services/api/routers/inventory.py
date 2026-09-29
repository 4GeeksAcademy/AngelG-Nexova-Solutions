from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from sqlmodel import Session, select

from auth import get_current_user
from database import get_db
from models import Asset, AssetEntry, AssetExit
from schemas import (
    AssetCreate,
    AssetEntryCreate,
    AssetEntryResponse,
    AssetExitCreate,
    AssetExitResponse,
    AssetOrderProduct,
    AssetResponse,
    InventoryOrderResponse,
)


router = APIRouter(prefix="/inventory", tags=["inventory"])


def _stock_expression():
    """Build grouped sums so product listings do not issue per-asset queries."""
    entry_totals = (
        select(
            AssetEntry.asset_id.label("asset_id"),
            func.sum(AssetEntry.quantity).label("quantity"),
        )
        .group_by(AssetEntry.asset_id)
        .subquery()
    )
    exit_totals = (
        select(
            AssetExit.asset_id.label("asset_id"),
            func.sum(AssetExit.quantity).label("quantity"),
        )
        .group_by(AssetExit.asset_id)
        .subquery()
    )
    stock = (
        func.coalesce(entry_totals.c.quantity, 0)
        - func.coalesce(exit_totals.c.quantity, 0)
    ).label("current_stock")
    return entry_totals, exit_totals, stock


def _asset_response(asset: Asset, current_stock: int) -> AssetResponse:
    return AssetResponse.model_validate(
        {
            "id": asset.id,
            "name": asset.name,
            "sku": asset.sku,
            "category": asset.category,
            "office": asset.office,
            "current_stock": current_stock,
        }
    )


def _entry_response(order: AssetEntry) -> AssetEntryResponse:
    """Map a persisted inbound ORM row to its public response schema."""
    return AssetEntryResponse.model_validate(order)


def _exit_response(order: AssetExit) -> AssetExitResponse:
    """Map a persisted outbound ORM row to its public response schema."""
    return AssetExitResponse.model_validate(order)


def _current_stock(session: Session, asset_id: int) -> int:
    entries = session.exec(
        select(func.coalesce(func.sum(AssetEntry.quantity), 0)).where(
            AssetEntry.asset_id == asset_id
        )
    ).one()
    exits = session.exec(
        select(func.coalesce(func.sum(AssetExit.quantity), 0)).where(
            AssetExit.asset_id == asset_id
        )
    ).one()
    return int(entries - exits)


def _user_uuid(current_user: dict) -> str:
    user_uuid = current_user.get("id")
    if not isinstance(user_uuid, str) or not user_uuid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El usuario autenticado no tiene un UUID válido.",
        )
    return user_uuid


def _commit_or_raise_integrity_error(session: Session) -> None:
    """Rollback and expose a safe, appropriately classified integrity error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        original = error.orig
        sqlstate = getattr(original, "sqlstate", None) or getattr(
            original, "pgcode", None
        )
        sqlite_error = getattr(original, "sqlite_errorname", "")
        message = str(original).lower()

        if (
            sqlstate == "23505"
            or sqlite_error
            in {"SQLITE_CONSTRAINT_UNIQUE", "SQLITE_CONSTRAINT_PRIMARYKEY"}
            or "unique constraint failed" in message
            or "duplicate key" in message
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un registro con esos datos únicos.",
            ) from None

        if (
            sqlstate == "23503"
            or sqlite_error == "SQLITE_CONSTRAINT_FOREIGNKEY"
            or "foreign key constraint failed" in message
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El producto referenciado no existe.",
            ) from None

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo guardar el registro por un conflicto de integridad.",
        ) from None


@router.get("/products", response_model=list[AssetResponse])
def list_products(session: Session = Depends(get_db)):
    entry_totals, exit_totals, stock = _stock_expression()
    statement = (
        select(Asset, stock)
        .outerjoin(entry_totals, entry_totals.c.asset_id == Asset.id)
        .outerjoin(exit_totals, exit_totals.c.asset_id == Asset.id)
        .order_by(Asset.id)
    )
    return [
        _asset_response(asset, current_stock)
        for asset, current_stock in session.exec(statement).all()
    ]


@router.post(
    "/products",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    payload: AssetCreate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    del current_user  # Authentication is required; products have no user field.
    asset = Asset(**payload.model_dump())
    session.add(asset)
    _commit_or_raise_integrity_error(session)
    session.refresh(asset)
    return _asset_response(asset, 0)


@router.get("/products/{id}", response_model=AssetResponse)
def get_product(id: int, session: Session = Depends(get_db)):
    asset = session.get(Asset, id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return _asset_response(asset, _current_stock(session, id))


@router.post(
    "/orders/inbound",
    response_model=AssetEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inbound_order(
    payload: AssetEntryCreate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if session.get(Asset, payload.asset_id) is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    order = AssetEntry(
        **payload.model_dump(),
        user_uuid=_user_uuid(current_user),
    )
    session.add(order)
    _commit_or_raise_integrity_error(session)
    session.refresh(order)
    return _entry_response(order)


@router.post(
    "/orders/outbound",
    response_model=AssetExitResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_outbound_order(
    payload: AssetExitCreate,
    session: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Lock the asset row so concurrent outbound orders for this asset serialize
    # on databases that support SELECT FOR UPDATE (including PostgreSQL).
    asset = session.exec(
        select(Asset)
        .where(Asset.id == payload.asset_id)
        .with_for_update()
    ).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    available = _current_stock(session, payload.asset_id)
    if payload.quantity > available:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient stock for asset '{asset.name}'. "
                f"Available: {available}, requested: {payload.quantity}."
            ),
        )

    order = AssetExit(
        **payload.model_dump(),
        user_uuid=_user_uuid(current_user),
    )
    session.add(order)
    _commit_or_raise_integrity_error(session)
    session.refresh(order)
    return _exit_response(order)


@router.get("/orders", response_model=list[InventoryOrderResponse])
def list_orders(session: Session = Depends(get_db)):
    # joinedload fetches the many-to-one Asset in the same query, avoiding N+1.
    inbound: Sequence[AssetEntry] = session.exec(
        select(AssetEntry)
        .options(joinedload(AssetEntry.asset))
        .order_by(AssetEntry.created_at.desc(), AssetEntry.id.desc())
    ).all()
    outbound: Sequence[AssetExit] = session.exec(
        select(AssetExit)
        .options(joinedload(AssetExit.asset))
        .order_by(AssetExit.created_at.desc(), AssetExit.id.desc())
    ).all()

    orders = [
        InventoryOrderResponse(
            id=order.id,
            order_type="inbound",
            asset_id=order.asset_id,
            quantity=order.quantity,
            office=order.office,
            created_at=order.created_at,
            user_uuid=order.user_uuid,
            supplier=order.supplier,
            asset=AssetOrderProduct.model_validate(order.asset),
        )
        for order in inbound
    ] + [
        InventoryOrderResponse(
            id=order.id,
            order_type="outbound",
            asset_id=order.asset_id,
            quantity=order.quantity,
            office=order.office,
            created_at=order.created_at,
            user_uuid=order.user_uuid,
            exit_type=order.exit_type,
            assigned_to=order.assigned_to,
            asset=AssetOrderProduct.model_validate(order.asset),
        )
        for order in outbound
    ]
    return sorted(orders, key=lambda order: (order.created_at, order.id), reverse=True)

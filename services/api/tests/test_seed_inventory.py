from sqlmodel import Session, SQLModel, create_engine, select

import models  # noqa: F401 — register inventory tables
from models import Asset, AssetEntry, AssetExit
from seed_inventory import ASSETS, seed_inventory


def test_inventory_seed_is_idempotent_and_calculates_expected_stock():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        first_run = seed_inventory(session, "existing-tinydb-user-id")
        second_run = seed_inventory(session, "existing-tinydb-user-id")

        assert first_run["products_inserted"] == 6
        assert first_run["inbound_inserted"] == 4
        assert first_run["outbound_inserted"] == 3
        assert second_run["products_inserted"] == 0
        assert second_run["inbound_inserted"] == 0
        assert second_run["outbound_inserted"] == 0
        assert second_run["products_existing"] == 6
        assert second_run["inbound_existing"] == 4
        assert second_run["outbound_existing"] == 3

        products = session.exec(select(Asset)).all()
        entries = session.exec(select(AssetEntry)).all()
        exits = session.exec(select(AssetExit)).all()
        assert len(products) == len(ASSETS)
        assert len(entries) == 4
        assert len(exits) == 3
        assert {order.user_uuid for order in entries + exits} == {
            "existing-tinydb-user-id"
        }

        assert second_run["stock"] == {
            "NXV-IT-001": {"entries": 15, "exits": 2, "current_stock": 13},
            "NXV-IT-002": {"entries": 0, "exits": 0, "current_stock": 0},
            "NXV-PER-001": {"entries": 6, "exits": 1, "current_stock": 5},
            "NXV-PER-002": {"entries": 0, "exits": 0, "current_stock": 0},
            "NXV-OFF-001": {"entries": 20, "exits": 3, "current_stock": 17},
            "NXV-TRN-001": {"entries": 0, "exits": 0, "current_stock": 0},
        }

    engine.dispose()

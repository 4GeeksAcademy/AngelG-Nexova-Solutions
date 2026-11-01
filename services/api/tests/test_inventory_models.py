from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from sqlmodel import SQLModel, create_engine

import inventory_models  # noqa: F401


def test_inventory_has_only_one_storage_with_real_foreign_keys():
    test_engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(test_engine)

    inspector = inspect(test_engine)
    table_names = set(inspector.get_table_names())

    assert {"inventory_item", "inventory_lot", "inventory_movement"} <= table_names
    assert not {"asset", "assetentry", "assetexit"} & table_names
    assert inspector.get_pk_constraint("inventory_item")["constrained_columns"] == ["id"]
    assert any(index["unique"] for index in inspector.get_indexes("inventory_item"))
    assert any(fk["referred_table"] == "inventory_item" for fk in inspector.get_foreign_keys("inventory_movement"))
    assert inspector.get_foreign_keys("inventory_lot")[0]["referred_table"] == "inventory_item"
    assert "user" not in table_names
    assert "current_stock" not in SQLModel.metadata.tables["inventory_item"].columns

    test_engine.dispose()


def test_postgresql_inventory_ddl_contains_real_asset_foreign_keys():
    entry_ddl = str(
        CreateTable(SQLModel.metadata.tables["inventory_movement"]).compile(
            dialect=postgresql.dialect()
        )
    )
    exit_ddl = str(
        CreateTable(SQLModel.metadata.tables["inventory_lot"]).compile(
            dialect=postgresql.dialect()
        )
    )

    assert "FOREIGN KEY(item_id) REFERENCES inventory_item (id)" in entry_ddl
    assert "FOREIGN KEY(item_id) REFERENCES inventory_item (id)" in exit_ddl
    assert "current_stock" not in str(
        CreateTable(SQLModel.metadata.tables["inventory_item"]).compile(
            dialect=postgresql.dialect()
        )
    )

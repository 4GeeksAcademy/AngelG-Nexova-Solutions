from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from sqlmodel import SQLModel, create_engine

import models  # noqa: F401 — registers inventory tables in metadata


def test_inventory_tables_create_with_asset_foreign_keys():
    test_engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(test_engine)

    inspector = inspect(test_engine)
    table_names = set(inspector.get_table_names())

    assert {"asset", "assetentry", "assetexit"} <= table_names
    assert inspector.get_pk_constraint("asset")["constrained_columns"] == ["id"]
    assert any(index["unique"] for index in inspector.get_indexes("asset"))
    assert inspector.get_foreign_keys("assetentry")[0]["constrained_columns"] == [
        "asset_id"
    ]
    assert inspector.get_foreign_keys("assetentry")[0]["referred_table"] == "asset"
    assert inspector.get_foreign_keys("assetexit")[0]["constrained_columns"] == [
        "asset_id"
    ]
    assert inspector.get_foreign_keys("assetexit")[0]["referred_table"] == "asset"
    assert "user" not in table_names
    assert "current_stock" not in SQLModel.metadata.tables["asset"].columns

    test_engine.dispose()


def test_postgresql_inventory_ddl_contains_real_asset_foreign_keys():
    entry_ddl = str(
        CreateTable(SQLModel.metadata.tables["assetentry"]).compile(
            dialect=postgresql.dialect()
        )
    )
    exit_ddl = str(
        CreateTable(SQLModel.metadata.tables["assetexit"]).compile(
            dialect=postgresql.dialect()
        )
    )

    assert "FOREIGN KEY(asset_id) REFERENCES asset (id)" in entry_ddl
    assert "FOREIGN KEY(asset_id) REFERENCES asset (id)" in exit_ddl
    assert "current_stock" not in str(
        CreateTable(SQLModel.metadata.tables["asset"]).compile(
            dialect=postgresql.dialect()
        )
    )

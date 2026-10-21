import os
from pathlib import Path
from typing import Annotated, Generator

from dotenv import load_dotenv
from fastapi import Depends
from sqlmodel import Session, create_engine
from tinydb import TinyDB

"""
Uses a JSON file stored in the `data/` directory that survives restarts.
The path is resolved relative to this file, so it works regardless of
the working directory from which the application is launched.
"""

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    # The API and TinyDB remain usable without PostgreSQL configuration.
    engine = None


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

DB_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DB_DIR / "db.json"

DB_DIR.mkdir(parents=True, exist_ok=True)
db = TinyDB(DB_PATH)

users_table = db.table("users")
profiles_table = db.table("profiles")
password_reset_tokens_table = db.table("password_reset_tokens")
records_table = db.table("records")
notes_table = db.table("notes")
incidents_table = db.table("incidents")


def get_db() -> Generator[Session, None, None]:
    """Provide a PostgreSQL session for one request and close it afterward."""
    if engine is None:
        raise RuntimeError(
            "DATABASE_URL must be set to use the PostgreSQL inventory database."
        )

    with Session(engine) as session:
        yield session


DatabaseSession = Annotated[Session, Depends(get_db)]

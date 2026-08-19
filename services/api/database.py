"""
database.py — TinyDB initialization for Nexova Suppliers API.

Uses a JSON file stored in the `data/` directory that survives restarts.
The path is resolved relative to this file, so it works regardless of
the working directory from which the application is launched.
"""

from pathlib import Path
from tinydb import TinyDB

DB_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DB_DIR / "db.json"


def get_db() -> TinyDB:
    """Return a TinyDB instance backed by db.json in the data/ directory."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    return TinyDB(str(DB_PATH))
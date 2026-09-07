import os
import sys
from pathlib import Path

import pytest


API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))

# Deben fijarse antes de importar los módulos de la app (leen os.getenv al importarse).
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES", "30")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("RESEND_API_KEY", "test-key")
os.environ.setdefault("RESEND_FROM_EMAIL", "test@example.com")

import database  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_db():
    # Los tests corren contra el TinyDB real del proyecto, así que respaldamos
    # y restauramos su contenido para no perder los datos semilla.
    db_path = API_DIR / "data" / "db.json"
    original_content = db_path.read_text() if db_path.exists() else None

    database.users_table.truncate()
    database.profiles_table.truncate()
    database.password_reset_tokens_table.truncate()
    database.incidents_table.truncate()

    yield

    database.users_table.truncate()
    database.profiles_table.truncate()
    database.password_reset_tokens_table.truncate()
    database.incidents_table.truncate()

    if original_content is not None:
        db_path.write_text(original_content)


#!/usr/bin/env python
"""
seed_admin.py — Crea el superadministrador con identificador «admin» (sin @).

Uso:
    cd services/api
    ./.venv/bin/python -B seed_admin.py

Se salta la validación de email porque este usuario inicia sesión con el
identificador «admin» en lugar de un email real. Es un caso único y deliberado.

El script es idempotente: si el usuario «admin» ya existe, solo informa.
La contraseña se puede cambiar después desde «Forzar cambio de contraseña»
en el panel de administración de usuarios.
"""

from __future__ import annotations

from datetime import datetime, timezone
from getpass import getpass
import sys
from uuid import uuid4

from passlib.hash import bcrypt

# Asegura que los imports relativos al proyecto funcionen.
sys.path.insert(0, ".")

from services import create_user, get_user_by_email


ADMIN_EMAIL = "admin"
PASSWORD_MIN_LENGTH = 16

# ────────────────────────────────────────────────────────────────────────


def main() -> None:
    existing = get_user_by_email(ADMIN_EMAIL)
    if existing:
        print(
            f"El usuario «{ADMIN_EMAIL}» ya existe "
            f"(id={existing['id']}, rol={existing['role']})."
        )
        print("Nada que hacer. Puedes iniciar sesión con la contraseña que ya tenga.")
        return

    password = getpass("Contraseña inicial del administrador (mínimo 16 caracteres): ")
    if len(password) < PASSWORD_MIN_LENGTH:
        raise SystemExit(
            f"La contraseña debe tener al menos {PASSWORD_MIN_LENGTH} caracteres."
        )
    confirmation = getpass("Confirma la contraseña: ")
    if password != confirmation:
        raise SystemExit("Las contraseñas no coinciden.")

    user_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    user = {
        "id": user_id,
        "email": ADMIN_EMAIL,
        "hashed_password": bcrypt.hash(password),
        "is_active": True,
        "role": "admin",
        "created_at": now,
    }
    profile = {
        "id": str(uuid4()),
        "user_id": user_id,
        "name": "Super Administrador",
        "phone": None,
        "address": None,
    }

    create_user(user, profile)

    print("✅ Superadministrador creado con éxito.")
    print()
    print(f"   Identificador: {ADMIN_EMAIL}")
    print("   Contraseña:    (configurada de forma interactiva; no se muestra)")
    print()
    print("⚠  CAMBIA LA CONTRASEÑA NADA MÁS ENTRAR:")
    print("   Perfil → Cambiar contraseña (lo ve cualquier usuario autenticado).")
    print()


if __name__ == "__main__":
    main()
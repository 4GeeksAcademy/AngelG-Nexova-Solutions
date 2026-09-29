# API

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

- `JWT_SECRET`: secreto usado para firmar los tokens de acceso.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: minutos de validez del token de acceso (default `30`).
- `PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES`: minutos de validez del token de restablecimiento de contraseña (default `30`).
- `FRONTEND_URL`: URL base del frontend, usada para construir el enlace de restablecimiento de contraseña.
- `RESEND_API_KEY`: API key de [Resend](https://resend.com) usada para enviar emails. No se debe hardcodear ni commitear.
- `RESEND_FROM_EMAIL`: dirección remitente usada al enviar emails con Resend.
- `DATABASE_URL`: URL de conexión PostgreSQL/Supabase, leída exclusivamente desde el entorno o `.env`. Se utiliza para datos de inventario; usuarios y autenticación continúan en TinyDB. No guardar credenciales reales en el repositorio.

La conexión PostgreSQL se inicializa como engine SQLModel en `database.py`. Los endpoints que la necesiten deben recibir `DatabaseSession` (o `Session = Depends(get_db)`); `get_db()` crea una sesión por request y la cierra al finalizar. La API puede arrancar y seguir usando TinyDB sin `DATABASE_URL`, pero el acceso a PostgreSQL requiere configurarla.

## Tests

```bash
pytest
```

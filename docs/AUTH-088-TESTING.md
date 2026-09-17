# AUTH-088 — decisiones y cobertura de pruebas

## Alcance

Esta fase añade cobertura de la lógica de autenticación existente sin modificar código de producción. Las pruebas se mantienen en pytest, siguiendo la infraestructura actual del backend FastAPI.

## Casos cubiertos

- Login con email inexistente.
- Login con contraseña incorrecta.
- Rechazo de usuarios inactivos durante el login.
- Obtención del usuario actual con un token válido.
- Rechazo de un token malformado.
- Rechazo de un token de acceso expirado.
- Rechazo de un token válido cuyo usuario fue desactivado posteriormente.
- Invalidación del token de recuperación anterior cuando se solicita uno nuevo.
- Rechazo de un token de recuperación inexistente, ya cubierto por la suite previa.
- Rechazo de un token de recuperación expirado, ya cubierto por la suite previa.
- Rechazo de un token de recuperación reutilizado, ya cubierto por la suite previa.
- Aceptación del token de recuperación válido, ya cubierta por la suite previa.
- Cambio de contraseña correcto y rechazo de la contraseña actual incorrecta, ya cubiertos por la suite previa.
- Comprobación de que la contraseña restablecida se almacena como hash, ya cubierta por la suite previa.
- Comprobación de no enumeración de usuarios en recuperación, ya cubierta por la suite previa.
- Comportamiento cuando el token está exactamente en el instante de expiración.

## Decisión sobre el límite de expiración

El token se considera expirado cuando `expires_at <= now`. Por tanto, en el instante exacto en que ambos valores coinciden, el reset debe rechazarse con el mensaje `El token expiró`.

La prueba `test_reset_password_token_at_exact_expiration_is_rejected` fija el reloj de la lógica de autenticación y establece `expires_at` exactamente igual al instante actual. De esta forma evita depender de esperas reales o de diferencias de precisión del reloj.

## Qué no se prueba

Estas pruebas no verifican internals de FastAPI, el mecanismo interno de `Depends`, detalles de serialización no relacionados con la regla de negocio ni llamadas reales a proveedores externos. El envío de email se sustituye por una función controlada en las pruebas de recuperación.

## Resultado de esta fase

La suite backend pasó correctamente después de añadir la cobertura:

```text
30 passed, 1 warning
```

La advertencia existente procede de la compatibilidad/deprecación de `httpx` con `starlette.testclient`; no está relacionada con la lógica de autenticación modificada en esta fase.

## Revisión de regresiones — 2026-09-17

Se añadieron casos de regresión para expiración JWT, sujetos inválidos, entradas
vacías o inválidas y excepciones durante el hashing. La ejecución detectó tres
comportamientos existentes; se mantienen como `xfail(strict=True)` para
documentarlos sin modificar producción automáticamente:

- `test_register_rejects_empty_or_invalid_credentials`: `POST /users` acepta
	contraseña vacía y emails vacíos o sin formato. El comportamiento esperado es
	responder `422` y no crear la cuenta. El problema está en `services/api/users.py`,
	donde `UserCreate` declara `str` pero no valida contenido ni formato.
- `test_me_rejects_access_token_at_exact_expiration_boundary`: un JWT con `exp`
	igual al segundo actual fue aceptado (`200`). El comportamiento esperado es
	rechazarlo (`401`) en el límite exacto. El comportamiento observado proviene
	de la validación temporal de `python-jose` y de que `services/api/auth.py` no
	aplica una comprobación adicional del límite.
- `test_reset_password_compares_expiration_by_instant_not_string`: un token con
	`expires_at=2026-09-17T14:00:00+02:00`, equivalente al `now` fijado como
	`2026-09-17T12:00:00+00:00`, fue aceptado. El comportamiento esperado es
	tratarlo como expirado. El problema está en `services/api/auth.py`, donde
	`expires_at` y `now_iso` se comparan lexicográficamente como strings.

Estos son bugs confirmados por pruebas, no hipótesis. No se modificó código de
producción porque la instrucción de esta fase era detectar y documentar las
regresiones antes de decidir una corrección.

## Verificación del requisito de cobertura

Se ejecutaron los comandos requeridos desde `services/api`:

```text
uv run pytest
uv run pytest --cov
```

Resultado final:

```text
59 passed, 6 xfailed, 1 warning
auth.py: 100%
TOTAL: 83%
```

Las pruebas cubren registro, credenciales válidas e inválidas, usuarios
inactivos o inexistentes, generación y validación JWT, expiración y límites,
tokens de reset válidos, expirados, usados, inválidos y con offsets horarios,
cambio de contraseña, hashing y errores de persistencia.

El único código relacionado con autenticación que deliberadamente permanece
como `xfail` son los tres comportamientos incorrectos ya confirmados: registro
aceptando entradas inválidas, aceptación de JWT en el segundo exacto de
expiración y comparación textual de timestamps con offsets diferentes. No se
debilitaron las pruebas; `xfail(strict=True)` permite conservarlas como
regresiones pendientes sin cambiar producción en esta fase.

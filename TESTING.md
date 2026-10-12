# Plan de pruebas

## Objetivo

Validar la lógica de negocio del backend y las utilidades reutilizables del frontend, con especial atención a autenticación, gestión de candidatos, perfiles, usuarios e incidencias. Las pruebas no dependen de proveedores externos ni de detalles internos de FastAPI o React.

## Alcance

- Backend: `services/api/tests/`, pytest, pytest-cov, FastAPI `TestClient`, `monkeypatch` y TinyDB aislada por prueba.
- Frontend: `uis/talent-pipeline-tracker/lib/__tests__/`, Vitest (el proyecto no usa Jest), jsdom y cobertura V8.
- La cobertura se centra en contratos y lógica de negocio; no se exige cubrir componentes React sin lógica reutilizable.

El módulo prioritario de AUTH-088 es `services/api/auth.py`.

## Endpoints de autenticación cubiertos

- `POST /users`: registro de usuarios y creación del perfil asociado.
- `POST /auth/login`: credenciales válidas, inválidas y usuarios inactivos.
- `GET /auth/me`: validación del JWT y obtención del usuario actual.
- `POST /auth/forgot-password`: generación de tokens, no enumeración de usuarios y errores de email.
- `POST /auth/reset-password`: validación, expiración, uso único y actualización de contraseña.
- `POST /auth/change-password`: verificación de contraseña actual y cambio seguro de contraseña.

## API-042 — grupos de endpoints de backoffice

Se cubren estos grupos del backoffice:

1. **Candidaturas (`/records`)**: listado/creación, paginación, lectura por ID, actualización, gestión de notas, estados y errores de servicio.
2. **Perfiles (`/profiles`)**: lectura y actualización del perfil actual, valores opcionales y acceso no autenticado.
3. **Usuarios (`/users`)**: listado, alta, lectura, actualización, eliminación, duplicados y recursos inexistentes.
4. **Incidencias (`/incidents`)**: creación, filtros simples y múltiples, resumen, lectura, transiciones de estado y errores de servicio.

Cada grupo seleccionado tiene camino feliz, caso límite y modo de fallo. En la última ejecución, `records.py` obtuvo 85% e `incidents.py` 92%; ambos superan el objetivo mínimo del 60%.

## TypeScript/Jest y FE-019

El frontend usa Vitest, no Jest: `package.json` define `vitest run` y no contiene un script ni una configuración Jest. Se utiliza el script existente `test:coverage`. Las funciones reutilizables seleccionadas son funciones existentes en `lib/api-client.ts` y `lib/incidents-api.ts`:

- `authRequest`: token almacenado, header Bearer, 204, 401, errores estructurados y conexión.
- `loginRequest`: credenciales form-urlencoded, token devuelto, credenciales rechazadas y conexión.
- `updateIncidentStatus`: actualización válida de estado y rechazo de una transición inválida.
- `getIncidents`: listado sin filtros, filtros con `all` y error devuelto por el backend.

Cada función tiene camino feliz y modo de fallo. No se inventó una segunda configuración de Jest.

Los tests se encuentran en `uis/talent-pipeline-tracker/lib/__tests__/` y se ejecutan solamente para el frontend con:

```bash
cd uis/talent-pipeline-tracker
npm run test:coverage
```

## Estructura de casos

Para cada flujo se priorizan tres grupos:

- **Camino feliz:** registro, login, token válido, recuperación válida y cambio correcto de contraseña.
- **Caso límite:** expiración exacta, tokens apenas futuros, configuración de minutos, offsets de zona horaria, contraseña mínima, campos opcionales y usuarios desactivados.
- **Modo de fallo:** credenciales inválidas, campos ausentes o vacíos, JWT malformado o firmado con otra clave, usuarios inexistentes, tokens usados o inválidos y excepciones de hashing, email o persistencia.

## Tokens y expiración

Los tests comprueban específicamente:

- JWT válido, malformado, expirado, futuro, firmado con una clave incorrecta y con `sub` vacío, nulo o de tipo incorrecto.
- Rechazo de usuarios inexistentes o inactivos aunque el token esté correctamente firmado.
- Expiración configurable de tokens de acceso y de recuperación en minutos.
- Token de recuperación inexistente, expirado, usado, vacío y reemplazado por una solicitud posterior.
- Límite exacto `expires_at <= now` para tokens de recuperación.
- Fechas de recuperación con offsets horarios distintos.

Los tres comportamientos incorrectos actualmente confirmados se conservan como `xfail(strict=True)` para que sigan funcionando como regresiones pendientes: registro de credenciales inválidas, aceptación de JWT en el segundo exacto de expiración y comparación textual de timestamps con offsets diferentes.

## Ejecución

Los comandos previstos deben ejecutarse desde `services/api`, donde está el
`pyproject.toml` del backend:

```bash
cd services/api
uv run pytest
```

Para ejecutar la cobertura:

```bash
cd services/api
uv run pytest --cov
```

El proyecto no requiere comandos adicionales. En el entorno actual `uv` no está
en el `PATH`, por lo que `uv run pytest` y `uv run pytest --cov` solo funcionan
después de hacer disponible `uv` en el `PATH`. El ejecutable del workspace que
funciona actualmente es:

```bash
/workspaces/AngelG-Nexova-Solutions/.venv/bin/uv run pytest
/workspaces/AngelG-Nexova-Solutions/.venv/bin/uv run pytest --cov
```

Desde `uis/talent-pipeline-tracker`:

```bash
npm test
npm run test:coverage
npm exec tsc -- --noEmit
```

# Cobertura

Resultado real de la última ejecución de la suite completa antes de la auditoría:

```text
73 passed, 6 xfailed, 1 warning
```

Resultado real de `uv run pytest --cov`:

```text
auth.py: 100%
TOTAL: 92%
```

Resultado real de la auditoría final después de añadir cobertura de backoffice:

```text
73 passed, 6 xfailed, 1 warning
TOTAL: 92%
auth.py: 100%
records.py: 85%
profiles.py: 85%
users.py: 87%
```

Módulos destacados:

| Módulo | Cobertura |
| --- | ---: |
| `auth.py` | 100% |
| `database.py` | 100% |
| `main.py` | 100% |
| `incidents.py` | 92% |
| `services.py` | 99% |
| `users.py` | 87% |
| `profiles.py` | 85% |
| `email_service.py` | 59% |
| `records.py` | 85% |
| `packages/shared/incidents.py` | 56% |
| **Total** | **92%** |

Los `xfailed` son intencionales y estrictos: documentan bugs confirmados, no tests eliminados ni debilitados.

## Resultados frontend verificados

```text
Test Files  12 passed (12)
Tests       54 passed (54)
Statements  38.86% (192/494)
Branches    28.02% (109/389)
Functions   40.13% (59/147)
Lines       40.04% (189/472)
```

Cobertura específica de `lib/api-client.ts`: statements 71.59%, branches 41.79%, functions 71.42% y lines 75%.

# Flujo asistido por IA

Durante la revisión asistida por IA se identificó como posible regresión que `reset_password` comparaba `expires_at` y `now_iso` como strings. Se diseñó un caso con `expires_at=2026-09-17T14:00:00+02:00` y `now=2026-09-17T12:00:00+00:00`, que representan el mismo instante. La batería devolvió `200` cuando debía rechazar el token expirado con `400`, confirmando el problema en `services/api/auth.py`.

También se propuso probar el registro con contraseña vacía y emails sin formato. La batería confirmó que `POST /users` los acepta con `200`; el comportamiento esperado es rechazar la entrada y no crear la cuenta. Este problema está en `services/api/users.py`, porque `UserCreate` no valida el contenido de esos campos.

Los casos se verificaron ejecutando `uv run pytest`; no se corrigió producción automáticamente. Los casos confirmados permanecen visibles como `xfail(strict=True)`.

# Decisiones

Los tests comprueban reglas de negocio y contratos relevantes: quién puede autenticarse, cuándo un token es válido, cuándo expira, cómo se protege una contraseña, cómo se evita la enumeración de usuarios y cómo se manejan errores.

No se centran en la serialización interna de FastAPI, la implementación de `Depends` ni detalles del framework porque esos comportamientos pertenecen a bibliotecas externas y no representan por sí mismos reglas del sistema. `TestClient` se usa como medio para llegar a los endpoints reales, mientras que el estado de TinyDB y los proveedores externos se aíslan para que las pruebas sean reproducibles.

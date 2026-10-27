# Plan de implementación — Hito 5

## Objetivo

Completar los requisitos de inventario del backoffice usando el dominio del briefing de Nexova. La aplicación ya existe en `uis/backoffice` y contiene las cuatro vistas, autenticación de interfaz y un cliente común para la API; el trabajo se limitará a las brechas verificadas, sin rehacer funcionalidades existentes.

Este documento organiza el trabajo en fases con aprobación explícita. **No se inicia una fase hasta recibir autorización del usuario. Al terminar cada fase, se informará el resultado y se solicitará autorización antes de comenzar la siguiente.**

## Requisitos que guían todas las fases

- Usar los nombres `Asset`, `AssetEntry` y `AssetExit`, y los campos de negocio definidos en `Hito5-Contexto.md`, incluidos `office`, `current_stock` y `user_uuid`.
- Calcular el stock a partir de entradas y salidas; nunca pedirlo ni persistirlo como un valor editable.
- Mantener las cuatro rutas protegidas y enviar el token actual como `Authorization: Bearer ...` a los endpoints que requieren autenticación.
- Presentar los errores HTTP con un mensaje legible. En las salidas, el error de stock insuficiente debe aparecer junto a la cantidad.
- Preservar el resto de funciones y el lenguaje visual existente. No hacer un rediseño ni cambios de estilos no necesarios; consultar antes si se propone alguno.
- No incluir valores de `.env` o `.env.local` en commits o documentación. No hacer commit, push ni crear PR sin autorización explícita.

## Fases

### Fase 1 — Oficina de los movimientos

**Estado:** completada y verificada.

- Revisar nuevamente el estado/diff de Git y los cambios locales justo antes de editar; trabajar con ellos sin descartarlos ni sobrescribirlos.
- Actualizar los formularios de entrada y salida para registrar `office` del movimiento independientemente de la oficina del activo, con las opciones que define el brief: Valencia y Miami. Usar la oficina del activo como valor inicial si encaja con los controles existentes.
- Mantener las validaciones actuales de activo, cantidad, proveedor, tipo de salida y destinatario.
- Actualizar las pruebas frontend existentes para comprobar la oficina enviada en cada payload.
- No modificar el diseño general. Los controles de oficina son cambios funcionales visibles; cualquier ajuste adicional de presentación se consultará antes.

**Verificación de fase:** pruebas dirigidas de los formularios de entrada y salida, más lint/typecheck de los archivos afectados.

**Criterio de aceptación:** ambos formularios envían la oficina seleccionada y mantienen los comportamientos existentes de éxito, validación y error.

### Fase 2 — Autenticación de lecturas del inventario

**Estado:** completada y verificada.

- Proteger `GET /inventory/products`, `GET /inventory/products/{id}` y `GET /inventory/orders` con la dependencia de autenticación ya existente.
- Conservar la identidad TinyDB como origen de `user_uuid`; no crear modelo ni tabla SQL de usuarios.
- Añadir pruebas API para lecturas anónimas y autenticadas, conservando las pruebas actuales de stock y escrituras.

**Verificación de fase:** ejecutar el conjunto dirigido de `services/api/tests/test_inventory_api.py` (o los casos concretos). Si el `conftest.py` compartido sigue impidiendo cargar pytest, detenerse e informar; reparar esa infraestructura requiere autorización separada.

**Criterio de aceptación:** los GET rechazan solicitudes anónimas y responden correctamente para un usuario autenticado; no cambia el cálculo del stock ni el contrato de respuestas.

### Fase 3 — Configuración de la API local y del proxy

**Estado:** completada y verificada.

- Mantener el cliente frontend usando el proxy `/api`, para no duplicar lógica HTTP ni afectar otros módulos.
- Alinear el destino del rewrite con `NEXT_PUBLIC_INVENTORY_API_URL` requerido para desarrollo local y preservar `API_INTERNAL_URL` para Docker/despliegues, con precedencia explícita para evitar que `localhost` se use desde un contenedor.
- Revisar `.gitignore` y la configuración Compose actual sin reemplazar cambios previos del usuario.
- No registrar ni copiar valores de archivos de entorno. Si hace falta crear o modificar `.env.local`, pedir autorización antes de cambiarlo.

**Verificación de fase:** prueba dirigida del rewrite/configuración sin iniciar servicios; comprobar que `npm run dev` compila y que la petición se dirige al host esperado según la configuración disponible, sin exponer secretos.

**Criterio de aceptación:** la configuración local solicitada funciona a través del proxy y Compose conserva el destino interno existente.

### Fase 4 — Validación integral y revisión final

**Estado:** completada con limitaciones documentadas (2026-10-14).

- Ejecutar pruebas enfocadas de todas las vistas de inventario, protección de rutas y cliente API.
- Ejecutar lint y `npx tsc --noEmit` desde `uis/backoffice`.
- Ejecutar pruebas backend de inventario. Si backend y frontend están disponibles, hacer una comprobación manual de sesión, carga de stock, registro de movimientos, historial y error 400 visible.
- Revisar el diff completo, las referencias al nombre antiguo de la carpeta, archivos de entorno ignorados y cualquier cambio local preexistente. Registrar con claridad pruebas ejecutadas y bloqueos.

**Resultado de la validación:**

- Frontend focalizado: 7 archivos, 46 pruebas pasaron; ESLint del alcance y `npx tsc --noEmit` pasaron.
- Backend focalizado: `cd services/api && .venv/bin/python -m pytest tests/test_inventory_api.py -q`: 20 pasaron; queda una advertencia deprecada de Starlette/httpx.
- En validaciones anteriores de esta misma fase, `npm run build` pasó y `git diff --check` pasó. La configuración del proxy, su prueba y las vistas de inventario quedaron cubiertas por los checks focalizados.
- Las suites globales no están completamente verdes: frontend, 118/119 pruebas (un test no relacionado falla porque el mock de `next/navigation` no define `usePathname`); lint global, 5 errores y 2 advertencias en archivos fuera del alcance de inventario. No se modificaron esos archivos.
- No se ejecutó smoke test manual con servicios. El árbol Git contiene cambios staged y unstaged preexistentes fuera del alcance de Hito 5; se conservaron sin staging, limpieza ni reversión, por lo que no se atribuye ni certifica la totalidad del diff a esta fase. La revisión de rutas/env confirmó que `.env` y `.env.local` están ignorados, no hay archivos `.env*` no rastreados y no quedan referencias activas al directorio antiguo en configuración/áreas revisadas (persisten referencias históricas/documentales intencionales). Los checks de whitespace staged y unstaged pasaron.
- No se hizo commit, push ni PR.

**Criterio de aceptación:** las comprobaciones aplicables pasan, cualquier limitación queda documentada y el diff contiene solo cambios autorizados para el Hito 5.

## Fuera de alcance

- Rehacer el backoffice, cambiar estilos o navegación no necesarios, crear una pantalla de alta de activos no requerida por las cuatro vistas, cambiar modelos/categorías, instalar dependencias, reparar fallos no relacionados, ni publicar cambios.
- El renombrado `uis/talent-pipeline-tracker` → `uis/backoffice` ya aparece en el estado local observado; se tratará como cambio preexistente y se comprobará de nuevo antes de implementar, no se repetirá ni revertirá automáticamente.

## Estado y aprobaciones

| Fase | Estado | Aprobación |
| --- | --- | --- |
| 1. Oficina de los movimientos | Completada | Aprobada |
| 2. Autenticación de lecturas | Completada | Aprobada |
| 3. API local y proxy | Completada | Aprobada |
| 4. Validación y revisión | Completada con limitaciones documentadas | Aprobada para continuar |

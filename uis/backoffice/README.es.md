# Backoffice de Nexova Solutions

Portal interno de referencia ubicado en `uis/backoffice/`, independiente del sitio público (`uis/website/`) y del Talent Pipeline Tracker. Presenta información empresarial documentada, permite explorar áreas y líneas de negocio, y ofrece accesos a funciones del tracker que ya existen.

## Ejecutar localmente

Desde la raíz del repositorio:

```bash
python -m http.server 8001 --directory uis/backoffice
```

Abre <http://localhost:8001/>. No requiere instalación de paquetes ni compilación. Como alternativa, desde esta carpeta ejecuta `python -m http.server 8001`.

## Contenido y límites

- **Resumen:** tamaño y presencia documentados de Nexova, líneas de negocio y accesos a candidaturas, incidencias e inventario existentes.
- **Organización:** áreas, responsabilidades, responsables y tamaños que aparecen en `CONTEXT.md`; incluye búsqueda por área y persona.
- **Líneas de negocio:** headhunting/selección, outsourcing de soporte y formación corporativa.
- **Herramientas:** enlaces a rutas implementadas del Talent Pipeline Tracker.
- Identifica expresamente la información empresarial como contexto, no telemetría actual.
- No simula usuarios, autenticación, KPIs en tiempo real ni conexiones con CRM, helpdesk u otros sistemas. Algunos módulos enlazados requieren que el tracker/backend estén desplegados y pueden pedir sesión.

La interfaz usa HTML, CSS y JavaScript sin framework y no comparte layouts con la web pública ni modifica el tracker. Los enlaces al tracker apuntan por defecto a `http://localhost:3000`, el puerto del servidor de desarrollo configurado en el repositorio. Para apuntarlos a otro origen, añade `?tracker=https://tu-host` a la URL del backoffice. La tipografía puede descargarse de Google Fonts; se emplean fuentes alternativas si no hay conexión.

> English: [README.md](./README.md).

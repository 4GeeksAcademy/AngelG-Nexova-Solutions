# Sitio web público de Nexova

Sitio web público, independiente y adaptable a distintos tamaños de pantalla, basado visualmente en el `index.html` de la raíz. Esta carpeta no depende del tracker interno de selección ni de la página de registro de talento.

## Ejecución local

Desde la raíz del repositorio, inicia un servidor estático, por ejemplo:

```bash
python -m http.server 8000
```

Abre `http://localhost:8000/uis/website/`. El formulario existente de registro de talento está enlazado en `/application.html`.

## Archivos

- `index.html`: contenido semántico, metadatos y JSON-LD de la organización.
- `styles.css`: estilos y diseño adaptable.
- `script.js`: navegación móvil y año actual del copyright.

No requiere compilación ni dependencias adicionales. Las fuentes se cargan desde Google Fonts si hay conexión; existen alternativas del sistema. Los datos de la empresa se limitan a información respaldada por el contexto del repositorio; se han omitido datos de contacto, resultados y dirección postal concreta no verificados de la referencia.

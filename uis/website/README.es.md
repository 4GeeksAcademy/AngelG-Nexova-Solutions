# Sitio web público de Nexova

Aplicación pública independiente construida con Next.js App Router, React, TypeScript y Tailwind CSS 4. No forma parte del tracker ni requiere credenciales o conexión al backend.

## Ejecución local

Desde esta carpeta:

```bash
npm ci
npm run dev
```

Abre `http://localhost:3001/`. La ruta `/application` contiene el formulario de registro de talento migrado a Next.js.

## Estructura

- `app/page.tsx`: portada pública.
- `app/application/page.tsx`: formulario de registro.
- `app/layout.tsx`: metadatos y layout global.
- `app/globals.css` y `styles.css`: Tailwind y estilos visuales compartidos.
- `components/`: navegación y componentes interactivos compartidos.

La URL del formulario se sirve dentro de esta aplicación; no se requiere levantar el servidor estático de la raíz.

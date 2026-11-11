# Sitio web público de Nexova

Aplicación pública construida con Next.js App Router, React, TypeScript y Tailwind CSS 4. El formulario reenvía las candidaturas desde el servidor a la API Nexova; los candidatos no necesitan credenciales de usuario.

## Ejecución local

Desde esta carpeta:

```bash
npm ci
npm run dev
```

Abre `http://localhost:3001/`. La ruta `/application` contiene el formulario de registro de talento migrado a Next.js.

Configura `API_INTERNAL_URL` en el servidor del website con la URL interna base de FastAPI (por ejemplo, `http://127.0.0.1:8000`). No expongas esta URL mediante una variable `NEXT_PUBLIC_`.

## Estructura

- `app/page.tsx`: portada pública.
- `app/application/page.tsx`: formulario de registro.
- `app/layout.tsx`: metadatos y layout global.
- `app/globals.css` y `styles.css`: Tailwind y estilos visuales compartidos.
- `components/`: navegación y componentes interactivos compartidos.

El formulario de `/application` captura datos de contacto y perfil, sector, nivel de inglés, disponibilidad, comentarios y consentimiento explícito. La ruta `/api/application` reenvía los campos permitidos a `/records/public`; la API registra la candidatura en TinyDB junto con el consentimiento y su fecha/hora generada en servidor. No se ofrece carga de CV (el campo `cv_url` se envía como `null`). El listado y la gestión internos siguen requiriendo autenticación.

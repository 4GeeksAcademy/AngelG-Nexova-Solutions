# Nexova public website

Standalone public-facing application built with the Next.js App Router, React, TypeScript, and Tailwind CSS 4. The application form forwards candidate submissions server-side to the Nexova API; applicants do not need user credentials.

## Run locally

From this directory:

```bash
npm ci
npm run dev
```

Open `http://localhost:3001/`. The talent registration form is available at `/application`.

Set `API_INTERNAL_URL` on the website server to the internal base URL of FastAPI (for example, `http://127.0.0.1:8000`). Do not expose this server-only URL through a `NEXT_PUBLIC_` variable.

## Structure

- `app/page.tsx`: public landing page.
- `app/application/page.tsx` and `components/ApplicationForm.tsx`: candidate application form.
- `app/api/application/route.ts`: server-side allowlisted proxy to the API.
- `app/layout.tsx`: metadata and root layout.
- `app/globals.css` and `styles.css`: Tailwind and shared visual styles.
- `components/`: shared navigation and interactive components.

The `/application` form captures contact and profile details, sector, English level, availability, comments, and explicit data-processing consent. The allowlisted server-side proxy forwards these fields to `/records/public`; the API persists them in TinyDB with a server-generated consent timestamp. CV upload is not implemented (`cv_url` is sent as `null`). The API does not include candidate details in its unauthenticated acknowledgement; internal listing and management stay authenticated.

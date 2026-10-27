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

The form collects the pipeline fields (`full_name`, `email`, `phone`, `position`, `experience_years`, plus optional `linkedin_url` and `cv_url`). The data-processing consent is collected in the UI but is not sent to the API. The API's `/records/public` endpoint only creates candidates; internal listing and management stay authenticated.

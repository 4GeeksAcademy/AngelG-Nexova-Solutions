# Nexova public website

Standalone public-facing application built with the Next.js App Router, React, TypeScript, and Tailwind CSS 4. It is independent of the internal Talent Pipeline Tracker and does not require backend credentials.

## Run locally

From this directory:

```bash
npm ci
npm run dev
```

Open `http://localhost:3001/`. The talent registration form is available at `/application`.

## Structure

- `app/page.tsx`: public landing page.
- `app/application/page.tsx`: talent registration form.
- `app/layout.tsx`: metadata and root layout.
- `app/globals.css` and `styles.css`: Tailwind and shared visual styles.
- `components/`: shared navigation and interactive components.

The registration form is served by this application; there is no dependency on the root static server.

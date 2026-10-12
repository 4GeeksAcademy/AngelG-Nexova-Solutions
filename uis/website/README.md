# Nexova public website

Standalone responsive public-facing website, visually based on the root `index.html`. This folder is intentionally independent of the internal Talent Pipeline Tracker and the talent registration page.

## Run locally

From the repository root, start a static server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/uis/website/`. The existing registration page is linked at `/application.html`.

## Files

- `index.html`: semantic page content, metadata, organization JSON-LD.
- `styles.css`: responsive styles and visual design.
- `script.js`: mobile navigation and current copyright year.

No build step or additional project dependencies are required. Fonts are loaded from Google Fonts when network access is available; system fallbacks are provided. Business facts are limited to information supported by repository context; unsupported contact details, performance claims, and street-level address from the root reference have been omitted.

# Nexova Solutions backoffice

Internal reference portal at `uis/backoffice/`, independent from the public website (`uis/website/`) and the Talent Pipeline Tracker. It presents documented company context, lets users explore departments and business lines, and links to existing tracker features.

## Run locally

From the repository root:

```bash
python -m http.server 8001 --directory uis/backoffice
```

Open <http://localhost:8001/>. No package installation or build step is required. Alternatively, run `python -m http.server 8001` from this directory.

## Content and boundaries

- **Overview:** documented company size and locations, business lines, and links to the existing candidate, incidents, and inventory modules.
- **Organization:** departments, responsibilities, leads, and team sizes described in `CONTEXT.md`; includes department/person search.
- **Business lines:** headhunting/recruitment, outsourced customer support, and corporate training.
- **Tools:** links to implemented routes in the Talent Pipeline Tracker.
- Company information is explicitly identified as reference context, not live telemetry.
- It does not simulate users, authentication, real-time KPIs, or integrations with CRM/helpdesk systems. Linked modules require the tracker/backend to be running and may require a session.

The interface uses plain HTML, CSS, and JavaScript with no framework and does not share layouts with the public website or change the tracker. Tracker links default to `http://localhost:3000`, the development server port configured in this repository. To target another origin, add `?tracker=https://your-host` to the backoffice URL. Fonts may load from Google Fonts; system fallbacks are provided.

> Español: [README.es.md](./README.es.md).

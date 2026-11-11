# `services` folder

Hito 6 adds [`telemetry/`](telemetry/README.md) and
[`reporting/`](reporting/README.md), imported by the existing API process.
Local execution requires the explicit inventory migration 003.
The Dockerfile now copies both sibling modules. Existing images must be
rebuilt to include them; no deployment was performed.

This folder contains **all the backend services** (APIs and background workers) related to the company for the cross-functional AI Engineering project.

Each subfolder inside `services/` must correspond to **one specific service** (for example: `admin-api`, `data-processor-worker`) and include its own technical and functional documentation.

- **Main purpose**: to centralize all the backend logic, APIs, and queue consumers that support the company's use cases.
- **Recommendation**: document in this file (or in sub-READMEs) the services you add, their objective, the technology used, and how to run them.

> _Spanish version: [README.es.md](./README.es.md)._

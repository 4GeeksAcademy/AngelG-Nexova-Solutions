"""
main.py — FastAPI application for Nexova Solutions Supplier Directory.

Mounts the suppliers router and provides a health-check endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.suppliers import router as suppliers_router

app = FastAPI(
    title="Nexova - Directorio de Proveedores API",
    description="API REST para el directorio centralizado de proveedores de Nexova Solutions.",
    version="0.1.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────
# Allow requests from the frontend (application.html, index.html, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to actual frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────
app.include_router(suppliers_router)


@app.get("/health", tags=["health"])
def health_check():
    """Simple health-check endpoint."""
    return {"status": "ok"}
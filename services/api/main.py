"""
main.py — FastAPI application for Nexova Solutions Supplier Directory.

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .routes.suppliers import router as suppliers_router

load_dotenv()


app = FastAPI(
    title="Nexova - Directorio de Proveedores API",
    description="API REST para el directorio centralizado de proveedores de Nexova Solutions.",
    version="0.1.0",
)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(
    request: Request,
    exc: RequestValidationError
):
    del request
    fields = {}
    for error in exc.errors():
        location = [str(part) for part in error["loc"] if part not in {"body", "query"}]
        fields[".".join(location)] = error["msg"]
    return JSONResponse(
        status_code=400,
        content={
            "detail": {
                "code": "VALIDATION_ERROR",
                "message": "La solicitud contiene campos inválidos.",
                "fields": fields,
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    del request
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": {
                "message": str(exc.detail),
            }
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    del request, exc
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "INTERNAL_ERROR",
                "message": "Se produjo un error interno al procesar la solicitud.",
            }
        },
    )


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

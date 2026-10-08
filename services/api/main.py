import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlmodel import SQLModel

import database
from auth import router as auth_router
from profiles import router as profiles_router
from records import router as records_router
from incidents import router as incidents_router
from users import router as users_router
from routers.inventory import router as inventory_router
import models  # noqa: F401 — registers inventory tables in SQLModel.metadata


load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create inventory tables at startup when PostgreSQL is configured."""
    if database.engine is not None:
        SQLModel.metadata.create_all(database.engine)
    yield


app = FastAPI(
    title="Company API",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(
    request: Request,
    exc: RequestValidationError
):
    fields = {}
    for error in exc.errors():
        location = [str(part) for part in error["loc"] if part not in {"body", "query"}]
        fields[".".join(location)] = error["msg"]
    return JSONResponse(
        # Inventory request schemas follow FastAPI's validation status (422).
        # Preserve the API's existing 400 mapping for all other routers.
        status_code=422 if request.url.path.startswith("/inventory/") else 400,
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
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(users_router)
app.include_router(profiles_router)
app.include_router(auth_router)
app.include_router(records_router)
app.include_router(incidents_router)
app.include_router(inventory_router)


@app.get("/")
def home():
    return {
        "message": "API funcionando"
    }

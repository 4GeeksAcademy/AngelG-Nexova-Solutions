import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from auth import router as auth_router
from profiles import router as profiles_router
from records import router as records_router
from incidents import router as incidents_router
from users import router as users_router


load_dotenv()


app = FastAPI(
    title="Company API"
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
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "La solicitud contiene campos inválidos.",
                "fields": fields,
            }
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    del request, exc
    return JSONResponse(
        status_code=500,
        content={
            "error": {
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


@app.get("/")
def home():
    return {
        "message": "API funcionando"
    }

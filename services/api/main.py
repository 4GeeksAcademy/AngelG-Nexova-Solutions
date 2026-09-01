import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from profiles import router as profiles_router
from records import router as records_router
from users import router as users_router


load_dotenv()


app = FastAPI(
    title="Company API"
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


@app.get("/")
def home():
    return {
        "message": "API funcionando"
    }

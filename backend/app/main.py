from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.resources import router as resources_router
from app.routers.sessions import router as sessions_router

app = FastAPI(title="Lecture Companion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions_router)
app.include_router(resources_router)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/version")
def version():
    return {"service": "lecture-companion-api", "version": "0.1.0"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events - startup and shutdown"""
    # Startup
    print("[START] Starting Coach Competency Database Service...")
    await init_db()
    print("[OK] Database initialized")
    yield
    # Shutdown
    print("[STOP] Shutting down...")
    await close_db()
    print("[OK] Database connection closed")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Coach Competency Management and Project Matching Platform",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "timestamp": "2025-11-03T00:00:00Z",
    }


# Import and include routers
from app.api.endpoints import auth, competencies, files, education, applications, projects, certifications, notifications, admin, verifications

app.include_router(auth.router, prefix="/api")
app.include_router(competencies.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(education.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(certifications.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(verifications.router, prefix="/api")

# Future routers (will be added as we create them)
# from app.api.endpoints import projects, applications, reviews, selections, files
# app.include_router(projects.router, prefix="/api", tags=["Projects"])
# app.include_router(applications.router, prefix="/api", tags=["Applications"])
# app.include_router(reviews.router, prefix="/api", tags=["Reviews"])
# app.include_router(selections.router, prefix="/api", tags=["Selections"])
# app.include_router(files.router, prefix="/api", tags=["Files"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

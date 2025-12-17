from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import traceback

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

# Configure CORS - dynamically filter origins
def get_cors_origins():
    """Get CORS origins, filtering out '*' and ensuring Railway frontend is included"""
    origins = list(settings.BACKEND_CORS_ORIGINS)
    # Remove wildcard - not allowed with allow_credentials=True
    origins = [o for o in origins if o != "*"]
    # Always include Railway frontend domains
    required_origins = [
        "https://copms.up.railway.app",
        "https://coacdbfront-production.up.railway.app",
        "https://coachdbfrontend-production.up.railway.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    for origin in required_origins:
        if origin not in origins:
            origins.append(origin)
    print(f"[CORS] Allowed origins: {origins}")
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler to ensure proper error responses with CORS headers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    print(f"[GLOBAL ERROR] {request.method} {request.url}")
    print(f"[GLOBAL ERROR] Exception: {type(exc).__name__}: {str(exc)}")
    print(f"[GLOBAL ERROR] Traceback:\n{traceback.format_exc()}")

    # Get origin from request for CORS
    origin = request.headers.get("origin", "")
    allowed_origins = get_cors_origins()

    # Build response with CORS headers if origin is allowed
    headers = {}
    if origin in allowed_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=headers
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
@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    from datetime import datetime
    return {
        "status": "healthy",
        "database": "connected",
        "timestamp": datetime.utcnow().isoformat() + "Z",
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

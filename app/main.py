"""
Content-Dashboard — Main FastAPI application entry point.
Serves both the REST API and the static UI from a single process.
Includes: structured logging, error tracking, request middleware.
"""

from contextlib import asynccontextmanager
import time
import traceback
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

from app.config import get_settings
from app.database import engine, Base
from app.routers import content, health, media, links, status, tasks, dashboard, status_definitions, export_import

# Import all models so Base.metadata knows about them
from app.models import MediaContent, MediaLink, MediaStatus, TodoTask  # noqa: F401
from app.models.media import StatusDefinition  # noqa: F401

settings = get_settings()

# --- Structured Logging ---
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format=LOG_FORMAT,
    datefmt=LOG_DATE_FORMAT,
)
# Suppress noisy SQLAlchemy logs in production
if settings.APP_ENV != "development":
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

logger = logging.getLogger("content-dashboard")


# --- Lifespan (startup / shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting %s v%s [env=%s]", settings.APP_NAME, settings.APP_VERSION, settings.APP_ENV)
    # Create tables
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables ensured.")
    yield
    logger.info("🛑 Shutting down %s", settings.APP_NAME)


# --- App factory ---
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Content Dashboard — A comprehensive media content management and analytics platform.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Logging Middleware ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, status, and duration."""
    start = time.time()
    method = request.method
    path = request.url.path

    # Skip static file logging to reduce noise
    if path.startswith("/static"):
        return await call_next(request)

    try:
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        status_code = response.status_code

        if status_code >= 500:
            logger.error("❌ %s %s → %d (%.1fms)", method, path, status_code, duration_ms)
        elif status_code >= 400:
            logger.warning("⚠️  %s %s → %d (%.1fms)", method, path, status_code, duration_ms)
        else:
            logger.info("✅ %s %s → %d (%.1fms)", method, path, status_code, duration_ms)

        return response
    except Exception as exc:
        duration_ms = (time.time() - start) * 1000
        logger.critical(
            "💥 UNHANDLED EXCEPTION | %s %s | %.1fms | %s\n%s",
            method, path, duration_ms, str(exc), traceback.format_exc()
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Check logs for details."},
        )


# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch any unhandled exceptions and log them with full traceback."""
    logger.error(
        "💥 Unhandled error on %s %s: %s\n%s",
        request.method, request.url.path, str(exc), traceback.format_exc()
    )
    content = {"detail": "Internal server error"}
    if settings.DEBUG:
        content["error"] = str(exc)
    return JSONResponse(status_code=500, content=content)


# --- API routers ---
app.include_router(health.router, prefix=settings.API_PREFIX, tags=["Health"])
app.include_router(content.router, prefix=settings.API_PREFIX, tags=["Content"])
app.include_router(media.router, prefix=settings.API_PREFIX, tags=["Media"])
app.include_router(links.router, prefix=settings.API_PREFIX, tags=["Links"])
app.include_router(status.router, prefix=settings.API_PREFIX, tags=["Status"])
app.include_router(tasks.router, prefix=settings.API_PREFIX, tags=["Tasks"])
app.include_router(dashboard.router, prefix=settings.API_PREFIX, tags=["Dashboard"])
app.include_router(status_definitions.router, prefix=settings.API_PREFIX, tags=["Status Definitions"])
app.include_router(export_import.router, prefix=settings.API_PREFIX, tags=["Excel Export/Import"])

# --- Serve static UI ---
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/", include_in_schema=False)
async def serve_ui():
    """Serve the main UI page."""
    return FileResponse(os.path.join(static_dir, "index.html"))

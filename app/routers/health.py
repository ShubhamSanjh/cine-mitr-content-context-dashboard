"""
Health check and version endpoints.
"""

from fastapi import APIRouter
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/health", summary="Health Check")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
    }


@router.get("/version", summary="Version & Changelog")
async def version_info():
    return {
        "version": settings.APP_VERSION,
        "name": settings.APP_NAME,
        "changelog": {
            "3.0.0": [
                "Added tags/categories to media, links, status, and tasks",
                "Added Reminders system for deadlines and publication dates",
                "Added Calendar view combining releases, tasks, and reminders",
                "Added dynamic Analytics dashboard (config-driven show/hide)",
                "Added status duplication endpoint",
                "Added full Excel export with category tabs and tags sheet",
                "All lists now sorted by updated_at timestamp",
                "Added tag-based filtering and searching across all entities",
                "Semantic versioning with changelog endpoint",
            ],
            "2.4.0": [
                "Duplicate prevention for media names and link URLs",
                "Production security hardening",
            ],
        },
    }

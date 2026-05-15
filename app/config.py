"""
Environment-specific configuration using pydantic-settings.
Supports: development, staging, production profiles.
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Application ---
    APP_NAME: str = "Content-Dashboard"
    APP_VERSION: str = "2.4.0"
    APP_ENV: str = "development"  # development | staging | production
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1  # Gunicorn workers (production: 2*CPU+1)

    # --- Security ---
    SECRET_KEY: str = "change-me-in-production"  # Override via env var in production

    # --- Database ---
    DATABASE_URL: str = "sqlite:///./content_dashboard.db"  # Dummy SQLite; replace with PostgreSQL
    # Example PostgreSQL: postgresql://user:password@localhost:5432/content_dashboard
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:8000"  # Comma-separated; set to your domain(s) in production

    # --- Logging ---
    LOG_LEVEL: str = "INFO"

    # --- API ---
    API_PREFIX: str = "/api/v1"

    model_config = {
        "env_file": f".env.{os.getenv('APP_ENV', 'development')}",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance — only loaded once per process."""
    return Settings()

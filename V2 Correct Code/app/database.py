"""
Database engine and session management.
Currently uses SQLite as a dummy DB.
Replace DATABASE_URL in .env with PostgreSQL connection string when ready.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

settings = get_settings()

# --- Engine ---
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DB_ECHO,
    connect_args=connect_args,
)

# --- Session ---
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Base ---
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

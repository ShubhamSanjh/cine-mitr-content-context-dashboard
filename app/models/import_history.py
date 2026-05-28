"""
SQLAlchemy models for Import History tracking.
Tables: import_history, import_records, import_schedules
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Boolean
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class ImportHistory(Base):
    """Stores summary of each import run."""
    __tablename__ = "import_history"

    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(String(50), nullable=False, index=True)  # media, links, status
    file_name = Column(String(255), nullable=False)
    total_rows = Column(Integer, default=0)
    total_processed = Column(Integer, default=0)
    successful = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    skipped_empty = Column(Integer, default=0)
    success_rate = Column(Integer, default=0)  # percentage 0-100
    created_at = Column(DateTime, default=_utcnow)


class ImportRecord(Base):
    """Stores individual row results from an import."""
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, index=True)
    history_id = Column(Integer, nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, index=True)  # success, failed, skipped
    record_name = Column(String(255))  # primary identifier (media_name, url, etc.)
    record_data = Column(JSON)  # full row data as dict
    error_message = Column(Text)
    issue_type = Column(String(50))
    created_at = Column(DateTime, default=_utcnow)


class ImportSchedule(Base):
    """Stores import schedule configuration."""
    __tablename__ = "import_schedules"

    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(String(50), nullable=False)  # media, links, status
    interval = Column(String(20), nullable=False)  # daily, weekly, monthly
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    notify_email = Column(String(255))
    notify_in_app = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


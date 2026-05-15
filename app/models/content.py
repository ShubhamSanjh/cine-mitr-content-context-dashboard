"""
SQLAlchemy model for the Content table.
Represents a generic content record in the dashboard.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="active", index=True)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    def __repr__(self):
        return f"<Content(id={self.id}, title='{self.title}', category='{self.category}')>"

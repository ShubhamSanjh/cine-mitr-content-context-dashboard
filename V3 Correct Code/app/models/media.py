"""
SQLAlchemy models for Media Content management.
Tables: media_content, media_links, media_status, todo_tasks, reminders
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Date, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class MediaContent(Base):
    """
    Stores media details — movies, web series, shows, music.
    Columns:
        id: Primary key
        media_category: Type of media (movies, webseries, shows, music)
        media_name: Name/title of the media
        release_date: Release date of the media
        genre: Genre(s) of the media
        director: Director name
        cast_members: Cast/actors (comma-separated)
        rating: Rating out of 10
        review: User review text
        created_at: Record creation timestamp
        updated_at: Record last update timestamp
    """
    __tablename__ = "media_content"
    __table_args__ = (
        UniqueConstraint("media_name", name="uq_media_content_name"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    media_category = Column(String(50), nullable=False, index=True)  # movies, webseries, shows, music
    media_name = Column(String(255), nullable=False, unique=True, index=True)
    release_date = Column(Date, nullable=True)
    genre = Column(String(200), nullable=True)
    director = Column(String(200), nullable=True)
    cast_members = Column(Text, nullable=True)
    rating = Column(Float, nullable=True)
    review = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True, index=True)  # Comma-separated tags
    is_available = Column(String(10), default="false")  # "true" or "false"
    available_on = Column(String(255), nullable=True)   # Platform/source name when available
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    links = relationship("MediaLink", back_populates="media", cascade="all, delete-orphan")
    statuses = relationship("MediaStatus", back_populates="media", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="media", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MediaContent(id={self.id}, name='{self.media_name}', category='{self.media_category}')>"


class MediaLink(Base):
    """
    Stores linked content URLs for media items.
    Links media to external platforms (YouTube, Instagram, Twitter, etc.)
    Columns:
        id: Primary key
        media_id: Foreign key to media_content
        platform: Platform name (youtube, instagram, twitter, etc.)
        url: Full URL link
        description: Optional description of the link
        link_status: Status of the link (active, inactive)
        link_category: Category derived from the linked media's category
        created_at: Record creation timestamp
    """
    __tablename__ = "media_links"
    __table_args__ = (
        UniqueConstraint("url", name="uq_media_links_url"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    media_id = Column(Integer, ForeignKey("media_content.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(100), nullable=False, index=True)  # youtube, instagram, twitter, etc.
    url = Column(Text, nullable=False, unique=True)
    description = Column(String(500), nullable=True)
    link_status = Column(String(20), default="active", index=True)  # active, inactive
    link_category = Column(String(50), nullable=True, index=True)  # derived from media category
    tags = Column(String(500), nullable=True, index=True)  # Comma-separated tags
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    media = relationship("MediaContent", back_populates="links")

    def __repr__(self):
        return f"<MediaLink(id={self.id}, platform='{self.platform}', media_id={self.media_id})>"


class MediaStatus(Base):
    """
    Tracks status/progress of media content items.
    Statuses: reviewed, proceed, stopped, in_progress, revived, planned, cancelled
    Columns:
        id: Primary key
        media_id: Foreign key to media_content
        status: Current status of the media
        notes: Additional notes about the status
        tags: Comma-separated tags for categorization
        updated_by: Who updated the status
        created_at: When this status was set
        updated_at: Last modification timestamp
    """
    __tablename__ = "media_status"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    media_id = Column(Integer, ForeignKey("media_content.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False, index=True)  # reviewed, proceed, stopped, in_progress, revived, planned, cancelled
    notes = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True, index=True)  # Comma-separated tags
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    media = relationship("MediaContent", back_populates="statuses")

    def __repr__(self):
        return f"<MediaStatus(id={self.id}, status='{self.status}', media_id={self.media_id})>"


class TodoTask(Base):
    """
    Todo tasks with calendar integration.
    """
    __tablename__ = "todo_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    priority = Column(String(20), default="medium", index=True)
    category = Column(String(50), default="general", index=True)
    tags = Column(String(500), nullable=True, index=True)  # Comma-separated tags
    media_id = Column(Integer, ForeignKey("media_content.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), default="pending", index=True)
    reminder = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    def __repr__(self):
        return f"<TodoTask(id={self.id}, title='{self.title}', status='{self.status}')>"


class Reminder(Base):
    """Reminders for content deadlines and publication dates."""
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    media_id = Column(Integer, ForeignKey("media_content.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    reminder_date = Column(DateTime(timezone=True), nullable=False)
    is_sent = Column(Boolean, default=False)
    reminder_type = Column(String(50), default="deadline")  # deadline, publication, custom
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    media = relationship("MediaContent", back_populates="reminders")

    def __repr__(self):
        return f"<Reminder(id={self.id}, title='{self.title}', date={self.reminder_date})>"


class StatusDefinition(Base):
    """
    Manages reusable status names used across the application.
    These statuses can be assigned to media links and media status entries.
    """
    __tablename__ = "status_definitions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True, index=True)
    label = Column(String(100), nullable=False)
    color = Column(String(20), nullable=True)
    description = Column(String(255), nullable=True)
    is_active = Column(String(10), default="true")
    usage_context = Column(String(100), default="all")  # all, links, status_tracking (content ideas & status)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    def __repr__(self):
        return f"<StatusDefinition(id={self.id}, name='{self.name}')>"



"""
Pydantic schemas for Media Content, Links, Status, Todo Tasks, and Reminders.
Request/Response validation and serialization.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


# ==================== Media Content ====================

class MediaContentBase(BaseModel):
    media_category: str = Field(..., min_length=1, max_length=50, examples=["movies"])
    media_name: str = Field(..., min_length=1, max_length=255, examples=["Inception"])
    release_date: Optional[date] = Field(None, examples=["2010-07-16"])
    genre: Optional[str] = Field(None, max_length=200, examples=["Sci-Fi, Thriller"])
    director: Optional[str] = Field(None, max_length=200, examples=["Christopher Nolan"])
    cast_members: Optional[str] = Field(None, examples=["Leonardo DiCaprio, Tom Hardy"])
    rating: Optional[float] = Field(None, ge=0, le=10, examples=[8.8])
    review: Optional[str] = Field(None, examples=["A mind-bending masterpiece"])
    tags: Optional[str] = Field(None, max_length=500, examples=["sci-fi, must-watch, nolan"])
    is_available: Optional[str] = Field("false", examples=["false"])
    available_on: Optional[str] = Field(None, max_length=255, examples=["Netflix, Amazon Prime"])


class MediaContentCreate(MediaContentBase):
    pass


class MediaContentUpdate(BaseModel):
    media_category: Optional[str] = Field(None, min_length=1, max_length=50)
    media_name: Optional[str] = Field(None, min_length=1, max_length=255)
    release_date: Optional[date] = None
    genre: Optional[str] = None
    director: Optional[str] = None
    cast_members: Optional[str] = None
    rating: Optional[float] = Field(None, ge=0, le=10)
    review: Optional[str] = None
    tags: Optional[str] = None
    is_available: Optional[str] = None
    available_on: Optional[str] = None


class MediaContentResponse(MediaContentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MediaContentPaginatedResponse(BaseModel):
    items: List[MediaContentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==================== Media Links ====================

class MediaLinkBase(BaseModel):
    media_id: int = Field(..., examples=[1])
    platform: str = Field(..., min_length=1, max_length=100, examples=["youtube"])
    url: str = Field(..., min_length=1, examples=["https://youtube.com/watch?v=abc123"])
    description: Optional[str] = Field(None, max_length=500, examples=["Official trailer"])
    link_status: Optional[str] = Field("active", examples=["active"])
    link_category: Optional[str] = Field(None, max_length=50, examples=["movies"])
    tags: Optional[str] = Field(None, max_length=500, examples=["trailer, official"])


class MediaLinkCreate(MediaLinkBase):
    pass


class MediaLinkUpdate(BaseModel):
    media_id: Optional[int] = None
    platform: Optional[str] = Field(None, min_length=1, max_length=100)
    url: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    link_status: Optional[str] = None
    link_category: Optional[str] = None
    tags: Optional[str] = None


class MediaLinkResponse(MediaLinkBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== Media Status ====================

class MediaStatusBase(BaseModel):
    media_id: int = Field(..., examples=[1])
    status: str = Field(..., min_length=1, max_length=50, examples=["in_progress"])
    notes: Optional[str] = Field(None, examples=["Currently being reviewed"])
    tags: Optional[str] = Field(None, max_length=500, examples=["priority, urgent"])
    updated_by: Optional[str] = Field(None, max_length=100, examples=["admin"])


class MediaStatusCreate(MediaStatusBase):
    pass


class MediaStatusUpdate(BaseModel):
    status: Optional[str] = Field(None, min_length=1, max_length=50)
    notes: Optional[str] = None
    tags: Optional[str] = None
    updated_by: Optional[str] = None


class MediaStatusResponse(MediaStatusBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==================== Todo Tasks ====================

class TodoTaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, examples=["Review movie trailer"])
    description: Optional[str] = Field(None, examples=["Watch and review the new trailer"])
    due_date: Optional[date] = Field(None, examples=["2026-05-20"])
    priority: Optional[str] = Field("medium", examples=["high"])
    category: Optional[str] = Field("general", examples=["media"])
    tags: Optional[str] = Field(None, max_length=500, examples=["review, urgent"])
    media_id: Optional[int] = Field(None, examples=[1])
    status: Optional[str] = Field("pending", examples=["pending"])
    reminder: Optional[datetime] = None


class TodoTaskCreate(TodoTaskBase):
    pass


class TodoTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    media_id: Optional[int] = None
    status: Optional[str] = None
    reminder: Optional[datetime] = None


class TodoTaskResponse(TodoTaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==================== Reminders ====================

class ReminderBase(BaseModel):
    media_id: Optional[int] = Field(None, examples=[1])
    title: str = Field(..., min_length=1, max_length=255, examples=["Movie release deadline"])
    message: Optional[str] = Field(None, examples=["Don't forget to publish the review"])
    reminder_date: datetime = Field(..., examples=["2026-06-01T09:00:00Z"])
    reminder_type: Optional[str] = Field("deadline", examples=["deadline"])


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(BaseModel):
    media_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    message: Optional[str] = None
    reminder_date: Optional[datetime] = None
    reminder_type: Optional[str] = None
    is_sent: Optional[bool] = None


class ReminderResponse(ReminderBase):
    id: int
    is_sent: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==================== Dashboard / Reports ====================

class DashboardStats(BaseModel):
    total_media: int
    total_movies: int
    total_webseries: int
    total_shows: int
    total_music: int
    total_links: int
    total_tasks: int
    status_distribution: dict
    category_distribution: dict
    tag_distribution: Optional[dict] = None


class ReportFilter(BaseModel):
    media_category: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ReportResponse(BaseModel):
    total_items: int
    by_category: dict
    by_status: dict
    by_rating: dict
    by_tags: Optional[dict] = None
    items: List[MediaContentResponse]


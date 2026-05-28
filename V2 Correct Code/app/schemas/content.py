"""
Pydantic schemas for Content — request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ContentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, examples=["Sample Report"])
    category: str = Field(..., min_length=1, max_length=100, examples=["reports"])
    description: Optional[str] = Field(None, examples=["A quarterly report summary."])
    status: Optional[str] = Field("active", examples=["active"])
    tags: Optional[str] = Field(None, max_length=500, examples=["quarterly, finance"])
    is_published: Optional[bool] = Field(False)
    publication_date: Optional[datetime] = Field(None, examples=["2026-06-01T09:00:00Z"])


class ContentCreate(ContentBase):
    pass


class ContentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    is_published: Optional[bool] = None
    publication_date: Optional[datetime] = None


class ContentResponse(ContentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel):
    items: list[ContentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

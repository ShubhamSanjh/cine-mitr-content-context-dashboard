"""
Media Content CRUD API endpoints.
Handles movies, web series, shows, and music management.
"""

import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.media import MediaContent
from app.schemas.media import (
    MediaContentCreate,
    MediaContentUpdate,
    MediaContentResponse,
    MediaContentPaginatedResponse,
)

router = APIRouter(prefix="/media")


# ---------- CREATE ----------
@router.post("/", response_model=MediaContentResponse, status_code=201, summary="Create media content")
def create_media(payload: MediaContentCreate, db: Session = Depends(get_db)):
    """Create a new media content record (movie, web series, show, or music)."""
    data = payload.model_dump()
    data["media_name"] = data["media_name"].strip().title()
    record = MediaContent(**data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------- LIST (paginated with filters) ----------
@router.get("/", response_model=MediaContentPaginatedResponse, summary="List media content (paginated)")
def list_media(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    media_category: str | None = Query(None, description="Filter by category: movies, webseries, shows, music"),
    genre: str | None = Query(None, description="Filter by genre"),
    search: str | None = Query(None, description="Search by name"),
    db: Session = Depends(get_db),
):
    """List all media content with optional filters and pagination."""
    query = db.query(MediaContent)
    if media_category:
        query = query.filter(MediaContent.media_category == media_category)
    if genre:
        query = query.filter(MediaContent.genre.ilike(f"%{genre}%"))
    if search:
        query = query.filter(MediaContent.media_name.ilike(f"%{search}%"))

    total = query.count()
    items = query.order_by(MediaContent.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return MediaContentPaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


# ---------- GET by ID ----------
@router.get("/{media_id}", response_model=MediaContentResponse, summary="Get media by ID")
def get_media(media_id: int, db: Session = Depends(get_db)):
    record = db.query(MediaContent).filter(MediaContent.id == media_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Media content not found")
    return record


# ---------- UPDATE ----------
@router.put("/{media_id}", response_model=MediaContentResponse, summary="Update media content")
def update_media(media_id: int, payload: MediaContentUpdate, db: Session = Depends(get_db)):
    record = db.query(MediaContent).filter(MediaContent.id == media_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Media content not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "media_name" in update_data and update_data["media_name"]:
        update_data["media_name"] = update_data["media_name"].strip().title()
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


# ---------- DELETE ----------
@router.delete("/{media_id}", status_code=204, summary="Delete media content")
def delete_media(media_id: int, db: Session = Depends(get_db)):
    record = db.query(MediaContent).filter(MediaContent.id == media_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Media content not found")
    db.delete(record)
    db.commit()
    return None


# ---------- GET by Category ----------
@router.get("/category/{category}", response_model=MediaContentPaginatedResponse, summary="Get media by category")
def get_media_by_category(
    category: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Get all media filtered by category (movies, webseries, shows, music)."""
    query = db.query(MediaContent).filter(MediaContent.media_category == category)
    total = query.count()
    items = query.order_by(MediaContent.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return MediaContentPaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


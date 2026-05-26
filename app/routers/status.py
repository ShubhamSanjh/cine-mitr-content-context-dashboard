"""
Content Ideas and Status API endpoints.
Manages status updates (reviewed, proceed, stopped, in_progress, revived, etc.)
Validates statuses dynamically against the status_definitions table.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.media import MediaStatus, MediaContent, StatusDefinition
from app.schemas.media import (
    MediaStatusCreate,
    MediaStatusUpdate,
    MediaStatusResponse,
)

router = APIRouter(prefix="/media-status")

# Fallback statuses if no status_definitions exist in the DB
FALLBACK_STATUSES = ["reviewed", "proceed", "stopped", "in_progress", "revived", "planned", "cancelled"]


def get_valid_status_names(db: Session) -> list[str]:
    """Get valid status names from status_definitions table (status_tracking + all contexts)."""
    defs = db.query(StatusDefinition.name).filter(
        StatusDefinition.is_active == "true",
        (StatusDefinition.usage_context == "status_tracking") | (StatusDefinition.usage_context == "all")
    ).all()
    names = [d.name for d in defs]
    return names if names else FALLBACK_STATUSES


# ---------- CREATE ----------
@router.post("/", response_model=MediaStatusResponse, status_code=201, summary="Create media status")
def create_status(payload: MediaStatusCreate, db: Session = Depends(get_db)):
    """Add a status entry for a media item."""
    # Verify media exists
    media = db.query(MediaContent).filter(MediaContent.id == payload.media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media content not found")

    valid = get_valid_status_names(db)
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    record = MediaStatus(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------- DUPLICATE ----------
@router.post("/{status_id}/duplicate", response_model=MediaStatusResponse, status_code=201, summary="Duplicate a status entry")
def duplicate_status(status_id: int, db: Session = Depends(get_db)):
    """Duplicate an existing status entry so it can be edited independently."""
    original = db.query(MediaStatus).filter(MediaStatus.id == status_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Status record not found")

    new_record = MediaStatus(
        media_id=original.media_id,
        status=original.status,
        notes=original.notes,
        tags=original.tags,
        updated_by=original.updated_by,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


# ---------- LIST by Media ----------
@router.get("/by-media/{media_id}", response_model=List[MediaStatusResponse], summary="Get statuses for media")
def get_statuses_by_media(media_id: int, db: Session = Depends(get_db)):
    """Get all status entries for a specific media item."""
    return db.query(MediaStatus).filter(MediaStatus.media_id == media_id).order_by(MediaStatus.updated_at.desc()).all()


# ---------- LIST all ----------
@router.get("/", response_model=List[MediaStatusResponse], summary="List all media statuses")
def list_statuses(
    status: str | None = Query(None, description="Filter by status"),
    tags: str | None = Query(None, description="Filter by tags"),
    db: Session = Depends(get_db),
):
    """List all media status records with optional status and tags filter. Sorted by updated_at desc."""
    query = db.query(MediaStatus)
    if status:
        query = query.filter(MediaStatus.status == status)
    if tags:
        query = query.filter(MediaStatus.tags.ilike(f"%{tags}%"))
    return query.order_by(MediaStatus.updated_at.desc()).all()


# ---------- GET valid statuses ----------
@router.get("/valid-statuses", summary="Get list of valid statuses")
def get_valid_statuses(db: Session = Depends(get_db)):
    """Return list of valid status values for dropdown (dynamically from status_definitions)."""
    return {"statuses": get_valid_status_names(db)}


# ---------- UPDATE ----------
@router.put("/{status_id}", response_model=MediaStatusResponse, summary="Update media status")
def update_status(status_id: int, payload: MediaStatusUpdate, db: Session = Depends(get_db)):
    record = db.query(MediaStatus).filter(MediaStatus.id == status_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Status record not found")

    if payload.status:
        valid = get_valid_status_names(db)
        if payload.status not in valid:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


# ---------- DELETE ----------
@router.delete("/{status_id}", status_code=204, summary="Delete media status")
def delete_status(status_id: int, db: Session = Depends(get_db)):
    record = db.query(MediaStatus).filter(MediaStatus.id == status_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Status record not found")
    db.delete(record)
    db.commit()
    return None


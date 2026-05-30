"""
Content Ideas and Status API endpoints.
Manages status updates (reviewed, proceed, stopped, in_progress, revived, etc.)
Validates statuses dynamically against the status_definitions table.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.media import MediaStatus, MediaContent, StatusDefinition, MediaLink
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


# ---------- SEARCH (Media + Links combined) ----------
@router.get("/search-all", summary="Search media and links for Add Status")
def search_media_and_links(
    q: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    db: Session = Depends(get_db),
):
    """
    Search media by name AND links by URL/media_name.
    Returns combined results so user can pick from either source.
    Used in the Add Status popup for quick lookup.
    """
    # Search media by name
    media_results = db.query(MediaContent).filter(
        MediaContent.media_name.ilike(f"%{q}%")
    ).limit(10).all()

    # Search links by URL or by associated media name
    link_results = db.query(MediaLink).filter(
        (MediaLink.url.ilike(f"%{q}%")) |
        (MediaLink.description.ilike(f"%{q}%"))
    ).limit(10).all()

    # Also search links via media name
    media_name_ids = [m.id for m in media_results]
    link_by_media = db.query(MediaLink).filter(
        MediaLink.media_id.in_(media_name_ids)
    ).limit(10).all() if media_name_ids else []

    # Combine link results, dedup by id
    link_ids_seen = set()
    all_links = []
    for lnk in link_results + link_by_media:
        if lnk.id not in link_ids_seen:
            link_ids_seen.add(lnk.id)
            all_links.append(lnk)

    # Load media map for link results
    link_media_ids = {lnk.media_id for lnk in all_links}
    media_map = {m.id: m for m in db.query(MediaContent).filter(MediaContent.id.in_(link_media_ids)).all()} if link_media_ids else {}

    return {
        "media": [
            {
                "id": m.id,
                "media_name": m.media_name,
                "media_category": m.media_category,
                "source": "media",
            }
            for m in media_results
        ],
        "links": [
            {
                "link_id": lnk.id,
                "media_id": lnk.media_id,
                "media_name": media_map[lnk.media_id].media_name if lnk.media_id in media_map else f"#{lnk.media_id}",
                "media_category": media_map[lnk.media_id].media_category if lnk.media_id in media_map else "",
                "platform": lnk.platform,
                "url": lnk.url,
                "link_status": lnk.link_status,
                "source": "link",
            }
            for lnk in all_links[:15]
        ],
    }


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


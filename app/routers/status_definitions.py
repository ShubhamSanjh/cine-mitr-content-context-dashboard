"""
Status Definitions Management API.
Manages reusable status names that can be used across Link Content and Status Tracking.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.media import StatusDefinition

router = APIRouter(prefix="/status-definitions")


# --- Schemas ---
class StatusDefCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = None
    description: Optional[str] = None
    usage_context: Optional[str] = "all"


class StatusDefUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[str] = None
    usage_context: Optional[str] = None


class StatusDefResponse(BaseModel):
    id: int
    name: str
    label: str
    color: Optional[str] = None
    description: Optional[str] = None
    is_active: str
    usage_context: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Endpoints ---

@router.get("/", response_model=List[StatusDefResponse], summary="List all status definitions")
def list_status_definitions(
    context: str | None = None,
    db: Session = Depends(get_db),
):
    """List all status definitions, optionally filtered by usage context."""
    query = db.query(StatusDefinition).filter(StatusDefinition.is_active == "true")
    if context:
        query = query.filter(
            (StatusDefinition.usage_context == context) | (StatusDefinition.usage_context == "all")
        )
    return query.order_by(StatusDefinition.name).all()


@router.get("/all", response_model=List[StatusDefResponse], summary="List all (including inactive)")
def list_all_status_definitions(db: Session = Depends(get_db)):
    """List all status definitions including inactive ones."""
    return db.query(StatusDefinition).order_by(StatusDefinition.created_at.desc()).all()


@router.post("/", response_model=StatusDefResponse, status_code=201, summary="Create status definition")
def create_status_definition(payload: StatusDefCreate, db: Session = Depends(get_db)):
    """Create a new reusable status name."""
    existing = db.query(StatusDefinition).filter(StatusDefinition.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Status '{payload.name}' already exists")

    record = StatusDefinition(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{def_id}", response_model=StatusDefResponse, summary="Update status definition")
def update_status_definition(def_id: int, payload: StatusDefUpdate, db: Session = Depends(get_db)):
    record = db.query(StatusDefinition).filter(StatusDefinition.id == def_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Status definition not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{def_id}", status_code=204, summary="Delete status definition")
def delete_status_definition(def_id: int, db: Session = Depends(get_db)):
    record = db.query(StatusDefinition).filter(StatusDefinition.id == def_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Status definition not found")
    db.delete(record)
    db.commit()
    return None


@router.post("/seed", summary="Seed default statuses")
def seed_default_statuses(db: Session = Depends(get_db)):
    """Seed the default status definitions if they don't exist."""
    defaults = [
        {"name": "planning", "label": "Planning", "color": "violet", "usage_context": "all"},
        {"name": "watching", "label": "Watching", "color": "blue", "usage_context": "all"},
        {"name": "completed", "label": "Completed", "color": "green", "usage_context": "all"},
        {"name": "on_hold", "label": "On Hold", "color": "yellow", "usage_context": "all"},
        {"name": "dropped", "label": "Dropped", "color": "red", "usage_context": "all"},
        {"name": "rewatching", "label": "Rewatching", "color": "purple", "usage_context": "all"},
        {"name": "recommended", "label": "Recommended", "color": "green", "usage_context": "all"},
        {"name": "not_interested", "label": "Not Interested", "color": "gray", "usage_context": "all"},
        {"name": "custom", "label": "Custom", "color": "orange", "usage_context": "all"},
        {"name": "reviewed", "label": "Reviewed", "color": "green", "usage_context": "status_tracking"},
        {"name": "proceed", "label": "Proceed", "color": "blue", "usage_context": "status_tracking"},
        {"name": "stopped", "label": "Stopped", "color": "red", "usage_context": "status_tracking"},
        {"name": "in_progress", "label": "In Progress", "color": "yellow", "usage_context": "status_tracking"},
        {"name": "revived", "label": "Revived", "color": "purple", "usage_context": "status_tracking"},
        {"name": "planned", "label": "Planned", "color": "violet", "usage_context": "status_tracking"},
        {"name": "cancelled", "label": "Cancelled", "color": "gray", "usage_context": "status_tracking"},
        {"name": "active", "label": "Active", "color": "green", "usage_context": "links"},
        {"name": "inactive", "label": "Inactive", "color": "gray", "usage_context": "links"},
        # Social Media / Content Creation statuses
        {"name": "idea", "label": "Idea", "color": "violet", "usage_context": "social_media"},
        {"name": "scripting", "label": "Scripting", "color": "indigo", "usage_context": "social_media"},
        {"name": "recording", "label": "Recording", "color": "blue", "usage_context": "social_media"},
        {"name": "editing_in_progress", "label": "Editing In Progress", "color": "yellow", "usage_context": "social_media"},
        {"name": "ready_for_review", "label": "Ready For Review", "color": "orange", "usage_context": "social_media"},
        {"name": "revisions_needed", "label": "Revisions Needed", "color": "red", "usage_context": "social_media"},
        {"name": "ready_to_upload", "label": "Ready To Upload", "color": "teal", "usage_context": "social_media"},
        {"name": "scheduled", "label": "Scheduled", "color": "cyan", "usage_context": "social_media"},
        {"name": "uploaded", "label": "Uploaded", "color": "green", "usage_context": "social_media"},
        {"name": "published", "label": "Published", "color": "green", "usage_context": "social_media"},
        {"name": "blocked_by_platform", "label": "Blocked By Platform", "color": "red", "usage_context": "social_media"},
        {"name": "copyright_claim", "label": "Copyright Claim", "color": "red", "usage_context": "social_media"},
        {"name": "under_review_platform", "label": "Under Review (Platform)", "color": "orange", "usage_context": "social_media"},
        {"name": "demonetized", "label": "Demonetized", "color": "gray", "usage_context": "social_media"},
        {"name": "trending", "label": "Trending", "color": "pink", "usage_context": "social_media"},
        {"name": "archived", "label": "Archived", "color": "gray", "usage_context": "social_media"},
        {"name": "repurposing", "label": "Repurposing", "color": "purple", "usage_context": "social_media"},
        {"name": "collaboration_pending", "label": "Collaboration Pending", "color": "blue", "usage_context": "social_media"},
        {"name": "awaiting_assets", "label": "Awaiting Assets", "color": "yellow", "usage_context": "social_media"},
        {"name": "failed_upload", "label": "Failed Upload", "color": "red", "usage_context": "social_media"},
        {"name": "unlisted", "label": "Unlisted", "color": "gray", "usage_context": "social_media"},
        {"name": "privated", "label": "Privated", "color": "gray", "usage_context": "social_media"},
    ]
    created = 0
    for d in defaults:
        existing = db.query(StatusDefinition).filter(StatusDefinition.name == d["name"]).first()
        if not existing:
            db.add(StatusDefinition(**d))
            created += 1
    db.commit()
    return {"message": f"Seeded {created} status definitions", "total": len(defaults)}


"""
Content CRUD API endpoints.
Full dummy implementation for testing — swap service layer for real logic later.
"""

import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.content import Content
from app.schemas.content import (
    ContentCreate,
    ContentUpdate,
    ContentResponse,
    PaginatedResponse,
)

router = APIRouter(prefix="/contents")


# ---------- CREATE ----------
@router.post("/", response_model=ContentResponse, status_code=201, summary="Create content")
def create_content(payload: ContentCreate, db: Session = Depends(get_db)):
    record = Content(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------- LIST (paginated) ----------
@router.get("/", response_model=PaginatedResponse, summary="List contents (paginated)")
def list_contents(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category: str | None = Query(None, description="Filter by category"),
    status: str | None = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
):
    query = db.query(Content)
    if category:
        query = query.filter(Content.category == category)
    if status:
        query = query.filter(Content.status == status)

    total = query.count()
    items = query.order_by(Content.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


# ---------- GET ----------
@router.get("/{content_id}", response_model=ContentResponse, summary="Get content by ID")
def get_content(content_id: int, db: Session = Depends(get_db)):
    record = db.query(Content).filter(Content.id == content_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Content not found")
    return record


# ---------- UPDATE ----------
@router.put("/{content_id}", response_model=ContentResponse, summary="Update content")
def update_content(content_id: int, payload: ContentUpdate, db: Session = Depends(get_db)):
    record = db.query(Content).filter(Content.id == content_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Content not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


# ---------- DELETE ----------
@router.delete("/{content_id}", status_code=204, summary="Delete content")
def delete_content(content_id: int, db: Session = Depends(get_db)):
    record = db.query(Content).filter(Content.id == content_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Content not found")
    db.delete(record)
    db.commit()
    return None


# ---------- SEED (dummy data loader) ----------
@router.post("/seed", summary="Seed dummy data for testing")
def seed_data(db: Session = Depends(get_db)):
    """Insert sample records for quick testing."""
    samples = [
        Content(title="Q1 Revenue Report", category="reports", description="First quarter financial summary.", status="active", is_published=True),
        Content(title="Marketing Plan 2026", category="plans", description="Full-year marketing strategy.", status="draft", is_published=False),
        Content(title="User Analytics Dashboard", category="analytics", description="Monthly user metrics overview.", status="active", is_published=True),
        Content(title="API Migration Guide", category="documentation", description="Steps for migrating to v2 API.", status="review", is_published=False),
        Content(title="Security Audit Log", category="reports", description="Annual security findings.", status="active", is_published=True),
        Content(title="Infrastructure Cost Forecast", category="analytics", description="Cloud spend projection for next quarter.", status="draft", is_published=False),
    ]
    db.add_all(samples)
    db.commit()
    return {"message": f"{len(samples)} sample records inserted."}

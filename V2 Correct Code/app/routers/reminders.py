"""
Reminders CRUD API endpoints.
Manages reminders for content deadlines and publication dates.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.database import get_db
from app.models.media import Reminder, MediaContent
from app.schemas.media import (
    ReminderCreate,
    ReminderUpdate,
    ReminderResponse,
)

router = APIRouter(prefix="/reminders")


# ---------- CREATE ----------
@router.post("/", response_model=ReminderResponse, status_code=201, summary="Create a reminder")
def create_reminder(payload: ReminderCreate, db: Session = Depends(get_db)):
    """Create a reminder for a content deadline or publication date."""
    if payload.media_id:
        media = db.query(MediaContent).filter(MediaContent.id == payload.media_id).first()
        if not media:
            raise HTTPException(status_code=404, detail="Media content not found")

    record = Reminder(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------- LIST ----------
@router.get("/", response_model=List[ReminderResponse], summary="List all reminders")
def list_reminders(
    media_id: int | None = Query(None, description="Filter by media ID"),
    reminder_type: str | None = Query(None, description="Filter by type: deadline, publication, custom"),
    upcoming: bool = Query(False, description="Only show upcoming (not sent) reminders"),
    db: Session = Depends(get_db),
):
    """List all reminders with optional filters. Sorted by reminder_date asc."""
    query = db.query(Reminder)
    if media_id:
        query = query.filter(Reminder.media_id == media_id)
    if reminder_type:
        query = query.filter(Reminder.reminder_type == reminder_type)
    if upcoming:
        query = query.filter(Reminder.is_sent == False, Reminder.reminder_date >= datetime.now(timezone.utc))
    return query.order_by(Reminder.reminder_date.asc()).all()


# ---------- GET ----------
@router.get("/{reminder_id}", response_model=ReminderResponse, summary="Get reminder by ID")
def get_reminder(reminder_id: int, db: Session = Depends(get_db)):
    record = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return record


# ---------- UPDATE ----------
@router.put("/{reminder_id}", response_model=ReminderResponse, summary="Update reminder")
def update_reminder(reminder_id: int, payload: ReminderUpdate, db: Session = Depends(get_db)):
    record = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Reminder not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


# ---------- MARK AS SENT ----------
@router.post("/{reminder_id}/mark-sent", response_model=ReminderResponse, summary="Mark reminder as sent")
def mark_reminder_sent(reminder_id: int, db: Session = Depends(get_db)):
    record = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Reminder not found")
    record.is_sent = True
    db.commit()
    db.refresh(record)
    return record


# ---------- DELETE ----------
@router.delete("/{reminder_id}", status_code=204, summary="Delete reminder")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    record = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(record)
    db.commit()
    return None


"""
Calendar API endpoints.
Provides calendar events combining media release dates, task due dates, and reminders.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models.media import MediaContent, TodoTask, Reminder

router = APIRouter(prefix="/calendar")


@router.get("/events", summary="Get calendar events for a date range")
def get_calendar_events(
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    db: Session = Depends(get_db),
):
    """Get all calendar events (media releases, task due dates, reminders) within a date range."""
    events = []

    # Media release dates
    media_items = db.query(MediaContent).filter(
        MediaContent.release_date >= start_date,
        MediaContent.release_date <= end_date,
    ).all()
    for m in media_items:
        events.append({
            "id": f"media-{m.id}",
            "title": m.media_name,
            "date": str(m.release_date),
            "type": "release",
            "category": m.media_category,
            "color": "#3b82f6",
        })

    # Task due dates
    tasks = db.query(TodoTask).filter(
        TodoTask.due_date >= start_date,
        TodoTask.due_date <= end_date,
    ).all()
    for t in tasks:
        events.append({
            "id": f"task-{t.id}",
            "title": t.title,
            "date": str(t.due_date),
            "type": "task",
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "color": "#f59e0b" if t.priority == "high" else "#22c55e",
        })

    # Reminders
    reminders = db.query(Reminder).filter(
        Reminder.reminder_date >= str(start_date),
        Reminder.reminder_date <= str(end_date) + "T23:59:59",
        Reminder.is_sent == False,
    ).all()
    for r in reminders:
        events.append({
            "id": f"reminder-{r.id}",
            "title": r.title,
            "date": str(r.reminder_date.date()) if r.reminder_date else "",
            "type": "reminder",
            "reminder_type": r.reminder_type,
            "color": "#ef4444",
        })

    # Sort by date
    events.sort(key=lambda x: x["date"])
    return events


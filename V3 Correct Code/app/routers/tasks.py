"""
Todo Tasks CRUD API endpoints.
Manages tasks with calendar integration, reminders, and priorities.
"""

import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app.models.media import TodoTask
from app.schemas.media import (
    TodoTaskCreate,
    TodoTaskUpdate,
    TodoTaskResponse,
)

router = APIRouter(prefix="/tasks")


# ---------- CREATE ----------
@router.post("/", response_model=TodoTaskResponse, status_code=201, summary="Create a todo task")
def create_task(payload: TodoTaskCreate, db: Session = Depends(get_db)):
    """Create a new todo task."""
    record = TodoTask(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------- LIST ----------
@router.get("/", response_model=List[TodoTaskResponse], summary="List all tasks")
def list_tasks(
    status: str | None = Query(None, description="Filter by status"),
    priority: str | None = Query(None, description="Filter by priority"),
    category: str | None = Query(None, description="Filter by category"),
    due_date: date | None = Query(None, description="Filter by due date"),
    db: Session = Depends(get_db),
):
    """List all tasks with optional filters."""
    query = db.query(TodoTask)
    if status:
        query = query.filter(TodoTask.status == status)
    if priority:
        query = query.filter(TodoTask.priority == priority)
    if category:
        query = query.filter(TodoTask.category == category)
    if due_date:
        query = query.filter(TodoTask.due_date == due_date)
    return query.order_by(TodoTask.due_date.asc().nullslast(), TodoTask.created_at.desc()).all()


# ---------- GET by Date Range (Calendar) ----------
@router.get("/calendar", response_model=List[TodoTaskResponse], summary="Get tasks for calendar view")
def get_tasks_calendar(
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    db: Session = Depends(get_db),
):
    """Get tasks within a date range for calendar display."""
    return (
        db.query(TodoTask)
        .filter(TodoTask.due_date >= start_date, TodoTask.due_date <= end_date)
        .order_by(TodoTask.due_date.asc())
        .all()
    )


# ---------- GET ----------
@router.get("/{task_id}", response_model=TodoTaskResponse, summary="Get task by ID")
def get_task(task_id: int, db: Session = Depends(get_db)):
    record = db.query(TodoTask).filter(TodoTask.id == task_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Task not found")
    return record


# ---------- UPDATE ----------
@router.put("/{task_id}", response_model=TodoTaskResponse, summary="Update task")
def update_task(task_id: int, payload: TodoTaskUpdate, db: Session = Depends(get_db)):
    record = db.query(TodoTask).filter(TodoTask.id == task_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


# ---------- DELETE ----------
@router.delete("/{task_id}", status_code=204, summary="Delete task")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    record = db.query(TodoTask).filter(TodoTask.id == task_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(record)
    db.commit()
    return None


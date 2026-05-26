"""
Dashboard and Reports API endpoints.
Provides aggregated statistics, reporting, and data export capabilities.
"""

import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date

from app.database import get_db
from app.models.media import MediaContent, MediaLink, MediaStatus, TodoTask
from app.schemas.media import DashboardStats, ReportResponse, MediaContentResponse

router = APIRouter(prefix="/dashboard")


def _get_tag_distribution(media_items):
    """Build tag frequency map from media items."""
    tag_counts = {}
    for m in media_items:
        if m.tags:
            for tag in m.tags.split(","):
                tag = tag.strip().lower()
                if tag:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
    return tag_counts


# ---------- DASHBOARD STATS ----------
@router.get("/stats", response_model=DashboardStats, summary="Get dashboard statistics")
def get_dashboard_stats(
    media_category: Optional[str] = Query(None, description="Filter by media category"),
    db: Session = Depends(get_db),
):
    """Get overall dashboard statistics — media counts, status distribution, etc."""
    base_query = db.query(MediaContent)
    if media_category:
        base_query = base_query.filter(MediaContent.media_category == media_category)

    total_media = base_query.count()
    total_movies = base_query.filter(MediaContent.media_category == "movies").count() if not media_category else (total_media if media_category == "movies" else 0)
    total_webseries = base_query.filter(MediaContent.media_category == "webseries").count() if not media_category else (total_media if media_category == "webseries" else 0)
    total_shows = base_query.filter(MediaContent.media_category == "shows").count() if not media_category else (total_media if media_category == "shows" else 0)
    total_music = base_query.filter(MediaContent.media_category == "music").count() if not media_category else (total_media if media_category == "music" else 0)

    # Filter links/tasks by media category if specified
    if media_category:
        media_ids = [m.id for m in base_query.all()]
        total_links = db.query(MediaLink).filter(MediaLink.media_id.in_(media_ids)).count() if media_ids else 0
        status_rows = db.query(MediaStatus.status, func.count(MediaStatus.id)).filter(
            MediaStatus.media_id.in_(media_ids)
        ).group_by(MediaStatus.status).all() if media_ids else []
    else:
        total_links = db.query(MediaLink).count()
        status_rows = db.query(MediaStatus.status, func.count(MediaStatus.id)).group_by(MediaStatus.status).all()

    total_tasks = db.query(TodoTask).count()
    status_distribution = {row[0]: row[1] for row in status_rows}

    # Category distribution
    if media_category:
        category_distribution = {media_category: total_media}
    else:
        category_rows = db.query(MediaContent.media_category, func.count(MediaContent.id)).group_by(MediaContent.media_category).all()
        category_distribution = {row[0]: row[1] for row in category_rows}

    return DashboardStats(
        total_media=total_media,
        total_movies=total_movies,
        total_webseries=total_webseries,
        total_shows=total_shows,
        total_music=total_music,
        total_links=total_links,
        total_tasks=total_tasks,
        status_distribution=status_distribution,
        category_distribution=category_distribution,
        tag_distribution=_get_tag_distribution(base_query.all()),
    )


# ---------- REPORTS ----------
@router.get("/reports", response_model=ReportResponse, summary="Generate filtered report")
def generate_report(
    media_category: Optional[str] = Query(None, description="Filter by media category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    db: Session = Depends(get_db),
):
    """Generate a filtered report on media content with aggregated analytics."""
    query = db.query(MediaContent)

    if media_category:
        query = query.filter(MediaContent.media_category == media_category)
    if start_date:
        query = query.filter(MediaContent.release_date >= start_date)
    if end_date:
        query = query.filter(MediaContent.release_date <= end_date)

    # If status filter, join with media_status
    if status:
        media_ids = [
            row[0] for row in db.query(MediaStatus.media_id).filter(MediaStatus.status == status).distinct().all()
        ]
        query = query.filter(MediaContent.id.in_(media_ids))

    items = query.order_by(MediaContent.updated_at.desc()).all()

    # Aggregations
    by_category = {}
    by_status_map = {}
    by_rating = {"0-2": 0, "2-4": 0, "4-6": 0, "6-8": 0, "8-10": 0}

    for item in items:
        # Category count
        by_category[item.media_category] = by_category.get(item.media_category, 0) + 1

        # Rating distribution
        if item.rating is not None:
            if item.rating <= 2:
                by_rating["0-2"] += 1
            elif item.rating <= 4:
                by_rating["2-4"] += 1
            elif item.rating <= 6:
                by_rating["4-6"] += 1
            elif item.rating <= 8:
                by_rating["6-8"] += 1
            else:
                by_rating["8-10"] += 1

    # Status aggregation
    for item in items:
        statuses = db.query(MediaStatus).filter(MediaStatus.media_id == item.id).all()
        for s in statuses:
            by_status_map[s.status] = by_status_map.get(s.status, 0) + 1

    return ReportResponse(
        total_items=len(items),
        by_category=by_category,
        by_status=by_status_map,
        by_rating=by_rating,
        items=items,
    )


# ---------- EXPORT CSV ----------
@router.get("/export/csv", summary="Export media data as CSV")
def export_csv(
    media_category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Export media content data as a downloadable CSV file."""
    query = db.query(MediaContent)
    if media_category:
        query = query.filter(MediaContent.media_category == media_category)

    items = query.order_by(MediaContent.updated_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Category", "Name", "Release Date", "Genre", "Director", "Cast", "Rating", "Review"])

    for item in items:
        writer.writerow([
            item.id, item.media_category, item.media_name,
            item.release_date, item.genre, item.director,
            item.cast_members, item.rating, item.review,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=media_report.csv"},
    )


# ---------- STATISTICS (Tab 7) ----------
@router.get("/statistics", summary="Get media statistics overview")
def get_statistics(
    media_category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get comprehensive statistics — counts by status, category, and progress."""
    query = db.query(MediaContent)
    if media_category:
        query = query.filter(MediaContent.media_category == media_category)

    total = query.count()
    media_ids = [m.id for m in query.all()]

    # Status counts
    status_query = db.query(MediaStatus.status, func.count(MediaStatus.id)).filter(
        MediaStatus.media_id.in_(media_ids) if media_ids else MediaStatus.media_id == -1
    ).group_by(MediaStatus.status).all()

    status_counts = {row[0]: row[1] for row in status_query}

    # Task stats
    pending_tasks = db.query(TodoTask).filter(TodoTask.status == "pending").count()
    in_progress_tasks = db.query(TodoTask).filter(TodoTask.status == "in_progress").count()
    completed_tasks = db.query(TodoTask).filter(TodoTask.status == "completed").count()

    return {
        "total_media": total,
        "status_counts": status_counts,
        "in_progress": status_counts.get("in_progress", 0),
        "stopped": status_counts.get("stopped", 0),
        "reviewed": status_counts.get("reviewed", 0),
        "revived": status_counts.get("revived", 0),
        "tasks": {
            "pending": pending_tasks,
            "in_progress": in_progress_tasks,
            "completed": completed_tasks,
        },
    }


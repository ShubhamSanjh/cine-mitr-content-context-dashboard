"""
Analytics Dashboard API endpoints.
Provides dynamic performance tracking and analysis data.
Conditionally enabled via ANALYTICS_ENABLED config.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.database import get_db
from app.models.media import MediaContent, MediaLink, MediaStatus, TodoTask

router = APIRouter(prefix="/analytics")


@router.get("/config", summary="Get analytics dashboard configuration")
def get_analytics_config():
    """Returns whether the analytics dashboard is enabled (for frontend show/hide)."""
    from app.config import get_settings
    settings = get_settings()
    return {"enabled": settings.ANALYTICS_ENABLED}


@router.get("/overview", summary="Get full analytics overview")
def get_analytics_overview(
    media_category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Dynamic analytics overview: tag distribution, highest-rated media, platform stats, etc."""
    base_query = db.query(MediaContent)
    if media_category:
        base_query = base_query.filter(MediaContent.media_category == media_category)

    all_media = base_query.all()

    # Tag distribution
    tag_counts = {}
    for m in all_media:
        if m.tags:
            for tag in m.tags.split(","):
                tag = tag.strip().lower()
                if tag:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Highest rated media (top 10)
    top_rated = sorted(
        [m for m in all_media if m.rating is not None],
        key=lambda x: x.rating,
        reverse=True
    )[:10]

    # Category counts
    category_counts = {}
    for m in all_media:
        category_counts[m.media_category] = category_counts.get(m.media_category, 0) + 1

    # Platform link distribution
    links = db.query(MediaLink.platform, func.count(MediaLink.id)).group_by(MediaLink.platform).all()
    platform_distribution = {row[0]: row[1] for row in links}

    # Status distribution
    statuses = db.query(MediaStatus.status, func.count(MediaStatus.id)).group_by(MediaStatus.status).all()
    status_distribution = {row[0]: row[1] for row in statuses}

    # Media with most links
    media_link_counts = db.query(
        MediaLink.media_id, func.count(MediaLink.id).label("count")
    ).group_by(MediaLink.media_id).order_by(func.count(MediaLink.id).desc()).limit(10).all()
    most_linked = []
    for media_id, count in media_link_counts:
        media = db.query(MediaContent).filter(MediaContent.id == media_id).first()
        if media:
            most_linked.append({"id": media.id, "name": media.media_name, "category": media.media_category, "link_count": count})

    # Availability stats
    available_count = sum(1 for m in all_media if m.is_available == "true")
    unavailable_count = len(all_media) - available_count

    # Tasks summary
    task_stats = {
        "total": db.query(TodoTask).count(),
        "pending": db.query(TodoTask).filter(TodoTask.status == "pending").count(),
        "in_progress": db.query(TodoTask).filter(TodoTask.status == "in_progress").count(),
        "completed": db.query(TodoTask).filter(TodoTask.status == "completed").count(),
    }

    return {
        "total_media": len(all_media),
        "tag_distribution": tag_counts,
        "top_rated": [
            {"id": m.id, "name": m.media_name, "category": m.media_category, "rating": m.rating, "tags": m.tags}
            for m in top_rated
        ],
        "category_counts": category_counts,
        "platform_distribution": platform_distribution,
        "status_distribution": status_distribution,
        "most_linked_media": most_linked,
        "availability": {"available": available_count, "unavailable": unavailable_count},
        "task_stats": task_stats,
    }


@router.get("/tag-stats", summary="Get detailed tag statistics")
def get_tag_stats(db: Session = Depends(get_db)):
    """Get statistics for all tags across media, status, and links."""
    tag_data = {}

    # Media tags
    for m in db.query(MediaContent).filter(MediaContent.tags.isnot(None)).all():
        for tag in m.tags.split(","):
            tag = tag.strip().lower()
            if tag:
                if tag not in tag_data:
                    tag_data[tag] = {"media_count": 0, "status_count": 0, "link_count": 0}
                tag_data[tag]["media_count"] += 1

    # Status tags
    for s in db.query(MediaStatus).filter(MediaStatus.tags.isnot(None)).all():
        for tag in s.tags.split(","):
            tag = tag.strip().lower()
            if tag:
                if tag not in tag_data:
                    tag_data[tag] = {"media_count": 0, "status_count": 0, "link_count": 0}
                tag_data[tag]["status_count"] += 1

    # Link tags
    for l in db.query(MediaLink).filter(MediaLink.tags.isnot(None)).all():
        for tag in l.tags.split(","):
            tag = tag.strip().lower()
            if tag:
                if tag not in tag_data:
                    tag_data[tag] = {"media_count": 0, "status_count": 0, "link_count": 0}
                tag_data[tag]["link_count"] += 1

    # Sort by total usage
    sorted_tags = sorted(
        tag_data.items(),
        key=lambda x: x[1]["media_count"] + x[1]["status_count"] + x[1]["link_count"],
        reverse=True
    )

    return {"tags": [{"name": k, **v, "total": v["media_count"] + v["status_count"] + v["link_count"]} for k, v in sorted_tags]}


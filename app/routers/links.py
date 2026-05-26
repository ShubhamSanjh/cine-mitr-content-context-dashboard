"""
Media Links CRUD API endpoints.
Manages links (YouTube, Instagram, Twitter, etc.) associated with media content.
Includes: search, edit, download (zip export), status management.
"""

import io
import json
import zipfile
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.media import MediaLink, MediaContent
from app.schemas.media import (
    MediaLinkCreate,
    MediaLinkUpdate,
    MediaLinkResponse,
)

router = APIRouter(prefix="/media-links")


# ---------- CREATE ----------
@router.post("/", response_model=MediaLinkResponse, status_code=201, summary="Create media link")
def create_link(payload: MediaLinkCreate, db: Session = Depends(get_db)):
    """Link an external URL (YouTube, Instagram, Twitter, etc.) to a media item. Rejects duplicate URLs for the same media."""
    media = db.query(MediaContent).filter(MediaContent.id == payload.media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media content not found")

    # Check for duplicate link (URL must be globally unique)
    existing = db.query(MediaLink).filter(
        MediaLink.url == payload.url
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A link with this URL already exists (link_id={existing.id}, media_id={existing.media_id})"
        )

    # Auto-fill link_category from media category if not provided
    data = payload.model_dump()
    if not data.get("link_category"):
        data["link_category"] = media.media_category

    record = MediaLink(**data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------- LIST all (with search & filters) ----------
@router.get("/", response_model=List[MediaLinkResponse], summary="List all media links")
def list_links(
    platform: str | None = Query(None, description="Filter by platform"),
    link_status: str | None = Query(None, description="Filter by link status (active/inactive)"),
    link_category: str | None = Query(None, description="Filter by link category"),
    tags: str | None = Query(None, description="Filter by tags (partial match)"),
    search: str | None = Query(None, description="Search by media name or URL"),
    db: Session = Depends(get_db),
):
    """List all media links with optional filters, tags search, and text search."""
    query = db.query(MediaLink)
    if platform:
        query = query.filter(MediaLink.platform == platform)
    if link_status:
        query = query.filter(MediaLink.link_status == link_status)
    if link_category:
        query = query.filter(MediaLink.link_category == link_category)
    if tags:
        query = query.filter(MediaLink.tags.ilike(f"%{tags}%"))
    if search:
        # Search by URL or join with media name
        media_ids = [
            m.id for m in db.query(MediaContent).filter(
                MediaContent.media_name.ilike(f"%{search}%")
            ).all()
        ]
        query = query.filter(
            (MediaLink.url.ilike(f"%{search}%")) |
            (MediaLink.description.ilike(f"%{search}%")) |
            (MediaLink.media_id.in_(media_ids))
        )
    return query.order_by(MediaLink.created_at.desc()).all()


# ---------- LIST by Media ----------
@router.get("/by-media/{media_id}", response_model=List[MediaLinkResponse], summary="Get links for media")
def get_links_by_media(media_id: int, db: Session = Depends(get_db)):
    """Get all links associated with a specific media item."""
    return db.query(MediaLink).filter(MediaLink.media_id == media_id).all()


# ---------- SEARCH media for dropdown ----------
@router.get("/search-media", summary="Search media for link dropdown")
def search_media_for_link(
    q: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    db: Session = Depends(get_db),
):
    """Search media by name for the link creation dropdown. Returns id, name, category."""
    results = db.query(MediaContent).filter(
        MediaContent.media_name.ilike(f"%{q}%")
    ).limit(20).all()
    return [
        {"id": m.id, "media_name": m.media_name, "media_category": m.media_category}
        for m in results
    ]


# ---------- GET ----------
@router.get("/{link_id}", response_model=MediaLinkResponse, summary="Get link by ID")
def get_link(link_id: int, db: Session = Depends(get_db)):
    record = db.query(MediaLink).filter(MediaLink.id == link_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Link not found")
    return record


# ---------- UPDATE ----------
@router.put("/{link_id}", response_model=MediaLinkResponse, summary="Update media link")
def update_link(link_id: int, payload: MediaLinkUpdate, db: Session = Depends(get_db)):
    record = db.query(MediaLink).filter(MediaLink.id == link_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Link not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


# ---------- DELETE ----------
@router.delete("/{link_id}", status_code=204, summary="Delete media link")
def delete_link(link_id: int, db: Session = Depends(get_db)):
    record = db.query(MediaLink).filter(MediaLink.id == link_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(record)
    db.commit()
    return None


# ---------- DOWNLOAD (ZIP with metadata.json, details.json, media.txt) ----------
@router.get("/download/{link_id}", summary="Download link as zip package")
def download_link(link_id: int, db: Session = Depends(get_db)):
    """Download a link package as ZIP containing metadata.json, details.json, and a media file."""
    record = db.query(MediaLink).filter(MediaLink.id == link_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Link not found")

    media = db.query(MediaContent).filter(MediaContent.id == record.media_id).first()

    metadata = {
        "link_id": record.id,
        "media_id": record.media_id,
        "platform": record.platform,
        "url": record.url,
        "link_status": record.link_status,
        "link_category": record.link_category,
        "created_at": str(record.created_at),
    }

    details = {
        "media_name": media.media_name if media else None,
        "media_category": media.media_category if media else None,
        "genre": media.genre if media else None,
        "director": media.director if media else None,
        "cast_members": media.cast_members if media else None,
        "rating": media.rating if media else None,
        "release_date": str(media.release_date) if media and media.release_date else None,
        "review": media.review if media else None,
        "description": record.description,
    }

    # Create a simple media reference file
    media_content = f"""Media Reference File
====================
Name: {media.media_name if media else 'Unknown'}
Category: {media.media_category if media else 'Unknown'}
Platform: {record.platform}
URL: {record.url}
Status: {record.link_status}
Description: {record.description or 'N/A'}
"""

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("metadata.json", json.dumps(metadata, indent=2))
        zf.writestr("details.json", json.dumps(details, indent=2))
        zf.writestr("media_reference.txt", media_content)

    zip_buffer.seek(0)
    filename = f"link_{record.id}_{record.platform}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------- DOWNLOAD ALL (ZIP) ----------
@router.get("/download-all/export", summary="Download all links as zip")
def download_all_links(
    link_category: str | None = Query(None),
    link_status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Download all links as a single ZIP file with metadata."""
    query = db.query(MediaLink)
    if link_category:
        query = query.filter(MediaLink.link_category == link_category)
    if link_status:
        query = query.filter(MediaLink.link_status == link_status)
    links = query.all()

    all_metadata = []
    all_details = []

    for record in links:
        media = db.query(MediaContent).filter(MediaContent.id == record.media_id).first()
        all_metadata.append({
            "link_id": record.id,
            "media_id": record.media_id,
            "platform": record.platform,
            "url": record.url,
            "link_status": record.link_status,
            "link_category": record.link_category,
            "created_at": str(record.created_at),
        })
        all_details.append({
            "link_id": record.id,
            "media_name": media.media_name if media else None,
            "media_category": media.media_category if media else None,
            "description": record.description,
            "url": record.url,
            "platform": record.platform,
        })

    media_content = "All Links Export\n" + "=" * 40 + "\n"
    for d in all_details:
        media_content += f"\n[{d['platform']}] {d['media_name']} - {d['url']}\n"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("metadata.json", json.dumps(all_metadata, indent=2))
        zf.writestr("details.json", json.dumps(all_details, indent=2))
        zf.writestr("media_links_export.txt", media_content)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=all_links_export.zip"},
    )

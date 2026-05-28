# Content Dashboard — Project Documentation

## Overview

Content Dashboard is a comprehensive media content management and analytics platform for personal use. It provides tools to track, manage, and analyze media consumption (movies, web series, shows, music) with linked content, status tracking, reports, and task management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Static UI)                   │
│  HTML + CSS + Vanilla JS + Chart.js                      │
│  Served from /static via FastAPI StaticFiles             │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API calls
┌──────────────────────▼──────────────────────────────────┐
│                    Backend (FastAPI)                      │
│  Routers → Schemas → Models → SQLAlchemy ORM            │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Database (PostgreSQL / SQLite)               │
│  Tables: media_content, media_links, media_status,       │
│          todo_tasks, status_definitions, contents         │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Python 3.12+, FastAPI, Uvicorn      |
| ORM       | SQLAlchemy 2.x                      |
| Database  | PostgreSQL (production) / SQLite (dev) |
| Frontend  | HTML5, CSS3, Vanilla JavaScript     |
| Charts    | Chart.js 4.x (CDN)                  |
| Styling   | Custom CSS with CSS Variables       |
| Deploy    | Docker + Docker Compose             |

---

## Project Structure

```
Content-Dashboard/
├── app/
│   ├── __init__.py
│   ├── config.py           # Environment configuration (pydantic-settings)
│   ├── database.py         # SQLAlchemy engine, session, Base
│   ├── main.py             # FastAPI app factory, router registration
│   ├── models/
│   │   ├── __init__.py     # Model imports
│   │   ├── content.py      # Legacy Content model
│   │   └── media.py        # MediaContent, MediaLink, MediaStatus, TodoTask
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── content.py      # Legacy CRUD endpoints
│   │   ├── dashboard.py    # Dashboard stats, reports, CSV export
│   │   ├── health.py       # Health check endpoint
│   │   ├── links.py        # Media links CRUD
│   │   ├── media.py        # Media content CRUD
│   │   ├── status.py       # Status tracking CRUD
│   │   └── tasks.py        # Todo tasks CRUD + calendar
│   └── schemas/
│       ├── __init__.py
│       ├── content.py      # Legacy schemas
│       └── media.py        # All media-related Pydantic schemas
├── scripts/
│   ├── 001_create_tables.sql   # DDL: table creation with indexes & triggers
│   └── 002_seed_data.sql       # DML: sample/test data
├── static/
│   ├── index.html          # Single-page UI shell
│   ├── css/style.css       # Complete stylesheet
│   └── js/app.js           # Frontend logic (modular functions)
├── tests/
│   └── test_api.py         # API integration tests
├── Prompts/                # Design documents
├── docker-compose.yml      # Multi-service deployment
├── Dockerfile              # Container build
├── requirements.txt        # Python dependencies
├── run.py                  # Development server entry
└── README.md               # Quick start guide
```

---

## Database Design

### Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐
│  media_content  │───1:N──│   media_links    │
│─────────────────│       │──────────────────│
│ id (PK)         │       │ id (PK)          │
│ media_category  │       │ media_id (FK)    │
│ media_name      │       │ platform         │
│ release_date    │       │ url              │
│ genre           │       │ description      │
│ director        │       │ created_at       │
│ cast_members    │       └──────────────────┘
│ rating          │
│ review          │       ┌──────────────────┐
│ created_at      │───1:N──│  media_status    │
│ updated_at      │       │──────────────────│
└─────────────────┘       │ id (PK)          │
        │                 │ media_id (FK)    │
        │                 │ status           │
        │ 0:N (optional)  │ notes            │
        │                 │ updated_by       │
┌───────▼─────────┐       │ created_at       │
│   todo_tasks    │       │ updated_at       │
│─────────────────│       └──────────────────┘
│ id (PK)         │
│ title           │
│ description     │
│ due_date        │
│ priority        │
│ category        │
│ media_id (FK)   │
│ status          │
│ reminder        │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

### Tables Summary

| Table           | Purpose                                        | Relationships           |
|-----------------|------------------------------------------------|-------------------------|
| media_content   | Core media items (movies, series, shows, music) | Parent of links/status  |
| media_links     | External URLs linked to media                  | Belongs to media_content |
| media_status    | Progress/lifecycle tracking                    | Belongs to media_content |
| todo_tasks      | Personal task management                       | Optionally links to media |

### Valid Enumeration Values

| Field                    | Valid Values                                                    |
|--------------------------|----------------------------------------------------------------|
| media_content.media_category | movies, webseries, shows, music                           |
| media_status.status      | reviewed, proceed, stopped, in_progress, revived, planned, cancelled |
| todo_tasks.priority      | low, medium, high, urgent                                      |
| todo_tasks.status        | pending, in_progress, completed, cancelled                     |
| todo_tasks.category      | general, media, project                                        |
| media_links.platform     | youtube, instagram, twitter, spotify, netflix, amazon, other   |

---

## UI Design

### Tabs (Left Sidebar)

| Tab              | Icon | Purpose                                      |
|------------------|------|----------------------------------------------|
| Dashboard        | 📊  | Overview with stats and charts               |
| Movies           | 🎬  | CRUD for movie entries                       |
| Web Series       | 📺  | CRUD for web series                          |
| Shows            | 🎭  | CRUD for shows                               |
| Music            | 🎵  | CRUD for music                               |
| Link Content     | 🔗  | Associate URLs with media                    |
| Status Tracking  | 📋  | Track media progress/lifecycle               |
| Reports          | 📈  | Filtered reports with charts + CSV export    |
| Statistics       | 📉  | Summary stats with visual indicators         |
| Todo Tasks       | ✅  | Task management with calendar                |
| API Docs         | 📘  | Link to Swagger/ReDoc                        |

### Design Principles

1. **Minimalistic** — Only show what's needed, no visual clutter
2. **Modular** — Each tab is independent, easy to modify/extend
3. **Responsive** — Works on desktop, tablet, and mobile
4. **Consistent** — Unified color scheme, typography, spacing
5. **Accessible** — Clear labels, proper contrast, keyboard-friendly

---

## API Endpoints

### Media Content (`/api/v1/media`)
| Method | Endpoint                     | Description                     |
|--------|------------------------------|---------------------------------|
| POST   | /media/                      | Create new media                |
| GET    | /media/                      | List all (paginated, filterable)|
| GET    | /media/{id}                  | Get by ID                       |
| PUT    | /media/{id}                  | Update media                    |
| DELETE | /media/{id}                  | Delete media                    |
| GET    | /media/category/{category}   | List by category                |

### Media Links (`/api/v1/media-links`)
| Method | Endpoint                     | Description                     |
|--------|------------------------------|---------------------------------|
| POST   | /media-links/                | Create link                     |
| GET    | /media-links/                | List all links                  |
| GET    | /media-links/by-media/{id}   | Links for specific media        |
| PUT    | /media-links/{id}            | Update link                     |
| DELETE | /media-links/{id}            | Delete link                     |

### Media Status (`/api/v1/media-status`)
| Method | Endpoint                     | Description                     |
|--------|------------------------------|---------------------------------|
| POST   | /media-status/               | Create status entry             |
| GET    | /media-status/               | List all statuses               |
| GET    | /media-status/by-media/{id}  | Statuses for specific media     |
| GET    | /media-status/valid-statuses | Get valid status values         |
| PUT    | /media-status/{id}           | Update status                   |
| DELETE | /media-status/{id}           | Delete status                   |

### Tasks (`/api/v1/tasks`)
| Method | Endpoint                     | Description                     |
|--------|------------------------------|---------------------------------|
| POST   | /tasks/                      | Create task                     |
| GET    | /tasks/                      | List tasks (filterable)         |
| GET    | /tasks/calendar              | Tasks by date range             |
| GET    | /tasks/{id}                  | Get task by ID                  |
| PUT    | /tasks/{id}                  | Update task                     |
| DELETE | /tasks/{id}                  | Delete task                     |

### Dashboard (`/api/v1/dashboard`)
| Method | Endpoint                     | Description                     |
|--------|------------------------------|---------------------------------|
| GET    | /dashboard/stats             | Get dashboard statistics        |
| GET    | /dashboard/reports           | Generate filtered report        |
| GET    | /dashboard/export/csv        | Export data as CSV              |
| GET    | /dashboard/statistics        | Get detailed statistics         |

---

## Running the Application

### Development (SQLite)
```bash
python run.py
```
Open: http://localhost:8000

### With PostgreSQL
Set environment variable or create `.env.development`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/content-dashboard-db
```

### Docker
```bash
docker-compose up --build
```

### Run SQL Scripts (PostgreSQL)
```bash
psql -U postgres -d content-dashboard-db -f scripts/001_create_tables.sql
psql -U postgres -d content-dashboard-db -f scripts/002_seed_data.sql
psql -U postgres -d content-dashboard-db -f scripts/003_add_status_definitions.sql
```

### SQLite Schema
For SQLite deployments, use the combined script:
```bash
sqlite3 content_dashboard.db < scripts/004_full_schema_sqlite.sql
```

---

## Version History

### v2.4.0 (2026-05-15) — Dashboard Filters, Excel Export/Import, Title Case

#### Dashboard Filters (Feature #64)
- Category filter dropdown on Dashboard page — filter all stats/charts by `movies`, `webseries`, `shows`, `music`
- Data type filter — view `All Data`, `Media Only`, `Links Only`, or `Status Only`
- Backend `/dashboard/stats` endpoint now accepts `?media_category=` parameter
- Charts and stat cards dynamically update based on selected filters

#### Database Migration Scripts (Feature #65)
- `scripts/003_add_status_definitions.sql` — PostgreSQL migration for `status_definitions` table
- `scripts/004_full_schema_sqlite.sql` — Complete SQLite-compatible schema for all tables
- Scripts are idempotent and can be shared with DBA teams for production deployment

#### Media Name Auto-Capitalization (Feature #67)
- Media names are automatically converted to Title Case on create and update
- Example: `"the dark knight"` → `"The Dark Knight"`
- Applied in `POST /media/` and `PUT /media/{id}` endpoints

#### Excel Export (Feature #68)
- **Export buttons** on Media, Links, and Status Tracking pages
- API Endpoints:
  - `GET /api/v1/excel/export/media` — Export all media to `.xlsx`
  - `GET /api/v1/excel/export/links` — Export all links to `.xlsx`
  - `GET /api/v1/excel/export/status` — Export all status tracking to `.xlsx`
- Supports category/status filters via query parameters
- Uses `openpyxl` for styled Excel generation with headers, auto-width columns

#### Excel Import (Feature #69)
- **Import buttons** on Media, Links, and Status Tracking pages
- File upload triggers API endpoint to parse and bulk-insert data
- API Endpoints:
  - `POST /api/v1/excel/import/media` — Import media from `.xlsx`
  - `POST /api/v1/excel/import/links` — Import links from `.xlsx`
  - `POST /api/v1/excel/import/status` — Import status from `.xlsx`
- Validates rows and returns detailed error reports for failed entries
- Media names are auto-resolved for links and status imports

#### Excel Templates (Feature #70)
- **Template download buttons** on each page — provides pre-formatted `.xlsx` with correct column headers and example rows
- API Endpoints:
  - `GET /api/v1/excel/templates/media` — Media import template
  - `GET /api/v1/excel/templates/links` — Links import template
  - `GET /api/v1/excel/templates/status` — Status import template
- Templates include styled headers and italic example data rows

### v2.3.0 (2026-05-15) — Status Management, Dynamic Validation
- Status Management tab with CRUD for reusable status definitions
- Dynamic status validation — backend checks `status_definitions` table
- Dynamic status dropdowns in Add Status modal and filter bars
- Auto-seed default statuses when opening status modal with empty DB

### v2.2.0 — Logging, UI Improvements, Status Enhancements
- Request logging middleware with color-coded log levels
- UI size improvements for better readability
- Searchable media dropdown in Status modal with auto-fill

### v2.1.0 — Links Enhancement, Consolidated Media
- Enhanced Link Content with search, edit, download ZIP
- Consolidated Media tab replacing separate category tabs
- Analytics tab with 4 chart panels

---

## Future Enhancement Areas

1. **User Authentication** — JWT-based login/registration
2. **Notifications** — Reminder notifications for tasks
3. **PDF Reports** — WeasyPrint or ReportLab integration
4. **Watchlist** — Public/private watchlists
5. **Tags/Labels** — Flexible tagging system
6. **Comments** — Per-media comment threads
7. **File Uploads** — Poster images, screenshots
8. **WebSocket** — Real-time updates
9. **Dark Mode** — CSS variable theme toggle


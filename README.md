# Content Dashboard

A unified single-service application combining a **FastAPI** backend with a **vanilla JS** dashboard UI.  
Designed for collecting and displaying content data from a PostgreSQL database (ships with a dummy SQLite DB for immediate local development).

---

## Architecture Overview

```
Content-Dashboard/
│
├── app/                         # Python backend (FastAPI)
│   ├── __init__.py
│   ├── main.py                  # Application entry point & app factory
│   ├── config.py                # Environment-aware settings (pydantic-settings)
│   ├── database.py              # SQLAlchemy engine & session
│   ├── models/
│   │   └── content.py           # ORM models
│   ├── schemas/
│   │   └── content.py           # Pydantic request/response schemas
│   └── routers/
│       ├── health.py            # Health check endpoint
│       └── content.py           # Content CRUD API
│
├── static/                      # Frontend UI (served by FastAPI)
│   ├── index.html               # Main dashboard page
│   ├── css/style.css            # Styles
│   └── js/app.js                # Dashboard JS logic
│
├── tests/
│   └── test_api.py              # API tests (pytest + httpx)
│
├── .env.development             # Dev environment config
├── .env.staging                 # Staging environment config
├── .env.production              # Production environment config
├── .env.example                 # Template for new environments
├── requirements.txt             # Python dependencies
├── run.py                       # Application launcher
├── Dockerfile                   # Container image
├── docker-compose.yml           # Local stack (app + PostgreSQL)
├── .gitignore
└── README.md                    # This file
```

---

## Tech Stack

| Layer     | Technology                  | Why                                                  |
|-----------|-----------------------------|------------------------------------------------------|
| Backend   | **FastAPI 0.115**           | Fastest Python micro-framework, async, auto-docs     |
| ORM       | **SQLAlchemy 2**            | Mature, supports PostgreSQL + SQLite seamlessly      |
| Schemas   | **Pydantic 2**              | Built into FastAPI, blazing fast validation           |
| Config    | **pydantic-settings**       | `.env` file loading with type validation             |
| Server    | **Uvicorn**                 | ASGI server, production-grade                        |
| Database  | **PostgreSQL 16** (prod)    | Robust relational DB for content data                |
|           | **SQLite** (dev fallback)   | Zero-config local development                        |
| Frontend  | **Vanilla HTML/CSS/JS**     | No build step, zero dependencies, instant load       |
| Testing   | **pytest + httpx**          | Standard Python testing                              |
| Container | **Docker + Compose**        | Single command deployment                            |
| API Docs  | **Swagger UI + ReDoc**      | Auto-generated from FastAPI — zero extra config      |

---

## Prerequisites

- **Python 3.11+** (3.12 recommended)
- **pip** (comes with Python)
- **Docker & Docker Compose** (optional — for containerized deployment)
- **PostgreSQL 14+** (optional — SQLite works out of the box for dev)

---

## Quick Start (Local Development)

### 1. Clone & navigate

```bash
cd Content-Dashboard
```

### 2. Create a virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the application

```bash
python run.py
```

The service starts at **http://localhost:8000**

| URL                         | Description                     |
|-----------------------------|---------------------------------|
| `http://localhost:8000`     | Dashboard UI                    |
| `http://localhost:8000/docs`| Swagger API documentation       |
| `http://localhost:8000/redoc`| ReDoc API documentation        |
| `http://localhost:8000/api/v1/health` | Health check endpoint |

### 5. Seed sample data

Click the **🌱 Seed Data** button on the dashboard, or:

```bash
curl -X POST http://localhost:8000/api/v1/contents/seed
```

---

## Environment Profiles

The application uses **profile-based configuration** via `.env` files and the `APP_ENV` environment variable.

| Profile       | File                | Database         | Debug | Log Level |
|---------------|---------------------|------------------|-------|-----------|
| `development` | `.env.development`  | SQLite (local)   | ✅    | DEBUG     |
| `staging`     | `.env.staging`      | PostgreSQL       | ❌    | INFO      |
| `production`  | `.env.production`   | PostgreSQL       | ❌    | WARNING   |

### Switching profiles

```bash
# Windows PowerShell
$env:APP_ENV="staging"; python run.py

# Linux / macOS
APP_ENV=staging python run.py

# Docker
docker run -e APP_ENV=production content-dashboard
```

### Connecting to PostgreSQL

Update the `DATABASE_URL` in the appropriate `.env.*` file:

```
DATABASE_URL=postgresql://username:password@hostname:5432/content_dashboard
```

---

## Docker Deployment

### Build & run with Docker Compose (includes PostgreSQL)

```bash
docker-compose up --build
```

This starts:
- **PostgreSQL 16** on port `5432`
- **Content Dashboard** on port `8000`

### Build standalone image

```bash
docker build -t content-dashboard .
docker run -p 8000:8000 -e APP_ENV=production -e DATABASE_URL=postgresql://... content-dashboard
```

---

## API Reference

Full interactive documentation is available at `/docs` (Swagger) and `/redoc` when the service is running.

### Endpoints

| Method   | Path                       | Description              |
|----------|----------------------------|--------------------------|
| `GET`    | `/api/v1/health`           | Health check             |
| `GET`    | `/api/v1/contents/`        | List contents (paginated)|
| `POST`   | `/api/v1/contents/`        | Create content           |
| `GET`    | `/api/v1/contents/{id}`    | Get content by ID        |
| `PUT`    | `/api/v1/contents/{id}`    | Update content           |
| `DELETE` | `/api/v1/contents/{id}`    | Delete content           |
| `POST`   | `/api/v1/contents/seed`    | Seed sample data         |

### Example: Create content

```bash
curl -X POST http://localhost:8000/api/v1/contents/ \
  -H "Content-Type: application/json" \
  -d '{"title": "My Report", "category": "reports", "description": "Quarterly summary"}'
```

### Example: List with filters

```bash
curl "http://localhost:8000/api/v1/contents/?page=1&page_size=10&category=reports&status=active"
```

---

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage (install pytest-cov first)
pip install pytest-cov
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## UI Tabs

The dashboard sidebar contains the following tabs (extensible):

| Tab              | Status      | Description                          |
|------------------|-------------|--------------------------------------|
| Dashboard        | ✅ Active   | Stats overview + content table       |
| Content Manager  | 🔲 Placeholder | Bulk editing & workflows          |
| Analytics        | 🔲 Placeholder | Charts & visualizations           |
| Reports          | 🔲 Placeholder | Export PDF/CSV reports            |
| Data Imports     | 🔲 Placeholder | Batch import from CSV/JSON/APIs   |
| API Docs         | ✅ Active   | Links to Swagger & ReDoc             |
| Settings         | 🔲 Placeholder | App configuration                 |

Each placeholder tab is pre-wired with routing — just replace the content in `static/index.html` and add corresponding API routes as needed.

---

## Project Configuration Reference

All configuration is managed via environment variables (loaded from `.env.*` files):

| Variable          | Default                              | Description                    |
|-------------------|--------------------------------------|--------------------------------|
| `APP_NAME`        | `Content-Dashboard`                  | Application name               |
| `APP_VERSION`     | `1.0.0`                              | Semantic version               |
| `APP_ENV`         | `development`                        | Active profile                 |
| `DEBUG`           | `true`                               | Enable debug mode / hot reload |
| `HOST`            | `0.0.0.0`                            | Bind address                   |
| `PORT`            | `8000`                               | Bind port                      |
| `DATABASE_URL`    | `sqlite:///./content_dashboard.db`   | Database connection string     |
| `DB_POOL_SIZE`    | `10`                                 | Connection pool size           |
| `DB_MAX_OVERFLOW` | `20`                                 | Max overflow connections       |
| `DB_POOL_TIMEOUT` | `30`                                 | Pool timeout (seconds)         |
| `DB_ECHO`         | `false`                              | Log SQL queries                |
| `CORS_ORIGINS`    | `*`                                  | Allowed CORS origins (CSV)     |
| `LOG_LEVEL`       | `INFO`                               | Logging level                  |
| `API_PREFIX`      | `/api/v1`                            | API route prefix               |

---

## License

Internal use — Cetera Financial Group.

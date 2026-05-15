# 🚀 Content-Dashboard — Production Deployment Guide

## Version: 2.4.0 | Last Updated: May 15, 2026

---

## 📋 Table of Contents

1. [Project Validation Summary](#project-validation-summary)
2. [Architecture Overview](#architecture-overview)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Options](#deployment-options)
5. [Docker Deployment (Recommended)](#docker-deployment-recommended)
6. [Manual Server Deployment](#manual-server-deployment)
7. [Environment Configuration](#environment-configuration)
8. [Database Setup](#database-setup)
9. [Nginx Reverse Proxy Setup](#nginx-reverse-proxy-setup)
10. [SSL/TLS Configuration](#ssltls-configuration)
11. [Monitoring & Logging](#monitoring--logging)
12. [Backup Strategy](#backup-strategy)
13. [Security Hardening](#security-hardening)
14. [Scaling Considerations](#scaling-considerations)
15. [Troubleshooting](#troubleshooting)

---

## ✅ Project Validation Summary

| Area | Status | Notes |
|------|--------|-------|
| All Tests (53/53) | ✅ Pass | Full coverage — CRUD, export/import, UI, dashboard |
| API Endpoints | ✅ Valid | 9 routers, paginated responses, proper HTTP codes |
| Database Models | ✅ Valid | 5 models with relationships, cascades, indexes |
| Pydantic Schemas | ✅ Valid | Request validation, examples, from_attributes |
| Static UI | ✅ Served | Single-page app served from /static |
| Docker Setup | ✅ Ready | Multi-service with PostgreSQL |
| Error Handling | ✅ Safe | Exception details hidden in production |
| CORS | ✅ Fixed | Restricted (no wildcard in production) |
| CVE Check | ⚠️ Fixed | Pydantic pinned to >=2.4.0 (CVE-2024-3772) |

### Changes Made During Validation:
- **Fixed**: CORS wildcard (`*`) → restricted to configured domains
- **Fixed**: Error responses no longer leak stack traces in production
- **Fixed**: Pydantic version pinned >=2.4.0 (CVE-2024-3772)
- **Added**: Gunicorn support for production (multi-worker)
- **Added**: Non-root Docker user for security
- **Added**: Docker healthcheck
- **Added**: `.dockerignore` file
- **Added**: `.env.production.template` with all required variables
- **Added**: Resource limits in docker-compose
- **Updated**: App version to 2.4.0
- **Updated**: `run.py` with production worker management

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Internet / Client                      │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │     Nginx (Reverse      │  Port 80/443
              │     Proxy + SSL)        │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   Gunicorn + Uvicorn    │  Port 8000 (internal)
              │   (4 workers)           │
              │   ┌─────────────────┐   │
              │   │   FastAPI App   │   │
              │   │  - REST API     │   │
              │   │  - Static UI    │   │
              │   └─────────────────┘   │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │     PostgreSQL 16       │  Port 5432 (internal)
              │   (Persistent Data)     │
              └─────────────────────────┘
```

---

## ✔️ Pre-Deployment Checklist

- [ ] Server provisioned (Linux Ubuntu 22.04+ recommended)
- [ ] Docker & Docker Compose installed
- [ ] Domain name configured (DNS A record pointing to server IP)
- [ ] SSL certificate ready (Let's Encrypt or paid)
- [ ] `.env.production` created with REAL secrets (see template)
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Database credentials are strong (not defaults)
- [ ] `SECRET_KEY` generated (use `python -c "import secrets; print(secrets.token_urlsafe(64))"`)
- [ ] Backup strategy in place
- [ ] Monitoring setup planned

---

## 🐳 Docker Deployment (Recommended)

### Step 1: Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group
sudo usermod -aG docker $USER
```

### Step 2: Clone & Configure

```bash
# Clone your repository
git clone <your-repo-url> /opt/content-dashboard
cd /opt/content-dashboard

# Create production environment file
cp .env.production.template .env.production

# Edit with real values
nano .env.production
```

**Critical values to change in `.env.production`:**
```env
SECRET_KEY=<generate-with-python-secrets>
DATABASE_URL=postgresql://cd_user:<STRONG_PASSWORD>@db:5432/content_dashboard
POSTGRES_PASSWORD=<STRONG_PASSWORD>
CORS_ORIGINS=https://yourdomain.com
WORKERS=4
LOG_LEVEL=WARNING
```

### Step 3: Deploy

```bash
# Build and start services
docker compose up -d --build

# Verify services are running
docker compose ps

# Check application logs
docker compose logs app --tail=50

# Verify health endpoint
curl http://localhost:8000/api/v1/health
```

### Step 4: Seed Initial Data (Optional)

```bash
# Seed default status definitions
curl -X POST http://localhost:8000/api/v1/status-definitions/seed
```

---

## 🖥️ Manual Server Deployment (Without Docker)

### Step 1: Install Dependencies

```bash
# Python 3.12+
sudo apt install python3.12 python3.12-venv python3-pip -y

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# System libraries
sudo apt install libpq-dev gcc -y
```

### Step 2: Setup PostgreSQL

```bash
sudo -u postgres psql <<EOF
CREATE USER cd_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE content_dashboard OWNER cd_user;
GRANT ALL PRIVILEGES ON DATABASE content_dashboard TO cd_user;
EOF
```

### Step 3: Setup Application

```bash
# Create app directory
sudo mkdir -p /opt/content-dashboard
cd /opt/content-dashboard

# Copy application files
# (use git clone or scp)

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env.production
cp .env.production.template .env.production
nano .env.production
```

### Step 4: Create Systemd Service

```bash
sudo tee /etc/systemd/system/content-dashboard.service > /dev/null <<EOF
[Unit]
Description=Content Dashboard API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/content-dashboard
Environment="PATH=/opt/content-dashboard/venv/bin"
Environment="APP_ENV=production"
ExecStart=/opt/content-dashboard/venv/bin/gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 4 \
    --bind 127.0.0.1:8000 \
    --access-logfile /var/log/content-dashboard/access.log \
    --error-logfile /var/log/content-dashboard/error.log \
    --log-level warning
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create log directory
sudo mkdir -p /var/log/content-dashboard
sudo chown www-data:www-data /var/log/content-dashboard

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable content-dashboard
sudo systemctl start content-dashboard
sudo systemctl status content-dashboard
```

---

## ⚙️ Environment Configuration

| Variable | Production Value | Description |
|----------|-----------------|-------------|
| `APP_ENV` | `production` | Disables debug features |
| `DEBUG` | `false` | No auto-reload, no error detail in responses |
| `SECRET_KEY` | `<random 64+ char>` | For future auth/session signing |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `CORS_ORIGINS` | `https://yourdomain.com` | Comma-separated allowed origins |
| `WORKERS` | `4` | Gunicorn workers (formula: 2×CPU+1) |
| `LOG_LEVEL` | `WARNING` | Reduce log noise in production |
| `DB_POOL_SIZE` | `20` | Connection pool size |
| `DB_MAX_OVERFLOW` | `40` | Max overflow connections |

---

## 🌐 Nginx Reverse Proxy Setup

```bash
sudo apt install nginx -y
```

Create site configuration:

```nginx
# /etc/nginx/sites-available/content-dashboard
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # Static files (served by Nginx directly for performance)
    location /static/ {
        alias /opt/content-dashboard/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;

        # File upload limit (for Excel imports)
        client_max_body_size 50M;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/content-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 SSL/TLS Configuration

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

---

## 📊 Monitoring & Logging

### Health Check Endpoint
```
GET /api/v1/health
Response: {"status": "healthy", "service": "Content-Dashboard", "version": "2.4.0", "environment": "production"}
```

### Log Rotation (for manual deployment)
```bash
sudo tee /etc/logrotate.d/content-dashboard > /dev/null <<EOF
/var/log/content-dashboard/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload content-dashboard
    endscript
}
EOF
```

### Docker Logs
```bash
# View live logs
docker compose logs -f app

# Export logs
docker compose logs app > app_logs_$(date +%Y%m%d).txt
```

### Recommended Tools
- **Uptime Monitoring**: UptimeRobot (free) or Healthchecks.io
- **Error Tracking**: Sentry (add `sentry-sdk[fastapi]` if needed)
- **Metrics**: Prometheus + Grafana (optional)

---

## 💾 Backup Strategy

### PostgreSQL Backup (Automated)

```bash
# Create backup script
sudo tee /opt/content-dashboard/backup.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/content-dashboard"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Docker backup
docker compose -f /opt/content-dashboard/docker-compose.yml exec -T db \
    pg_dump -U cd_user content_dashboard | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_$TIMESTAMP.sql.gz"
EOF

chmod +x /opt/content-dashboard/backup.sh

# Schedule daily backup at 2 AM
echo "0 2 * * * /opt/content-dashboard/backup.sh" | sudo crontab -
```

### Restore from Backup
```bash
gunzip < /opt/backups/content-dashboard/db_YYYYMMDD_HHMMSS.sql.gz | \
    docker compose exec -T db psql -U cd_user content_dashboard
```

---

## 🛡️ Security Hardening

### Server-Level
```bash
# Firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Fail2ban (brute-force protection)
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

### Application-Level (Already Done)
- ✅ CORS restricted to specific domains
- ✅ Error details hidden in production
- ✅ Non-root Docker user
- ✅ Input validation via Pydantic schemas
- ✅ SQL injection prevented by SQLAlchemy ORM
- ✅ File upload validation (.xlsx only)

### Future Enhancements (When Needed)
- Add rate limiting (use `slowapi` package)
- Add authentication (JWT with `python-jose` or API keys)
- Add request size limits
- Add CSRF protection (if using cookies)

---

## 📈 Scaling Considerations

| Load Level | Configuration |
|------------|--------------|
| Low (< 100 users) | 2 workers, 1 CPU, 2GB RAM |
| Medium (100-1000) | 4 workers, 2 CPU, 4GB RAM |
| High (1000+) | 8 workers, 4 CPU, 8GB RAM + load balancer |

### Horizontal Scaling
```yaml
# docker-compose.override.yml for multiple app instances
services:
  app:
    deploy:
      replicas: 3
```

Use a load balancer (Nginx upstream or Traefik) in front of multiple app containers.

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| `CORS error` in browser | Ensure `CORS_ORIGINS` includes your frontend URL |
| `502 Bad Gateway` | Check if app container is running: `docker compose ps` |
| Database connection refused | Verify DB is healthy: `docker compose exec db pg_isready` |
| Slow responses | Increase `WORKERS` count, check DB pool settings |
| Out of memory | Add swap or increase server RAM |
| Import fails | Check file size < 50MB, ensure .xlsx format |

### Useful Commands
```bash
# Check container status
docker compose ps

# Restart services
docker compose restart app

# Rebuild after code changes
docker compose up -d --build app

# Enter container shell
docker compose exec app bash

# Check database
docker compose exec db psql -U cd_user -d content_dashboard

# View real-time logs
docker compose logs -f --tail=100 app
```

---

## 🚀 Quick Deploy Summary

```bash
# 1. Clone repo to server
git clone <repo-url> /opt/content-dashboard && cd /opt/content-dashboard

# 2. Configure environment
cp .env.production.template .env.production
# Edit .env.production with your real values

# 3. Deploy with Docker
docker compose up -d --build

# 4. Verify
curl http://localhost:8000/api/v1/health

# 5. Setup Nginx + SSL (see sections above)
# 6. Setup backups (see section above)
# Done! 🎉
```


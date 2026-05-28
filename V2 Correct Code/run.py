# Application entry point.
# Usage:  python run.py
#         APP_ENV=staging python run.py
#         APP_ENV=production python run.py

import sys
import uvicorn
from app.config import get_settings

settings = get_settings()

if __name__ == "__main__":
    if settings.APP_ENV == "production" and sys.platform != "win32":
        # Production: use gunicorn with uvicorn workers (Linux/Mac only)
        import subprocess
        subprocess.run([
            "gunicorn", "app.main:app",
            "--worker-class", "uvicorn.workers.UvicornWorker",
            "--workers", str(settings.WORKERS),
            "--bind", f"{settings.HOST}:{settings.PORT}",
            "--access-logfile", "-",
            "--error-logfile", "-",
            "--log-level", settings.LOG_LEVEL.lower(),
        ])
    else:
        # Development or Windows: use uvicorn directly
        uvicorn.run(
            "app.main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=settings.DEBUG,
            log_level=settings.LOG_LEVEL.lower(),
        )

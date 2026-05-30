# ---- Build ----
FROM python:3.12-slim AS base

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN addgroup --system appuser && adduser --system --ingroup appuser appuser

COPY . .

# Own files by appuser
RUN chown -R appuser:appuser /app

USER appuser

# Default env
ENV APP_ENV=production
ENV PORT=8000
ENV WORKERS=4

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

CMD ["python", "run.py"]

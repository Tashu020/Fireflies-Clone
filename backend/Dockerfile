# Production image for the FastAPI backend.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# SQLite lives in /data. On Render's free plan this folder is recreated on every restart, and the
# app re-seeds the demo data at startup.
RUN mkdir -p /data
ENV DATABASE_URL=sqlite:////data/app.db \
    SEED_ON_STARTUP=true \
    PORT=8000

EXPOSE 8000

# One worker: SQLite has a single writer, and startup seeding must not race.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]

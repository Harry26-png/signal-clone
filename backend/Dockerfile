FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Mount a volume at /data to persist the SQLite database and uploads across deploys.
ENV DATABASE_URL=sqlite:////data/signal.db UPLOAD_DIR=/data/uploads
RUN mkdir -p /data

EXPOSE 8000
# One worker only: real-time connections are tracked in process memory.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

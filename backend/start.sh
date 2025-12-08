#!/bin/bash
set -e

echo "=== Starting CoachDB Backend ==="
echo "PORT: ${PORT:-8080}"

echo "=== Running migrations ==="
alembic upgrade head

echo "=== Starting uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}

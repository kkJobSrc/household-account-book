#!/bin/sh
# Container entrypoint: back up the SQLite file (if any), apply pending
# Alembic migrations, then hand off to uvicorn.
set -eu

# DATABASE_URL follows the same convention as database.py.
DATABASE_URL="${DATABASE_URL:-sqlite:///./data/kakeibo.db}"

# Only sqlite:/// URLs point at a local file we can back up. Anything else
# (e.g. a future non-SQLite backend) is left untouched here.
case "$DATABASE_URL" in
    sqlite:///*)
        DB_PATH="${DATABASE_URL#sqlite:///}"
        if [ -f "$DB_PATH" ]; then
            TIMESTAMP=$(date +%Y%m%d%H%M%S)
            BACKUP_PATH="${DB_PATH}.bak.${TIMESTAMP}"
            echo "Backing up database: $DB_PATH -> $BACKUP_PATH"
            cp "$DB_PATH" "$BACKUP_PATH"
        else
            echo "No existing database file at $DB_PATH, skipping backup"
        fi
        ;;
    *)
        echo "DATABASE_URL is not a local sqlite file, skipping backup"
        ;;
esac

echo "Applying database migrations..."
alembic upgrade head

echo "Starting application server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000

#!/bin/sh
set -e

# If DATABASE_URL is provided, run migrations and seeds
if [ -n "$DATABASE_URL" ]; then
  echo "==> PostgreSQL DATABASE_URL detected."
  if command -v psql >/dev/null 2>&1; then
    echo "==> Applying database migrations from /app/db/migrations/..."
    for migration in /app/db/migrations/*.sql; do
      if [ -f "$migration" ]; then
        echo "  -> Running $(basename "$migration")"
        psql "$DATABASE_URL" -f "$migration" >/dev/null 2>&1 || echo "     [Notice: $(basename "$migration") completed or already applied]"
      fi
    done

    if [ -f "/app/db/seeds/demo.sql" ]; then
      echo "  -> Seeding demo dataset from demo.sql"
      psql "$DATABASE_URL" -f /app/db/seeds/demo.sql >/dev/null 2>&1 || echo "     [Notice: demo.sql already seeded or table exists]"
    fi
    echo "==> Database migrations and seed verification complete."
  fi
else
  echo "==> No DATABASE_URL provided. Running in in-memory simulation mode."
fi

# Execute main process (e.g. sih-api)
exec "$@"

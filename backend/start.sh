#!/bin/bash
set -e

echo "=== Starting CoachDB Backend ==="
echo "PORT: ${PORT:-8080}"

echo "=== Fixing missing columns (direct SQL) ==="
python << 'EOF'
import os
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL:
    # Convert async URL to sync URL if needed
    url = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
    url = url.replace('postgresql://', 'postgresql://', 1)

    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        cur = conn.cursor()

        # Add missing columns to projects table
        columns_to_add = [
            ('support_program_name', 'VARCHAR(200)'),
            ('project_achievements', 'TEXT'),
            ('project_special_notes', 'TEXT'),
            ('actual_start_date', 'DATE'),
            ('actual_end_date', 'DATE'),
            ('overall_feedback', 'TEXT'),
            ('project_start_date', 'DATE'),
            ('project_end_date', 'DATE'),
            ('project_manager_id', 'BIGINT'),
        ]

        for col_name, col_type in columns_to_add:
            try:
                cur.execute(f"ALTER TABLE projects ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] projects.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] projects.{col_name}: {e}")

        # Add missing columns to competency_items table
        competency_columns = [
            ('description', 'TEXT'),
            ('is_custom', 'BOOLEAN DEFAULT FALSE'),
            ('created_by', 'INTEGER'),
        ]
        for col_name, col_type in competency_columns:
            try:
                cur.execute(f"ALTER TABLE competency_items ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] competency_items.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] competency_items.{col_name}: {e}")

        cur.close()
        conn.close()
        print("[OK] Database columns fixed")
    except Exception as e:
        print(f"[WARN] Could not fix columns: {e}")
else:
    print("[SKIP] No DATABASE_URL found")
EOF

echo "=== Running migrations ==="
alembic upgrade head || echo "[WARN] Alembic migration failed, continuing..."

echo "=== Starting uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}

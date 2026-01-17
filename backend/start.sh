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

        # Add missing columns to application_data table
        appdata_columns = [
            ('supplement_deadline', 'TIMESTAMP WITH TIME ZONE'),
            ('supplement_requested_at', 'TIMESTAMP WITH TIME ZONE'),
        ]
        for col_name, col_type in appdata_columns:
            try:
                cur.execute(f"ALTER TABLE application_data ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] application_data.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] application_data.{col_name}: {e}")

        # Add missing columns to coach_profiles table
        coach_profile_columns = [
            ('coaching_years', 'INTEGER'),
            ('specialty', 'VARCHAR(500)'),
            ('certifications', 'TEXT'),
            ('mentoring_experiences', 'TEXT'),
        ]
        for col_name, col_type in coach_profile_columns:
            try:
                cur.execute(f"ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] coach_profiles.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] coach_profiles.{col_name}: {e}")

        # Add missing columns to coach_competencies table (global verification)
        coach_competencies_columns = [
            ('is_globally_verified', 'BOOLEAN DEFAULT FALSE'),
            ('globally_verified_at', 'TIMESTAMP WITH TIME ZONE'),
        ]
        for col_name, col_type in coach_competencies_columns:
            try:
                cur.execute(f"ALTER TABLE coach_competencies ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] coach_competencies.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] coach_competencies.{col_name}: {e}")

        # Add missing columns to applications table (frozen snapshot)
        applications_columns = [
            ('is_frozen', 'BOOLEAN DEFAULT FALSE'),
            ('frozen_at', 'TIMESTAMP WITH TIME ZONE'),
        ]
        for col_name, col_type in applications_columns:
            try:
                cur.execute(f"ALTER TABLE applications ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] applications.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] applications.{col_name}: {e}")

        # Add missing columns to notifications table (verification related)
        notifications_columns = [
            ('related_competency_id', 'BIGINT'),
        ]
        for col_name, col_type in notifications_columns:
            try:
                cur.execute(f"ALTER TABLE notifications ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] notifications.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] notifications.{col_name}: {e}")

        # Add projecttype enum and column to projects
        try:
            cur.execute("""
                DO $$ BEGIN
                    CREATE TYPE projecttype AS ENUM ('public_coaching', 'business_coaching', 'other');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """)
            print("[OK] enum projecttype ensured")
        except Exception as e:
            print(f"[WARN] enum projecttype: {e}")

        try:
            # Check if column exists first
            cur.execute("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'projects' AND column_name = 'project_type'
            """)
            if not cur.fetchone():
                # Add the column without default
                cur.execute("ALTER TABLE projects ADD COLUMN project_type projecttype")
                # Update existing rows
                cur.execute("UPDATE projects SET project_type = 'other'")
            print("[OK] projects.project_type ensured")
        except Exception as e:
            print(f"[WARN] projects.project_type: {e}")

        # Add aggregationmode enum and column to scoring_criteria
        try:
            cur.execute("""
                DO $$ BEGIN
                    CREATE TYPE aggregationmode AS ENUM ('first', 'sum', 'max', 'count', 'any_match', 'best_match');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """)
            print("[OK] enum aggregationmode ensured")
        except Exception as e:
            print(f"[WARN] enum aggregationmode: {e}")

        try:
            cur.execute("ALTER TABLE scoring_criteria ADD COLUMN IF NOT EXISTS aggregation_mode aggregationmode DEFAULT 'first'")
            print("[OK] scoring_criteria.aggregation_mode ensured")
        except Exception as e:
            print(f"[WARN] scoring_criteria.aggregation_mode: {e}")

        # Add missing enum values to competencycategory
        enum_values = ['ADDON', 'EDUCATION', 'COACHING', 'OTHER', 'CERTIFICATION', 'EXPERIENCE', 'DETAIL']
        for val in enum_values:
            try:
                cur.execute(f"ALTER TYPE competencycategory ADD VALUE IF NOT EXISTS '{val}'")
                print(f"[OK] enum competencycategory.{val} ensured")
            except Exception as e:
                print(f"[WARN] enum competencycategory.{val}: {e}")

        # Add missing enum values to itemtemplate (both upper and lowercase for safety)
        template_values = ['TEXT', 'NUMBER', 'SELECT', 'MULTISELECT', 'FILE', 'TEXT_FILE', 'DEGREE', 'COACHING_HISTORY',
                          'COACHING_TIME', 'COACHING_EXPERIENCE',
                          'text', 'number', 'select', 'multiselect', 'file', 'text_file', 'degree', 'coaching_history',
                          'coaching_time', 'coaching_experience']
        for val in template_values:
            try:
                cur.execute(f"ALTER TYPE itemtemplate ADD VALUE IF NOT EXISTS '{val}'")
                print(f"[OK] enum itemtemplate.{val} ensured")
            except Exception as e:
                print(f"[WARN] enum itemtemplate.{val}: {e}")

        # Add missing enum values to matchingtype
        matchingtype_values = ['GRADE', 'EXACT', 'CONTAINS', 'RANGE', 'EXISTS', 'ANY']
        for val in matchingtype_values:
            try:
                cur.execute(f"ALTER TYPE matchingtype ADD VALUE IF NOT EXISTS '{val}'")
                print(f"[OK] enum matchingtype.{val} ensured")
            except Exception as e:
                print(f"[WARN] enum matchingtype.{val}: {e}")

        # Add missing enum values to projectstatus (approved status)
        projectstatus_values = ['approved']
        for val in projectstatus_values:
            try:
                cur.execute(f"ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS '{val}'")
                print(f"[OK] enum projectstatus.{val} ensured")
            except Exception as e:
                print(f"[WARN] enum projectstatus.{val}: {e}")

        # Update competency_items categories based on item_code patterns
        category_updates = [
            # CERT_* or ADDON_CERT_* → CERTIFICATION
            ("UPDATE competency_items SET category = 'CERTIFICATION' WHERE item_code LIKE 'CERT_%' OR item_code LIKE 'ADDON_CERT_%'", "CERTIFICATION"),
            # EDU_* or DEGREE_* → EDUCATION
            ("UPDATE competency_items SET category = 'EDUCATION' WHERE item_code LIKE 'EDU_%' OR item_code LIKE 'DEGREE_%'", "EDUCATION"),
            # EXP_*, COACHING_*, ADDON_COACHING_* → EXPERIENCE
            ("UPDATE competency_items SET category = 'EXPERIENCE' WHERE item_code LIKE 'EXP_%' OR item_code LIKE 'COACHING_%' OR item_code LIKE 'ADDON_COACHING_%'", "EXPERIENCE"),
            # Legacy experience items → EXPERIENCE
            ("UPDATE competency_items SET category = 'EXPERIENCE' WHERE item_code IN ('ADDON_EXP_HOURS', 'ADDON_CAREER', 'ADDON_TRAINING')", "EXPERIENCE legacy"),
            # SPECIALTY, ADDON_INTRO, ADDON_SPECIALTY → OTHER
            ("UPDATE competency_items SET category = 'OTHER' WHERE item_code IN ('SPECIALTY', 'ADDON_INTRO', 'ADDON_SPECIALTY')", "OTHER"),
            # EVAL_* → DETAIL
            ("UPDATE competency_items SET category = 'DETAIL' WHERE item_code LIKE 'EVAL_%'", "DETAIL"),
        ]
        for sql, label in category_updates:
            try:
                cur.execute(sql)
                print(f"[OK] category update: {label}")
            except Exception as e:
                print(f"[WARN] category update {label}: {e}")

        cur.close()
        conn.close()
        print("[OK] Database columns and categories fixed")
    except Exception as e:
        print(f"[WARN] Could not fix columns: {e}")
else:
    print("[SKIP] No DATABASE_URL found")
EOF

echo "=== Running migrations ==="
alembic upgrade head || echo "[WARN] Alembic migration failed, continuing..."

echo "=== Starting uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}

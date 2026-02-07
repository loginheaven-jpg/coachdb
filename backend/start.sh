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
            ('display_order', 'INTEGER NOT NULL DEFAULT 999'),
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

        # Add both lowercase and UPPERCASE enum values to projectstatus
        # PostgreSQL enum values are case-sensitive
        all_status_values = [
            'approved', 'draft', 'pending', 'rejected', 'ready',
            'recruiting', 'reviewing', 'in_progress', 'evaluating', 'closed',
            'APPROVED', 'DRAFT', 'PENDING', 'REJECTED', 'READY',
            'RECRUITING', 'REVIEWING', 'IN_PROGRESS', 'EVALUATING', 'CLOSED'
        ]
        for val in all_status_values:
            try:
                cur.execute(f"ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS '{val}'")
                print(f"[OK] enum projectstatus.{val} ensured")
            except Exception as e:
                if "already exists" not in str(e).lower():
                    print(f"[WARN] enum projectstatus.{val}: {e}")

        # Now convert lowercase status values in data to UPPERCASE
        status_conversions = [
            ('approved', 'APPROVED'),
            ('draft', 'DRAFT'),
            ('pending', 'PENDING'),
            ('rejected', 'REJECTED'),
            ('ready', 'READY'),
            ('recruiting', 'RECRUITING'),
            ('reviewing', 'REVIEWING'),
            ('in_progress', 'IN_PROGRESS'),
            ('evaluating', 'EVALUATING'),
            ('closed', 'CLOSED'),
        ]
        for old_val, new_val in status_conversions:
            try:
                cur.execute(f"""
                    UPDATE projects
                    SET status = '{new_val}'::projectstatus
                    WHERE status::text = '{old_val}'
                """)
                if cur.rowcount > 0:
                    print(f"[OK] Converted {cur.rowcount} projects from '{old_val}' to '{new_val}'")
            except Exception as e:
                print(f"[WARN] status conversion {old_val} -> {new_val}: {e}")

        # Add grade_edit_mode column to unified_templates (replacing fixed_grades and allow_add_grades)
        try:
            cur.execute("ALTER TABLE unified_templates ADD COLUMN IF NOT EXISTS grade_edit_mode VARCHAR(20) DEFAULT 'flexible'")
            print("[OK] unified_templates.grade_edit_mode ensured")
            # Migrate existing data: convert fixed_grades/allow_add_grades to grade_edit_mode
            cur.execute("""
                UPDATE unified_templates SET grade_edit_mode =
                    CASE
                        WHEN fixed_grades = true THEN 'fixed'
                        WHEN allow_add_grades = false THEN 'score_only'
                        ELSE 'flexible'
                    END
                WHERE grade_edit_mode IS NULL OR grade_edit_mode = 'flexible'
            """)
            print("[OK] unified_templates.grade_edit_mode migrated from fixed_grades/allow_add_grades")
        except Exception as e:
            print(f"[WARN] unified_templates.grade_edit_mode: {e}")

        # Add new columns to competency_items for template-item separation
        competency_item_columns = [
            ('grade_mappings', "TEXT DEFAULT '[]'"),
            ('proof_required', "VARCHAR(20) DEFAULT 'optional'"),
            ('help_text', 'TEXT'),
            ('placeholder', 'VARCHAR(200)'),
            ('verification_note', 'TEXT'),
            ('auto_confirm_across_projects', 'BOOLEAN DEFAULT FALSE'),
            ('field_label_overrides', "TEXT DEFAULT '{}'"),
            # Phase 4: 역량항목 완전 독립화 - 평가 설정 필드 추가
            ('grade_type', 'VARCHAR(50)'),
            ('matching_type', 'VARCHAR(50)'),
            ('grade_edit_mode', "VARCHAR(20) DEFAULT 'flexible'"),
            ('evaluation_method', "VARCHAR(50) DEFAULT 'standard'"),
            ('data_source', "VARCHAR(50) DEFAULT 'form_input'"),
            # Phase 5: 점수 소스 설정 (프리셋에서 완전 독립)
            ('scoring_value_source', "VARCHAR(50) DEFAULT 'submitted'"),
            ('scoring_source_field', 'VARCHAR(100)'),
            ('extract_pattern', 'VARCHAR(200)'),
        ]
        for col_name, col_type in competency_item_columns:
            try:
                cur.execute(f"ALTER TABLE competency_items ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                print(f"[OK] competency_items.{col_name} ensured")
            except Exception as e:
                print(f"[WARN] competency_items.{col_name}: {e}")

        # Migrate existing competency_items: copy default_mappings from unified_templates
        try:
            cur.execute("""
                UPDATE competency_items ci
                SET grade_mappings = ut.default_mappings,
                    proof_required = ut.proof_required,
                    help_text = ut.help_text,
                    placeholder = ut.placeholder,
                    verification_note = ut.verification_note,
                    auto_confirm_across_projects = ut.auto_confirm_across_projects
                FROM unified_templates ut
                WHERE ci.unified_template_id = ut.template_id
                  AND (ci.grade_mappings IS NULL OR ci.grade_mappings = '[]')
            """)
            print(f"[OK] competency_items: copied {cur.rowcount} rows from unified_templates")
        except Exception as e:
            print(f"[WARN] competency_items migration from unified_templates: {e}")

        # Phase 4: Migrate evaluation settings from unified_templates to competency_items
        try:
            cur.execute("""
                UPDATE competency_items ci
                SET grade_type = ut.grade_type,
                    matching_type = ut.matching_type,
                    grade_edit_mode = COALESCE(ut.grade_edit_mode, 'flexible'),
                    evaluation_method = COALESCE(ci.evaluation_method_override, ut.evaluation_method, 'standard'),
                    data_source = COALESCE(ut.data_source, 'form_input')
                FROM unified_templates ut
                WHERE ci.unified_template_id = ut.template_id
                  AND ci.grade_type IS NULL
            """)
            print(f"[OK] competency_items: Phase 4 evaluation settings migrated for {cur.rowcount} rows")
        except Exception as e:
            print(f"[WARN] competency_items Phase 4 migration: {e}")

        # Phase 5: Migrate scoring source settings from unified_templates to competency_items
        try:
            cur.execute("""
                UPDATE competency_items ci
                SET scoring_value_source = COALESCE(ut.scoring_value_source, 'submitted'),
                    scoring_source_field = ut.scoring_source_field,
                    extract_pattern = ut.extract_pattern
                FROM unified_templates ut
                WHERE ci.unified_template_id = ut.template_id
                  AND ci.scoring_value_source IS NULL
            """)
            print(f"[OK] competency_items: Phase 5 scoring source migrated for {cur.rowcount} rows")
        except Exception as e:
            print(f"[WARN] competency_items Phase 5 migration: {e}")

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

        # === display_order 설정 (alembic 마이그레이션 실패 대비 fallback) ===
        display_order_updates = [
            # 자격증 그룹 (100번대)
            ("UPDATE competency_items SET display_order = 100 WHERE item_code = 'CERT_KCA'", "CERT_KCA=100"),
            ("UPDATE competency_items SET display_order = 110 WHERE item_code = 'CERT_COUNSELING'", "CERT_COUNSELING=110"),
            ("UPDATE competency_items SET display_order = 120 WHERE item_name LIKE '%상담%심리%종류%' AND display_order = 999", "상담심리종류=120"),
            ("UPDATE competency_items SET display_order = 130 WHERE item_code = 'CERT_OTHER'", "CERT_OTHER=130"),
            ("UPDATE competency_items SET display_order = 140 WHERE item_name LIKE '%기타자격%종류%' AND display_order = 999", "기타자격종류=140"),
            # 코칭경력 그룹 (200번대)
            ("UPDATE competency_items SET display_order = 200 WHERE item_code = 'EXP_COACHING_HOURS'", "EXP_COACHING_HOURS=200"),
            ("UPDATE competency_items SET display_order = 210 WHERE item_code = 'EDUCATION_TRAINING'", "EDUCATION_TRAINING=210"),
            ("UPDATE competency_items SET display_order = 220 WHERE item_code = 'COACHING_BUSINESS'", "COACHING_BUSINESS=220"),
            ("UPDATE competency_items SET display_order = 230 WHERE item_code = 'COACHING_YOUTH'", "COACHING_YOUTH=230"),
            # 학력 그룹 (300번대)
            ("UPDATE competency_items SET display_order = 300 WHERE item_code = 'EDU_COACHING_FINAL'", "EDU_COACHING_FINAL=300"),
            ("UPDATE competency_items SET display_order = 310 WHERE item_code = 'EDU_OTHER_FINAL'", "EDU_OTHER_FINAL=310"),
            # 관리자전용 (800번대)
            ("UPDATE competency_items SET display_order = 800 WHERE item_code = 'EVAL_PREVIOUS_PROJECT'", "EVAL_PREVIOUS_PROJECT=800"),
            ("UPDATE competency_items SET display_order = 810 WHERE item_code = 'EVAL_COMMITTEE'", "EVAL_COMMITTEE=810"),
        ]
        for sql, label in display_order_updates:
            try:
                cur.execute(sql)
                if cur.rowcount > 0:
                    print(f"[OK] display_order: {label} ({cur.rowcount} rows)")
            except Exception as e:
                print(f"[WARN] display_order {label}: {e}")

        # === 비활성화 대상 항목 처리 ===
        try:
            cur.execute("""
                UPDATE competency_items SET is_active = false
                WHERE item_code IN (
                    'EXP_MENTORING',
                    'EXP_COACHING_YEARS',
                    'COACHING_CAREER',
                    'COACHING_YOUNG_ADULT',
                    'COACHING_FAMILY',
                    'COACHING_LIFE',
                    'SPECIALTY'
                )
            """)
            print(f"[OK] Deactivated {cur.rowcount} legacy items")
        except Exception as e:
            print(f"[WARN] item deactivation: {e}")

        # === 신규 항목: EDUCATION_TRAINING ===
        try:
            cur.execute("""
                INSERT INTO competency_items (
                    item_name, item_code, category, input_type, is_active,
                    template, is_repeatable, display_order,
                    grade_edit_mode, evaluation_method, data_source,
                    scoring_value_source, is_custom,
                    grade_mappings, proof_required, field_label_overrides
                ) VALUES (
                    '코칭관련 연수/교육', 'EDUCATION_TRAINING', 'EXPERIENCE', 'text', true,
                    'text_file', true, 210,
                    'flexible', 'standard', 'form_input',
                    'submitted', false,
                    '[]', 'optional', '{}'
                )
                ON CONFLICT (item_code) DO NOTHING
            """)
            if cur.rowcount > 0:
                print("[OK] Created EDUCATION_TRAINING item")
            else:
                print("[OK] EDUCATION_TRAINING already exists")
        except Exception as e:
            print(f"[WARN] EDUCATION_TRAINING creation: {e}")

        # === EDUCATION_TRAINING 필드 생성 ===
        try:
            cur.execute("""
                INSERT INTO competency_item_fields (item_id, field_name, field_label, field_type, is_required, display_order, placeholder)
                SELECT item_id, 'training_name', '연수/교육명', 'text', true, 1, '연수/교육명을 입력하세요'
                FROM competency_items WHERE item_code = 'EDUCATION_TRAINING'
                AND NOT EXISTS (
                    SELECT 1 FROM competency_item_fields f
                    WHERE f.item_id = competency_items.item_id AND f.field_name = 'training_name'
                )
            """)
            cur.execute("""
                INSERT INTO competency_item_fields (item_id, field_name, field_label, field_type, is_required, display_order)
                SELECT item_id, 'proof', '증빙 업로드', 'file', false, 2
                FROM competency_items WHERE item_code = 'EDUCATION_TRAINING'
                AND NOT EXISTS (
                    SELECT 1 FROM competency_item_fields f
                    WHERE f.item_id = competency_items.item_id AND f.field_name = 'proof'
                )
            """)
            print("[OK] EDUCATION_TRAINING fields ensured")
        except Exception as e:
            print(f"[WARN] EDUCATION_TRAINING fields: {e}")

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

"""
프로젝트 관리 및 코치 평가 시스템 마이그레이션 스크립트
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.config import settings


async def migrate_database():
    """데이터베이스 마이그레이션 실행"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        async with session.begin():
            print("\n=== 프로젝트 관리 및 코치 평가 시스템 마이그레이션 시작 ===\n")

            # 1. CoachRole enum 타입 생성
            print("1. CoachRole enum 타입 생성...")
            try:
                await session.execute(text("""
                    CREATE TYPE coachrole AS ENUM ('leader', 'participant', 'supervisor');
                """))
                print("  ✓ CoachRole enum 타입 생성 완료")
            except Exception as e:
                if "already exists" in str(e):
                    print("  ⚠️  CoachRole enum 타입이 이미 존재합니다")
                else:
                    raise

            # 2. projects 테이블 확장
            print("\n2. projects 테이블 확장...")

            # 과제 기간 (계획)
            await session.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS project_start_date DATE;
            """))
            print("  ✓ project_start_date 컬럼 추가")

            await session.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS project_end_date DATE;
            """))
            print("  ✓ project_end_date 컬럼 추가")

            # 실제 진행 기간
            await session.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS actual_start_date DATE;
            """))
            print("  ✓ actual_start_date 컬럼 추가")

            await session.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS actual_end_date DATE;
            """))
            print("  ✓ actual_end_date 컬럼 추가")

            # 과제 종료 후 총평
            await session.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS overall_feedback TEXT;
            """))
            print("  ✓ overall_feedback 컬럼 추가")

            # 과제 관리자
            await session.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS project_manager_id BIGINT
                REFERENCES users(user_id);
            """))
            print("  ✓ project_manager_id 컬럼 추가")

            # 3. applications 테이블 확장
            print("\n3. applications 테이블 확장...")

            # 지원 동기
            await session.execute(text("""
                ALTER TABLE applications
                ADD COLUMN IF NOT EXISTS motivation TEXT;
            """))
            print("  ✓ motivation 컬럼 추가")

            # 신청 역할
            await session.execute(text("""
                ALTER TABLE applications
                ADD COLUMN IF NOT EXISTS applied_role coachrole;
            """))
            print("  ✓ applied_role 컬럼 추가")

            # 4. custom_questions 테이블 생성
            print("\n4. custom_questions 테이블 생성...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS custom_questions (
                    question_id SERIAL PRIMARY KEY,
                    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
                    question_text VARCHAR(500) NOT NULL,
                    question_type VARCHAR(20) NOT NULL DEFAULT 'text',
                    is_required BOOLEAN NOT NULL DEFAULT FALSE,
                    display_order INTEGER NOT NULL DEFAULT 0,
                    options TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            print("  ✓ custom_questions 테이블 생성 완료")

            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_custom_questions_project_id
                ON custom_questions(project_id);
            """))
            print("  ✓ custom_questions 인덱스 생성 완료")

            # 5. custom_question_answers 테이블 생성
            print("\n5. custom_question_answers 테이블 생성...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS custom_question_answers (
                    answer_id BIGSERIAL PRIMARY KEY,
                    application_id BIGINT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
                    question_id INTEGER NOT NULL REFERENCES custom_questions(question_id) ON DELETE CASCADE,
                    answer_text TEXT,
                    answer_file_id BIGINT REFERENCES files(file_id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            print("  ✓ custom_question_answers 테이블 생성 완료")

            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_custom_question_answers_application_id
                ON custom_question_answers(application_id);
            """))
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_custom_question_answers_question_id
                ON custom_question_answers(question_id);
            """))
            print("  ✓ custom_question_answers 인덱스 생성 완료")

            # 6. coach_evaluations 테이블 생성
            print("\n6. coach_evaluations 테이블 생성...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS coach_evaluations (
                    evaluation_id BIGSERIAL PRIMARY KEY,
                    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
                    coach_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    evaluated_by BIGINT NOT NULL REFERENCES users(user_id),
                    participation_score INTEGER NOT NULL CHECK (participation_score >= 1 AND participation_score <= 4),
                    feedback_text TEXT,
                    special_notes TEXT,
                    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            print("  ✓ coach_evaluations 테이블 생성 완료")

            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_coach_evaluations_project_id
                ON coach_evaluations(project_id);
            """))
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_coach_evaluations_coach_user_id
                ON coach_evaluations(coach_user_id);
            """))
            print("  ✓ coach_evaluations 인덱스 생성 완료")

            await session.commit()
            print("\n✅ 마이그레이션 완료!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_database())

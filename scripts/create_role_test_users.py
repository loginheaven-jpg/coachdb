"""
역할별 테스트 사용자 계정 생성 스크립트
"""
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent / "backend"))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User, UserStatus
from app.core.security import get_password_hash


async def create_role_test_users():
    """역할별 테스트 사용자 생성"""

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    print("역할별 테스트 사용자 생성 중...")
    print("=" * 70)

    # 사용자 데이터 - 각 역할별로 생성
    users_data = [
        # 슈퍼 관리자 (SUPER_ADMIN)
        {
            "name": "슈퍼관리자",
            "email": "superadmin@test.com",
            "password": "Test2025!",
            "roles": '["SUPER_ADMIN"]',
            "status": UserStatus.ACTIVE
        },
        # 프로젝트 관리자 (PROJECT_MANAGER)
        {
            "name": "프로젝트관리자1",
            "email": "pm1@test.com",
            "password": "Test2025!",
            "roles": '["PROJECT_MANAGER"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "프로젝트관리자2",
            "email": "pm2@test.com",
            "password": "Test2025!",
            "roles": '["PROJECT_MANAGER"]',
            "status": UserStatus.ACTIVE
        },
        # 검증자 (VERIFIER)
        {
            "name": "검증자1",
            "email": "verifier1@test.com",
            "password": "Test2025!",
            "roles": '["VERIFIER"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "검증자2",
            "email": "verifier2@test.com",
            "password": "Test2025!",
            "roles": '["VERIFIER"]',
            "status": UserStatus.ACTIVE
        },
        # 심사위원 (REVIEWER)
        {
            "name": "심사위원1",
            "email": "reviewer1@test.com",
            "password": "Test2025!",
            "roles": '["REVIEWER"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "심사위원2",
            "email": "reviewer2@test.com",
            "password": "Test2025!",
            "roles": '["REVIEWER"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "심사위원3",
            "email": "reviewer3@test.com",
            "password": "Test2025!",
            "roles": '["REVIEWER"]',
            "status": UserStatus.ACTIVE
        },
        # 코치 (COACH)
        {
            "name": "테스트코치1",
            "email": "testcoach1@test.com",
            "password": "Test2025!",
            "roles": '["COACH"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "테스트코치2",
            "email": "testcoach2@test.com",
            "password": "Test2025!",
            "roles": '["COACH"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "테스트코치3",
            "email": "testcoach3@test.com",
            "password": "Test2025!",
            "roles": '["COACH"]',
            "status": UserStatus.ACTIVE
        },
        # 복합 역할 (다중 역할 테스트)
        {
            "name": "PM겸심사위원",
            "email": "pm_reviewer@test.com",
            "password": "Test2025!",
            "roles": '["PROJECT_MANAGER", "REVIEWER"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "검증자겸심사위원",
            "email": "verifier_reviewer@test.com",
            "password": "Test2025!",
            "roles": '["VERIFIER", "REVIEWER"]',
            "status": UserStatus.ACTIVE
        },
    ]

    async with async_session_maker() as session:
        async with session.begin():
            created_count = 0
            skipped_count = 0

            for user_data in users_data:
                # 기존 사용자 확인
                result = await session.execute(
                    select(User).where(User.email == user_data["email"])
                )
                existing = result.scalar_one_or_none()

                if existing:
                    print(f"⚠️  건너뜀: {user_data['email']} (이미 존재)")
                    skipped_count += 1
                    continue

                # 새 사용자 생성
                user = User(
                    name=user_data["name"],
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    roles=user_data["roles"],
                    status=user_data["status"],
                    phone="010-0000-0000",
                    address="서울시 강남구",
                    birthdate="1990-01-01",
                    gender="unknown"
                )
                session.add(user)
                print(f"✅ 생성: {user_data['email']} ({user_data['name']})")
                created_count += 1

    await engine.dispose()

    print("=" * 70)
    print(f"✅ 생성 완료: {created_count}명")
    print(f"⚠️  건너뜀: {skipped_count}명")
    print()
    print("=" * 70)
    print("📋 역할별 테스트 계정 정보")
    print("=" * 70)
    print()
    print("🔴 슈퍼 관리자 (SUPER_ADMIN) - 전체 시스템 관리")
    print("-" * 70)
    print("  superadmin@test.com          Test2025!")
    print()
    print("🟠 프로젝트 관리자 (PROJECT_MANAGER) - 프로젝트 생성/관리")
    print("-" * 70)
    print("  pm1@test.com                 Test2025!")
    print("  pm2@test.com                 Test2025!")
    print()
    print("🟡 검증자 (VERIFIER) - 증빙서류 검토")
    print("-" * 70)
    print("  verifier1@test.com           Test2025!")
    print("  verifier2@test.com           Test2025!")
    print()
    print("🟢 심사위원 (REVIEWER) - 코치 평가/심사")
    print("-" * 70)
    print("  reviewer1@test.com           Test2025!")
    print("  reviewer2@test.com           Test2025!")
    print("  reviewer3@test.com           Test2025!")
    print()
    print("🔵 코치 (COACH) - 일반 사용자")
    print("-" * 70)
    print("  testcoach1@test.com          Test2025!")
    print("  testcoach2@test.com          Test2025!")
    print("  testcoach3@test.com          Test2025!")
    print()
    print("🟣 복합 역할 (다중 역할 테스트)")
    print("-" * 70)
    print("  pm_reviewer@test.com         Test2025!  (PM + 심사위원)")
    print("  verifier_reviewer@test.com   Test2025!  (검증자 + 심사위원)")
    print()
    print("=" * 70)
    print("⚠️  주의: 첫 로그인 후 반드시 비밀번호를 변경하세요!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(create_role_test_users())

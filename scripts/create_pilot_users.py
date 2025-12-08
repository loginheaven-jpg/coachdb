"""
파일럿 테스트용 사용자 계정 생성 스크립트
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


async def create_pilot_users():
    """파일럿 테스트용 사용자 생성"""

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    print("파일럿 테스트 사용자 생성 중...")
    print("=" * 60)

    # 사용자 데이터
    users_data = [
        # 관리자
        {
            "name": "관리자1",
            "email": "admin1@test.com",
            "password": "Pilot2025!",
            "roles": '["admin", "staff"]',
            "status": UserStatus.ACTIVE
        },
        {
            "name": "관리자2",
            "email": "admin2@test.com",
            "password": "Pilot2025!",
            "roles": '["admin", "staff"]',
            "status": UserStatus.ACTIVE
        },
        # 코치
        *[
            {
                "name": f"테스트코치{i}",
                "email": f"coach{i}@test.com",
                "password": "Pilot2025!",
                "roles": '["coach"]',
                "status": UserStatus.ACTIVE
            }
            for i in range(1, 11)  # coach1 ~ coach10
        ]
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

    print("=" * 60)
    print(f"✅ 생성 완료: {created_count}명")
    print(f"⚠️  건너뜀: {skipped_count}명")
    print()
    print("📋 로그인 정보:")
    print("-" * 60)
    print("역할       이메일                  비밀번호")
    print("-" * 60)
    print("관리자1    admin1@test.com        Pilot2025!")
    print("관리자2    admin2@test.com        Pilot2025!")
    for i in range(1, 11):
        print(f"코치{i:2d}     coach{i}@test.com        Pilot2025!")
    print("-" * 60)
    print()
    print("⚠️  주의: 첫 로그인 후 반드시 비밀번호를 변경하세요!")


if __name__ == "__main__":
    asyncio.run(create_pilot_users())

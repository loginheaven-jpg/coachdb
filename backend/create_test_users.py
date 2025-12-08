"""
테스트 사용자 생성/업데이트 스크립트
"""
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User

async def create_test_users():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Test password
        test_password = "test1234"
        hashed_pw = get_password_hash(test_password)

        # Update existing users
        users_to_update = [
            "viproject@naver.com",
            "newuser@test.com"
        ]

        for email in users_to_update:
            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

            if user:
                user.hashed_password = hashed_pw
                print(f"Updated password for {email}")
            else:
                print(f"User {email} not found")

        await session.commit()
        print(f"\nAll passwords updated to: {test_password}")
        print(f"Hash: {hashed_pw[:50]}...")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_test_users())

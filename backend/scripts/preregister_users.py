"""
사전등록 사용자 생성 스크립트
- 지정된 이메일 목록으로 사용자 생성
- 공통 비밀번호: pmstest1
- 역할: PROJECT_MANAGER, VERIFIER, COACH (SUPER_ADMIN 제외)
- name은 빈 문자열 (프로필 미완성 상태)
"""
import asyncio
import sys
import json
from pathlib import Path

# 프로젝트 루트를 path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserStatus

# 사전등록할 이메일 목록
PREREGISTER_EMAILS = [
    "ckmyun@gmail.com",
    "hugucoaching@gmail.com",
    "viproject@naver.com",
    "huhcloud@gmail.com",
    "bizkcoach@gmail.com",
    "ja.catherine.min@gmail.com",
    "hchoe1105@gmail.com",
    "laontreecoach@gmail.com",
    "ajoucoach@gmail.com",
    "plan7696@gmail.com",
    "loginheaven@gmail.com",
    "ros2468@gmail.com",
    "coach7179@gmail.com",
    "kbc0810@gmail.com",
    "sowon2017@naver.com",
    "0917coolturtle@gmail.com",
    "goodtime.yjk@gmail.com",
    "jhlilackim@gmail.com",
    "ruthpark3360@gmail.com",
    "pcm8257@gmail.com",
    "lupincoach@gmail.com",
    "comata3219@gmail.com",
    "jws0217@gmail.com",
    "jwchun.mail@gmail.com",
    "tsha0805@gmail.com",
    "hwangdonghee@gmail.com",
    "snc103911@gmail.com",
    "withdrchoiclinic@gmail.com",
]

# 공통 비밀번호
PASSWORD = "pmstest1"

# 역할 (SUPER_ADMIN 제외)
ROLES = json.dumps(["PROJECT_MANAGER", "VERIFIER", "COACH"])


async def preregister_users():
    """사전등록 사용자 생성"""
    # Railway에서는 async_database_url 사용
    db_url = settings.async_database_url
    print(f"Connecting to database...")

    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    hashed_password = get_password_hash(PASSWORD)
    created_count = 0
    skipped_count = 0
    updated_count = 0

    async with async_session() as session:
        for email in PREREGISTER_EMAILS:
            # 기존 사용자 확인
            result = await session.execute(select(User).where(User.email == email))
            existing_user = result.scalar_one_or_none()

            if existing_user:
                # 기존 사용자가 있으면 비밀번호와 역할만 업데이트
                existing_user.hashed_password = hashed_password
                existing_user.roles = ROLES
                updated_count += 1
                print(f"[UPDATE] {email} - 비밀번호 및 역할 업데이트")
            else:
                # 새 사용자 생성
                new_user = User(
                    email=email,
                    name="",  # 빈 이름 - 프로필 미완성 상태
                    hashed_password=hashed_password,
                    address="미입력",  # 필수 필드이므로 임시값
                    roles=ROLES,
                    status=UserStatus.ACTIVE,
                )
                session.add(new_user)
                created_count += 1
                print(f"[CREATE] {email} - 새 사용자 생성")

        await session.commit()

    await engine.dispose()

    print("\n" + "=" * 50)
    print(f"사전등록 완료!")
    print(f"- 신규 생성: {created_count}명")
    print(f"- 업데이트: {updated_count}명")
    print(f"- 총: {created_count + updated_count}명")
    print(f"- 공통 비밀번호: {PASSWORD}")
    print(f"- 역할: PROJECT_MANAGER, VERIFIER, COACH")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(preregister_users())

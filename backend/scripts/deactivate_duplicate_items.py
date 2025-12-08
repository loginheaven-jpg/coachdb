"""
중복 및 불필요 역량 항목 비활성화 스크립트
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from app.core.config import settings
from app.models.competency import CompetencyItem


async def deactivate_duplicate_items():
    """중복 및 불필요 역량 항목 비활성화"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # Items to deactivate
    items_to_deactivate = [
        "EDU_DEGREE",              # 최종학력 - 학위 항목과 중복
        "EXP_FIELD",               # 코칭분야 - users.coaching_fields와 중복
        "SPEC_STRENGTH",           # 강점 - 모호함
        "COACHING_HOURS",          # 총 코칭시간 - EXP_HOURS와 중복
        "FIELD_BUSINESS_FILE",     # 비즈니스 코칭 증빙서류 - 중복
        "FIELD_CAREER_FILE",       # 커리어 코칭 증빙서류 - 중복
        "FIELD_YOUTH_FILE",        # 청소년 코칭 증빙서류 - 중복
        "FIELD_ADOLESCENT_FILE",   # 청소년기 코칭 증빙서류 - 중복
        "FIELD_FAMILY_FILE",       # 가족 코칭 증빙서류 - 중복
        "FIELD_LIFE_FILE",         # 라이프 코칭 증빙서류 - 중복
        "SPEC_AREA",               # 전문 분야 - 애매함
    ]

    async with async_session() as session:
        async with session.begin():
            print("중복 및 불필요 역량 항목을 비활성화합니다...\n")

            deactivated_count = 0
            for item_code in items_to_deactivate:
                result = await session.execute(
                    select(CompetencyItem).where(
                        CompetencyItem.item_code == item_code
                    )
                )
                item = result.scalar_one_or_none()

                if item:
                    item.is_active = False
                    print(f"  ❌ 비활성화: {item.item_name} ({item.item_code})")
                    deactivated_count += 1
                else:
                    print(f"  ⚠️  없음: {item_code}")

            await session.commit()
            print(f"\n✅ 총 {deactivated_count}개의 역량 항목이 비활성화되었습니다.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(deactivate_duplicate_items())

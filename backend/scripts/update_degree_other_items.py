"""
DEGREE_OTHER를 레벨별로 분리하는 스크립트
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
from app.models.competency import CompetencyItem, CompetencyCategory, InputType


async def update_degree_other_items():
    """DEGREE_OTHER를 레벨별로 분리"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # New degree items
    new_items = [
        {
            "item_name": "기타 학사 학위",
            "item_code": "DEGREE_OTHER_BACHELOR",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "기타 석사 학위",
            "item_code": "DEGREE_OTHER_MASTER",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "기타 박사 학위",
            "item_code": "DEGREE_OTHER_DOCTORATE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
    ]

    async with async_session() as session:
        async with session.begin():
            print("기타 학위 항목을 레벨별로 추가합니다...\n")

            # Deactivate old DEGREE_OTHER item
            result = await session.execute(
                select(CompetencyItem).where(
                    CompetencyItem.item_code == "DEGREE_OTHER"
                )
            )
            old_item = result.scalar_one_or_none()

            if old_item:
                old_item.is_active = False
                print(f"  ℹ️  기존 항목 비활성화: {old_item.item_name} ({old_item.item_code})")

            # Add new items
            added_count = 0
            for item_data in new_items:
                item = CompetencyItem(**item_data)
                session.add(item)
                print(f"  ✓ {item_data['item_name']} ({item_data['item_code']})")
                added_count += 1

            await session.commit()
            print(f"\n✅ 총 {added_count}개의 역량 항목이 추가되었습니다.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(update_degree_other_items())

"""
새 역량 항목 추가 및 이름 변경 스크립트
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.competency import CompetencyItem, CompetencyCategory, InputType


async def add_and_update_items():
    """새 역량 항목 추가 및 이름 변경"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # New items to add
    new_items = [
        {
            "item_name": "상담,심리치료관련 자격",
            "item_code": "CERT_COUNSELING",
            "category": CompetencyCategory.DETAIL,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "멘토링/수퍼비전 경험",
            "item_code": "FIELD_MENTORING",
            "category": CompetencyCategory.DETAIL,
            "input_type": InputType.TEXT,
            "is_active": True
        },
    ]

    # Items to rename
    items_to_rename = {
        "FIELD_ADOLESCENT": "청년 코칭 이력",
        "FIELD_FAMILY": "부부/가족 코칭 이력",
    }

    async with async_session() as session:
        async with session.begin():
            print("새 역량 항목을 추가합니다...\n")

            # Add new items
            added_count = 0
            for item_data in new_items:
                # Check if already exists
                result = await session.execute(
                    select(CompetencyItem).where(
                        CompetencyItem.item_code == item_data["item_code"]
                    )
                )
                existing = result.scalar_one_or_none()

                if not existing:
                    item = CompetencyItem(**item_data)
                    session.add(item)
                    print(f"  ✓ 추가: {item_data['item_name']} ({item_data['item_code']})")
                    added_count += 1
                else:
                    print(f"  ⚠️  이미 존재: {item_data['item_name']} ({item_data['item_code']})")

            print(f"\n역량 항목 이름을 변경합니다...\n")

            # Rename items
            renamed_count = 0
            for item_code, new_name in items_to_rename.items():
                result = await session.execute(
                    select(CompetencyItem).where(
                        CompetencyItem.item_code == item_code
                    )
                )
                item = result.scalar_one_or_none()

                if item:
                    old_name = item.item_name
                    item.item_name = new_name
                    print(f"  ✓ 변경: {old_name} → {new_name} ({item_code})")
                    renamed_count += 1
                else:
                    print(f"  ⚠️  없음: {item_code}")

            await session.commit()
            print(f"\n✅ {added_count}개 항목 추가, {renamed_count}개 항목 이름 변경 완료")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(add_and_update_items())

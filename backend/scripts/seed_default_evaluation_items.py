"""
기본 평가항목 초기 데이터 삽입 스크립트

이전과제수행평가, 심사위원평가 등 모든 과제에 자동으로 추가되는 평가 항목
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


async def seed_default_evaluation_items():
    """기본 평가항목 초기 데이터 삽입"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # 기본 평가항목 데이터
    # 이 항목들은 모든 과제에 자동으로 추가되어야 함
    default_evaluation_items = [
        {
            "item_name": "이전과제수행평가",
            "item_code": "EVAL_PREVIOUS_PROJECT",
            "category": CompetencyCategory.DETAIL,  # 모든 과제에 활용
            "input_type": InputType.SELECT,
            "is_active": True,
            "description": "이전 과제 수행 능력에 대한 평가 (미비: 1점, 양호: 3점, 우수: 5점)"
        },
        {
            "item_name": "심사위원평가",
            "item_code": "EVAL_COMMITTEE",
            "category": CompetencyCategory.DETAIL,  # 모든 과제에 활용
            "input_type": InputType.SELECT,
            "is_active": True,
            "description": "심사위원의 종합 평가 (미비: 1점, 양호: 3점, 우수: 5점)"
        },
    ]

    async with async_session() as session:
        async with session.begin():
            print("기본 평가항목 데이터를 삽입합니다...")

            for item_data in default_evaluation_items:
                # Check if item already exists
                result = await session.execute(
                    select(CompetencyItem).where(
                        CompetencyItem.item_code == item_data["item_code"]
                    )
                )
                existing_item = result.scalar_one_or_none()

                if existing_item:
                    print(f"  ⊘ {item_data['item_name']} ({item_data['item_code']}) - 이미 존재함")
                    continue

                # Remove description from item_data if CompetencyItem doesn't have it
                description = item_data.pop("description", None)
                item = CompetencyItem(**item_data)
                session.add(item)
                print(f"  ✓ {item_data['item_name']} ({item_data['item_code']})")
                if description:
                    print(f"    {description}")

            await session.commit()
            print(f"\n기본 평가항목 삽입이 완료되었습니다.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_default_evaluation_items())

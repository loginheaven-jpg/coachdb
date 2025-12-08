"""
INFO 카테고리 역량 항목 삭제 스크립트
기본 정보(이름, 이메일, 전화번호, 주소)는 user 테이블에 있으므로 중복 제거
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.core.config import settings
from app.models.competency import CompetencyItem, CompetencyCategory


async def remove_info_items():
    """INFO 카테고리 항목 삭제"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        async with session.begin():
            print("INFO 카테고리 역량 항목을 삭제합니다...")

            # Find INFO category items
            result = await session.execute(
                select(CompetencyItem).where(
                    CompetencyItem.category == CompetencyCategory.INFO
                )
            )
            items = result.scalars().all()

            if not items:
                print("  ℹ️  삭제할 INFO 항목이 없습니다.")
            else:
                print(f"  📋 {len(items)}개의 INFO 항목을 발견했습니다:")
                for item in items:
                    print(f"     - {item.item_name} ({item.item_code})")

                # Delete INFO items
                await session.execute(
                    delete(CompetencyItem).where(
                        CompetencyItem.category == CompetencyCategory.INFO
                    )
                )

                await session.commit()
                print(f"\n  ✅ {len(items)}개의 INFO 항목이 삭제되었습니다.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(remove_info_items())

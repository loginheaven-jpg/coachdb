"""
역량 항목 데이터 업데이트 스크립트
- BASIC_BIRTHDATE: "생년월일" → "생년"
- DETAIL_HIGHEST_CERT: 옵션을 ["KSC", "KPC", "KAC", "기타"]로 변경
"""
import asyncio
import sys
import json
from pathlib import Path

# Support both local dev and Docker container environments
script_dir = Path(__file__).parent
if (script_dir.parent / "backend").exists():
    sys.path.insert(0, str(script_dir.parent / "backend"))
else:
    sys.path.insert(0, str(script_dir.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from app.core.config import settings
from app.models.competency import CompetencyItem


async def update_competency_items():
    """역량 항목 데이터 업데이트"""

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    print("=" * 70)
    print("역량 항목 데이터 업데이트 시작")
    print("=" * 70)

    async with async_session_maker() as session:
        async with session.begin():
            updated_count = 0

            # 1. BASIC_BIRTHDATE: "생년월일" → "생년"
            result = await session.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == "BASIC_BIRTHDATE")
            )
            birthdate_item = result.scalar_one_or_none()

            if birthdate_item:
                old_name = birthdate_item.item_name
                birthdate_item.item_name = "생년"
                print(f"  ✅ BASIC_BIRTHDATE: '{old_name}' → '생년'")
                updated_count += 1
            else:
                print(f"  ⚠️ BASIC_BIRTHDATE 항목을 찾을 수 없음")

            # 2. DETAIL_HIGHEST_CERT: 옵션 변경
            result = await session.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == "DETAIL_HIGHEST_CERT")
            )
            cert_item = result.scalar_one_or_none()

            if cert_item:
                old_config = cert_item.template_config
                new_options = ["KSC", "KPC", "KAC", "기타"]
                cert_item.template_config = json.dumps({"options": new_options})
                print(f"  ✅ DETAIL_HIGHEST_CERT 옵션 변경:")
                print(f"      이전: {old_config}")
                print(f"      이후: {cert_item.template_config}")
                updated_count += 1
            else:
                print(f"  ⚠️ DETAIL_HIGHEST_CERT 항목을 찾을 수 없음")

    await engine.dispose()

    print()
    print("=" * 70)
    print(f"✅ 업데이트 완료: {updated_count}개 항목")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(update_competency_items())

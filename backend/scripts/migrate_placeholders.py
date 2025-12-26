"""
Placeholder 개선 마이그레이션 스크립트

코칭 경력 필드와 전문분야 필드의 placeholder를 구체적인 예시로 업데이트
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.competency import CompetencyItem, CompetencyItemField


# 업데이트할 placeholder 정의
PLACEHOLDER_UPDATES = {
    # 코칭 경력 필드 (COACHING_HISTORY 템플릿)
    "project_name": "예) 2024년 서울시 청년 커리어 코칭, ICF ACC 인증과정 코칭 실습",
    "organization": "예) 한국코치협회, 서울시청, OO대학교 창업지원단, XX기업 인사팀",
    # period는 이미 "예: 2023.01 ~ 2023.12"로 되어 있어 유지
    "description": "예) 신입사원 10명 대상 1:1 커리어 코칭 월 2회 진행, 총 24회 세션 완료",
}

# 전문분야 (SPECIALTY) 항목의 placeholder
SPECIALTY_PLACEHOLDER = "코칭 분야(비즈니스, 라이프 등)로 표현될 수 없는 구체적인 전문성을 자유롭게 기재해 주세요."


async def migrate_placeholders():
    """Placeholder 값 업데이트"""

    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    print("=" * 60)
    print("Placeholder 개선 마이그레이션")
    print("=" * 60)

    async with async_session() as session:
        # 1. 코칭 경력 필드 업데이트
        print("\n[1] 코칭 경력 필드 placeholder 업데이트")

        for field_name, new_placeholder in PLACEHOLDER_UPDATES.items():
            result = await session.execute(
                update(CompetencyItemField)
                .where(CompetencyItemField.field_name == field_name)
                .values(placeholder=new_placeholder)
            )
            print(f"  ✓ {field_name}: {result.rowcount}개 레코드 업데이트")

        # 2. 전문분야 (SPECIALTY) 항목의 value 필드 업데이트
        print("\n[2] 전문분야 (SPECIALTY) placeholder 업데이트")

        # SPECIALTY 항목의 item_id 조회
        specialty_result = await session.execute(
            select(CompetencyItem).where(CompetencyItem.item_code == "SPECIALTY")
        )
        specialty_item = specialty_result.scalar_one_or_none()

        if specialty_item:
            # 해당 항목의 value 필드 업데이트
            result = await session.execute(
                update(CompetencyItemField)
                .where(
                    CompetencyItemField.item_id == specialty_item.item_id,
                    CompetencyItemField.field_name == "value"
                )
                .values(placeholder=SPECIALTY_PLACEHOLDER)
            )
            print(f"  ✓ SPECIALTY.value: {result.rowcount}개 레코드 업데이트")
        else:
            print("  ⚠ SPECIALTY 항목을 찾을 수 없습니다")

        await session.commit()

        # 3. 결과 확인
        print("\n[3] 업데이트 결과 확인")

        # 코칭 경력 필드 확인
        for field_name in PLACEHOLDER_UPDATES.keys():
            result = await session.execute(
                select(CompetencyItemField)
                .where(CompetencyItemField.field_name == field_name)
                .limit(1)
            )
            field = result.scalar_one_or_none()
            if field:
                print(f"  {field_name}: {field.placeholder[:50]}...")

        # 전문분야 확인
        if specialty_item:
            result = await session.execute(
                select(CompetencyItemField)
                .where(
                    CompetencyItemField.item_id == specialty_item.item_id,
                    CompetencyItemField.field_name == "value"
                )
            )
            field = result.scalar_one_or_none()
            if field:
                print(f"  SPECIALTY.value: {field.placeholder[:50]}...")

        print("\n" + "=" * 60)
        print("마이그레이션 완료!")
        print("=" * 60)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_placeholders())

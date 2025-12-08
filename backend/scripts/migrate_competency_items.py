"""
역량 항목 마이그레이션 스크립트
- EDU_DEGREE item_name을 '일반학력'으로 변경
- COACH_DEGREE 항목 추가 (코칭/상담 관련 학력)
- ADDON_COACHING_HISTORY 삭제
- COACHING 그룹 6개 항목 추가
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.competency import CompetencyItem, CompetencyCategory, InputType, ItemTemplate


async def migrate_competency_items():
    """역량 항목 마이그레이션"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        async with session.begin():
            print("=" * 60)
            print("역량 항목 마이그레이션 시작")
            print("=" * 60)

            # 1. EDU_DEGREE item_name을 '일반학력'으로 변경
            print("\n[1] EDU_DEGREE 항목 이름 변경...")
            result = await session.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == "EDU_DEGREE")
            )
            edu_degree = result.scalar_one_or_none()
            if edu_degree:
                edu_degree.item_name = "일반학력"
                edu_degree.template = ItemTemplate.DEGREE
                edu_degree.description = "최종 학력을 선택하고 학위/전공 정보를 입력해주세요"
                print(f"  ✓ EDU_DEGREE: '{edu_degree.item_name}' 으로 변경")
            else:
                print("  ⚠ EDU_DEGREE 항목을 찾을 수 없습니다")

            # 2. COACH_DEGREE 항목 추가 (중복 체크)
            print("\n[2] COACH_DEGREE 항목 추가...")
            result = await session.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == "COACH_DEGREE")
            )
            existing = result.scalar_one_or_none()
            if not existing:
                coach_degree = CompetencyItem(
                    item_name="코칭/상담 관련 학력",
                    item_code="COACH_DEGREE",
                    category=CompetencyCategory.EDUCATION,
                    input_type=InputType.FILE,
                    template=ItemTemplate.DEGREE,
                    is_repeatable=True,
                    max_entries=5,
                    is_active=True,
                    description="코칭/상담 관련 학위가 있으시면 입력해주세요"
                )
                session.add(coach_degree)
                print(f"  ✓ COACH_DEGREE 추가: 코칭/상담 관련 학력")
            else:
                print(f"  - COACH_DEGREE 이미 존재")

            # 3. ADDON_COACHING_HISTORY 비활성화 (참조 데이터가 있어 삭제 불가)
            print("\n[3] ADDON_COACHING_HISTORY 비활성화...")
            result = await session.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == "ADDON_COACHING_HISTORY")
            )
            coaching_history = result.scalar_one_or_none()
            if coaching_history:
                # 실제 삭제 대신 비활성화 (application_data 참조가 있을 수 있음)
                coaching_history.is_active = False
                coaching_history.item_name = "[삭제됨] 코칭 이력"
                print(f"  ✓ ADDON_COACHING_HISTORY 비활성화 완료 (기존 데이터 보존)")
            else:
                print(f"  - ADDON_COACHING_HISTORY 없음")

            # 4. COACHING 그룹 6개 항목 추가
            print("\n[4] COACHING 그룹 항목 추가...")
            coaching_items = [
                {
                    "item_name": "비즈니스 코칭 이력",
                    "item_code": "FIELD_BUSINESS",
                    "description": "비즈니스/조직 코칭 경험을 입력해주세요"
                },
                {
                    "item_name": "커리어 코칭 이력",
                    "item_code": "FIELD_CAREER",
                    "description": "커리어/진로 코칭 경험을 입력해주세요"
                },
                {
                    "item_name": "청년 코칭 이력",
                    "item_code": "FIELD_YOUTH",
                    "description": "청년 코칭 경험을 입력해주세요"
                },
                {
                    "item_name": "청소년 코칭 이력",
                    "item_code": "FIELD_ADOLESCENT",
                    "description": "청소년 코칭 경험을 입력해주세요"
                },
                {
                    "item_name": "가족 코칭 이력",
                    "item_code": "FIELD_FAMILY",
                    "description": "가족 코칭 경험을 입력해주세요"
                },
                {
                    "item_name": "라이프 코칭 이력",
                    "item_code": "FIELD_LIFE",
                    "description": "라이프 코칭 경험을 입력해주세요"
                },
            ]

            added_count = 0
            for item_data in coaching_items:
                result = await session.execute(
                    select(CompetencyItem).where(CompetencyItem.item_code == item_data["item_code"])
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    item = CompetencyItem(
                        item_name=item_data["item_name"],
                        item_code=item_data["item_code"],
                        category=CompetencyCategory.COACHING,
                        input_type=InputType.TEXT,
                        template=ItemTemplate.TEXT_FILE,
                        is_repeatable=True,
                        max_entries=10,
                        is_active=True,
                        description=item_data["description"]
                    )
                    session.add(item)
                    print(f"  ✓ {item_data['item_code']}: {item_data['item_name']}")
                    added_count += 1
                else:
                    print(f"  - {item_data['item_code']} 이미 존재")

            # 5. 기존 ADDON 항목에 template 설정 (NULL인 경우)
            print("\n[5] 기존 항목 template 설정...")
            template_mapping = {
                "ADDON_SPECIALTY": ItemTemplate.TEXT,
                "ADDON_INTRO": ItemTemplate.TEXT,
                "ADDON_COACHING_HOURS": ItemTemplate.NUMBER,
                "ADDON_CERT_COACH": ItemTemplate.TEXT_FILE,
                "ADDON_CERT_COUNSELING": ItemTemplate.TEXT_FILE,
                "ADDON_CERT_OTHER": ItemTemplate.TEXT_FILE,
                "ADDON_COACH_TRAINING": ItemTemplate.TEXT_FILE,
                "ADDON_WORK_EXPERIENCE": ItemTemplate.TEXT_FILE,
            }

            for item_code, template in template_mapping.items():
                result = await session.execute(
                    select(CompetencyItem).where(CompetencyItem.item_code == item_code)
                )
                item = result.scalar_one_or_none()
                if item and item.template is None:
                    item.template = template
                    if template == ItemTemplate.TEXT_FILE:
                        item.is_repeatable = True
                        item.max_entries = 10
                    print(f"  ✓ {item_code}: template={template.value}")

            await session.commit()

            print("\n" + "=" * 60)
            print("마이그레이션 완료!")
            print("=" * 60)

            # 최종 결과 출력
            print("\n[최종 역량 항목 현황]")
            result = await session.execute(
                select(CompetencyItem)
                .where(CompetencyItem.is_active == True)
                .order_by(CompetencyItem.category, CompetencyItem.item_code)
            )
            items = result.scalars().all()

            current_category = None
            for item in items:
                if item.category != current_category:
                    current_category = item.category
                    print(f"\n{current_category.value}:")
                template_str = item.template.value if item.template else "NULL"
                repeatable_str = " (복수)" if item.is_repeatable else ""
                print(f"  - {item.item_code}: {item.item_name} [{template_str}]{repeatable_str}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_competency_items())

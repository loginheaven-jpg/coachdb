"""
DetailedProfile 관련 역량 항목 추가 스크립트
학위, 코칭 이력 등의 항목 추가
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.competency import CompetencyItem, CompetencyCategory, InputType


async def seed_detailed_profile_items():
    """DetailedProfile 관련 역량 항목 추가"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # DetailedProfile 관련 항목
    detailed_items = [
        # 코칭 시간
        {
            "item_name": "총 코칭 시간",
            "item_code": "COACHING_HOURS",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.NUMBER,
            "is_active": True
        },

        # 학위 항목 - 파일 + 텍스트
        {
            "item_name": "코칭/상담 관련 학사 학위",
            "item_code": "DEGREE_COACHING_BACHELOR",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "코칭/상담 관련 석사 학위",
            "item_code": "DEGREE_COACHING_MASTER",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "코칭/상담 관련 박사 학위",
            "item_code": "DEGREE_COACHING_DOCTORATE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "기타 학위",
            "item_code": "DEGREE_OTHER",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },

        # 코칭 분야별 이력 - 파일 + 텍스트
        {
            "item_name": "비즈니스 코칭 이력",
            "item_code": "FIELD_BUSINESS",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "비즈니스 코칭 증빙서류",
            "item_code": "FIELD_BUSINESS_FILE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "커리어 코칭 이력",
            "item_code": "FIELD_CAREER",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "커리어 코칭 증빙서류",
            "item_code": "FIELD_CAREER_FILE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "청소년 코칭 이력",
            "item_code": "FIELD_YOUTH",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "청소년 코칭 증빙서류",
            "item_code": "FIELD_YOUTH_FILE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "청소년기 코칭 이력",
            "item_code": "FIELD_ADOLESCENT",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "청소년기 코칭 증빙서류",
            "item_code": "FIELD_ADOLESCENT_FILE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "가족 코칭 이력",
            "item_code": "FIELD_FAMILY",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "가족 코칭 증빙서류",
            "item_code": "FIELD_FAMILY_FILE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "라이프 코칭 이력",
            "item_code": "FIELD_LIFE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "라이프 코칭 증빙서류",
            "item_code": "FIELD_LIFE_FILE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
    ]

    async with async_session() as session:
        async with session.begin():
            print("DetailedProfile 관련 역량 항목을 추가합니다...\n")

            added_count = 0
            for item_data in detailed_items:
                item = CompetencyItem(**item_data)
                session.add(item)
                print(f"  ✓ {item_data['item_name']} ({item_data['item_code']})")
                added_count += 1

            await session.commit()
            print(f"\n✅ 총 {added_count}개의 역량 항목이 추가되었습니다.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_detailed_profile_items())

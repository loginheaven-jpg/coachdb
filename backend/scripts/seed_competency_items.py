"""
역량 항목 초기 데이터 삽입 스크립트
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


async def seed_competency_items():
    """역량 항목 초기 데이터 삽입"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # 역량 항목 데이터
    competency_items_data = [
        # 기본 정보 항목
        {
            "item_name": "이름",
            "item_code": "INFO_NAME",
            "category": CompetencyCategory.INFO,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "이메일",
            "item_code": "INFO_EMAIL",
            "category": CompetencyCategory.INFO,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "전화번호",
            "item_code": "INFO_PHONE",
            "category": CompetencyCategory.INFO,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "주소",
            "item_code": "INFO_ADDRESS",
            "category": CompetencyCategory.INFO,
            "input_type": InputType.TEXT,
            "is_active": True
        },

        # 학력/자격증
        {
            "item_name": "최종학력",
            "item_code": "EDU_DEGREE",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.SELECT,
            "is_active": True
        },
        {
            "item_name": "코치 자격증",
            "item_code": "CERT_COACH",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },
        {
            "item_name": "기타 자격증",
            "item_code": "CERT_OTHER",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.FILE,
            "is_active": True
        },

        # 경력
        {
            "item_name": "총 코칭 경력(년)",
            "item_code": "EXP_YEARS",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.NUMBER,
            "is_active": True
        },
        {
            "item_name": "누적 코칭 시간",
            "item_code": "EXP_HOURS",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.NUMBER,
            "is_active": True
        },
        {
            "item_name": "코칭 분야",
            "item_code": "EXP_FIELD",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.SELECT,
            "is_active": True
        },
        {
            "item_name": "주요 코칭 실적",
            "item_code": "EXP_ACHIEVEMENT",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },

        # 전문성
        {
            "item_name": "전문 분야",
            "item_code": "SPEC_AREA",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
        {
            "item_name": "강점",
            "item_code": "SPEC_STRENGTH",
            "category": CompetencyCategory.EVALUATION,
            "input_type": InputType.TEXT,
            "is_active": True
        },
    ]

    async with async_session() as session:
        async with session.begin():
            print("역량 항목 데이터를 삽입합니다...")

            for item_data in competency_items_data:
                item = CompetencyItem(**item_data)
                session.add(item)
                print(f"  ✓ {item_data['item_name']} ({item_data['item_code']})")

            await session.commit()
            print(f"\n총 {len(competency_items_data)}개의 역량 항목이 삽입되었습니다.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_competency_items())

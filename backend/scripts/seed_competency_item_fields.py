"""
역량 항목 세부 필드 데이터 삽입 스크립트
- DEGREE 템플릿 필드
- TEXT_FILE 템플릿 필드
- COACHING 그룹 필드
"""
import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.competency import CompetencyItem, CompetencyItemField


# 필드 정의
DEGREE_FIELDS = [
    {
        "field_name": "degree_type",
        "field_label": "학위유형",
        "field_type": "select",
        "field_options": json.dumps(["전문학사", "학사", "석사", "박사"]),
        "is_required": True,
        "display_order": 1,
        "placeholder": "학위 유형을 선택하세요"
    },
    {
        "field_name": "major",
        "field_label": "전공",
        "field_type": "text",
        "field_options": None,
        "is_required": True,
        "display_order": 2,
        "placeholder": "전공명을 입력하세요"
    },
    {
        "field_name": "school",
        "field_label": "학교명",
        "field_type": "text",
        "field_options": None,
        "is_required": True,
        "display_order": 3,
        "placeholder": "학교명을 입력하세요"
    },
    {
        "field_name": "graduation_year",
        "field_label": "졸업년도",
        "field_type": "number",
        "field_options": None,
        "is_required": False,
        "display_order": 4,
        "placeholder": "예: 2020"
    }
]

TEXT_FILE_FIELDS = [
    {
        "field_name": "description",
        "field_label": "내용",
        "field_type": "textarea",
        "field_options": None,
        "is_required": True,
        "display_order": 1,
        "placeholder": "내용을 입력하세요"
    },
    {
        "field_name": "file",
        "field_label": "증빙파일",
        "field_type": "file",
        "field_options": None,
        "is_required": False,
        "display_order": 2,
        "placeholder": None
    }
]

COACHING_HISTORY_FIELDS = [
    {
        "field_name": "project_name",
        "field_label": "과제명/프로그램명",
        "field_type": "text",
        "field_options": None,
        "is_required": True,
        "display_order": 1,
        "placeholder": "예) 2024년 서울시 청년 커리어 코칭, ICF ACC 인증과정 코칭 실습"
    },
    {
        "field_name": "organization",
        "field_label": "기관명",
        "field_type": "text",
        "field_options": None,
        "is_required": True,
        "display_order": 2,
        "placeholder": "예) 한국코치협회, 서울시청, OO대학교 창업지원단, XX기업 인사팀"
    },
    {
        "field_name": "period",
        "field_label": "활동기간",
        "field_type": "text",
        "field_options": None,
        "is_required": True,
        "display_order": 3,
        "placeholder": "예: 2023.01 ~ 2023.12"
    },
    {
        "field_name": "role",
        "field_label": "역할",
        "field_type": "select",
        "field_options": json.dumps(["리더코치", "참여코치", "수퍼바이저"]),
        "is_required": True,
        "display_order": 4,
        "placeholder": "역할을 선택하세요"
    },
    {
        "field_name": "description",
        "field_label": "활동내용",
        "field_type": "textarea",
        "field_options": None,
        "is_required": False,
        "display_order": 5,
        "placeholder": "예) 신입사원 10명 대상 1:1 커리어 코칭 월 2회 진행, 총 24회 세션 완료"
    },
    {
        "field_name": "file",
        "field_label": "증빙파일",
        "field_type": "file",
        "field_options": None,
        "is_required": False,
        "display_order": 6,
        "placeholder": None
    }
]

# 항목코드별 필드 매핑
ITEM_FIELD_MAPPING = {
    # DEGREE 템플릿 항목
    "EDU_DEGREE": DEGREE_FIELDS,
    "COACH_DEGREE": DEGREE_FIELDS,

    # TEXT_FILE 템플릿 항목 (자격증, 경력)
    "ADDON_CERT_COACH": TEXT_FILE_FIELDS,
    "ADDON_CERT_COUNSELING": TEXT_FILE_FIELDS,
    "ADDON_CERT_OTHER": TEXT_FILE_FIELDS,
    "ADDON_COACH_TRAINING": TEXT_FILE_FIELDS,
    "ADDON_WORK_EXPERIENCE": TEXT_FILE_FIELDS,

    # COACHING 그룹 항목 (코칭 이력)
    "FIELD_BUSINESS": COACHING_HISTORY_FIELDS,
    "FIELD_CAREER": COACHING_HISTORY_FIELDS,
    "FIELD_YOUTH": COACHING_HISTORY_FIELDS,
    "FIELD_ADOLESCENT": COACHING_HISTORY_FIELDS,
    "FIELD_FAMILY": COACHING_HISTORY_FIELDS,
    "FIELD_LIFE": COACHING_HISTORY_FIELDS,
}


async def seed_competency_item_fields():
    """역량 항목 세부 필드 데이터 삽입"""

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        print("=" * 60)
        print("역량 항목 세부 필드 데이터 삽입")
        print("=" * 60)

        total_added = 0

        for item_code, fields in ITEM_FIELD_MAPPING.items():
            # 항목 ID 조회
            result = await session.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == item_code)
            )
            item = result.scalar_one_or_none()

            if not item:
                print(f"\n⚠ {item_code}: 항목을 찾을 수 없습니다")
                continue

            # 기존 필드 삭제 (재실행 시 중복 방지)
            result = await session.execute(
                select(CompetencyItemField).where(CompetencyItemField.item_id == item.item_id)
            )
            existing_fields = result.scalars().all()
            if existing_fields:
                for f in existing_fields:
                    await session.delete(f)
                print(f"\n{item_code} (ID:{item.item_id}): 기존 {len(existing_fields)}개 필드 삭제")

            # 새 필드 추가
            print(f"\n{item_code} (ID:{item.item_id}): {item.item_name}")
            for field_data in fields:
                field = CompetencyItemField(
                    item_id=item.item_id,
                    **field_data
                )
                session.add(field)
                print(f"  + {field_data['field_name']}: {field_data['field_label']} ({field_data['field_type']})")
                total_added += 1

        await session.commit()

        print("\n" + "=" * 60)
        print(f"완료! 총 {total_added}개 필드 추가됨")
        print("=" * 60)

        # 결과 확인
        print("\n[필드 추가 결과]")
        result = await session.execute(
            select(CompetencyItem, CompetencyItemField)
            .outerjoin(CompetencyItemField)
            .where(CompetencyItem.item_code.in_(ITEM_FIELD_MAPPING.keys()))
            .order_by(CompetencyItem.item_code, CompetencyItemField.display_order)
        )

        current_item = None
        for item, field in result.all():
            if current_item != item.item_code:
                current_item = item.item_code
                print(f"\n{item.item_code}:")
            if field:
                print(f"  - {field.field_name}: {field.field_label}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_competency_item_fields())

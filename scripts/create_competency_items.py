"""
기본 역량 항목 생성 스크립트
- 프로젝트 설문에서 선택할 수 있는 역량 항목들
- 코치가 자신의 역량을 등록할 때 사용하는 항목들
"""
import asyncio
import sys
import json
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent / "backend"))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from app.core.config import settings
from app.models.competency import CompetencyItem, CompetencyItemField, CompetencyCategory, InputType, ItemTemplate


async def create_competency_items():
    """기본 역량 항목 생성"""

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    print("=" * 70)
    print("기본 역량 항목 생성 시작")
    print("=" * 70)

    # 역량 항목 정의
    items_data = [
        # ==================== 기본정보 (BASIC) ====================
        {
            "item_code": "BASIC_NAME",
            "item_name": "이름",
            "category": CompetencyCategory.BASIC,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "BASIC_PHONE",
            "item_name": "연락처",
            "category": CompetencyCategory.BASIC,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "BASIC_EMAIL",
            "item_name": "이메일",
            "category": CompetencyCategory.BASIC,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "BASIC_ADDRESS",
            "item_name": "거주지역 (시/군/구)",
            "category": CompetencyCategory.BASIC,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "BASIC_BIRTHDATE",
            "item_name": "생년월일",
            "category": CompetencyCategory.BASIC,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "BASIC_GENDER",
            "item_name": "성별",
            "category": CompetencyCategory.BASIC,
            "input_type": InputType.SELECT,
            "template": ItemTemplate.SELECT,
            "template_config": json.dumps({"options": ["남성", "여성"]}),
            "is_repeatable": False,
            "fields": []
        },

        # ==================== 세부정보 (DETAIL) ====================
        {
            "item_code": "DETAIL_COACHING_AREA",
            "item_name": "대면코칭 가능지역",
            "category": CompetencyCategory.DETAIL,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "DETAIL_COACHING_FIELDS",
            "item_name": "코칭 분야",
            "category": CompetencyCategory.DETAIL,
            "input_type": InputType.SELECT,
            "template": ItemTemplate.MULTISELECT,
            "template_config": json.dumps({
                "options": [
                    "라이프코칭", "커리어코칭", "비즈니스코칭",
                    "리더십코칭", "팀코칭", "그룹코칭", "기타"
                ]
            }),
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "DETAIL_HIGHEST_CERT",
            "item_name": "최상위 코치 자격",
            "category": CompetencyCategory.DETAIL,
            "input_type": InputType.SELECT,
            "template": ItemTemplate.SELECT,
            "template_config": json.dumps({
                "options": ["MCC", "PCC", "ACC", "KPC", "KAC", "기타", "없음"]
            }),
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "DETAIL_CERT_NUMBER",
            "item_name": "자격증 번호",
            "category": CompetencyCategory.DETAIL,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": []
        },

        # ==================== 학력 (EDUCATION) ====================
        {
            "item_code": "EDU_DEGREE",
            "item_name": "학력",
            "category": CompetencyCategory.EDUCATION,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.DEGREE,
            "template_config": json.dumps({
                "degree_options": ["박사", "석사", "학사", "전문학사", "고졸", "기타"]
            }),
            "is_repeatable": True,
            "max_entries": 5,
            "fields": [
                {"field_name": "degree_level", "field_label": "학위", "field_type": "select",
                 "field_options": json.dumps(["박사", "석사", "학사", "전문학사", "고졸", "기타"]),
                 "is_required": True, "display_order": 1},
                {"field_name": "school_name", "field_label": "학교명", "field_type": "text",
                 "is_required": True, "display_order": 2, "placeholder": "예: 서울대학교"},
                {"field_name": "major", "field_label": "전공", "field_type": "text",
                 "is_required": True, "display_order": 3, "placeholder": "예: 경영학"},
                {"field_name": "graduation_year", "field_label": "졸업연도", "field_type": "text",
                 "is_required": False, "display_order": 4, "placeholder": "예: 2020"},
                {"field_name": "proof_file", "field_label": "졸업증명서", "field_type": "file",
                 "is_required": False, "display_order": 5}
            ]
        },

        # ==================== 추가역량 (ADDON) - 자격증 ====================
        {
            "item_code": "ADDON_CERT_COACH",
            "item_name": "코치 자격증",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "max_entries": 10,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증명", "field_type": "text",
                 "is_required": True, "display_order": 1, "placeholder": "예: KPC(한국코치협회)"},
                {"field_name": "cert_number", "field_label": "자격번호", "field_type": "text",
                 "is_required": False, "display_order": 2},
                {"field_name": "issued_org", "field_label": "발급기관", "field_type": "text",
                 "is_required": True, "display_order": 3, "placeholder": "예: ICF"},
                {"field_name": "issued_date", "field_label": "취득일", "field_type": "text",
                 "is_required": False, "display_order": 4, "placeholder": "예: 2023-05-01"},
                {"field_name": "proof_file", "field_label": "자격증 사본", "field_type": "file",
                 "is_required": False, "display_order": 5}
            ]
        },
        {
            "item_code": "ADDON_CERT_COUNSELING",
            "item_name": "상담/심리 자격증",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "max_entries": 10,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증명", "field_type": "text",
                 "is_required": True, "display_order": 1, "placeholder": "예: 임상심리전문가"},
                {"field_name": "cert_number", "field_label": "자격번호", "field_type": "text",
                 "is_required": False, "display_order": 2},
                {"field_name": "issued_org", "field_label": "발급기관", "field_type": "text",
                 "is_required": True, "display_order": 3},
                {"field_name": "issued_date", "field_label": "취득일", "field_type": "text",
                 "is_required": False, "display_order": 4, "placeholder": "예: 2023-05-01"},
                {"field_name": "proof_file", "field_label": "자격증 사본", "field_type": "file",
                 "is_required": False, "display_order": 5}
            ]
        },
        {
            "item_code": "ADDON_CERT_OTHER",
            "item_name": "기타 자격증",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "max_entries": 10,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증명", "field_type": "text",
                 "is_required": True, "display_order": 1},
                {"field_name": "cert_number", "field_label": "자격번호", "field_type": "text",
                 "is_required": False, "display_order": 2},
                {"field_name": "issued_org", "field_label": "발급기관", "field_type": "text",
                 "is_required": True, "display_order": 3},
                {"field_name": "issued_date", "field_label": "취득일", "field_type": "text",
                 "is_required": False, "display_order": 4, "placeholder": "예: 2023-05-01"},
                {"field_name": "proof_file", "field_label": "자격증 사본", "field_type": "file",
                 "is_required": False, "display_order": 5}
            ]
        },

        # ==================== 추가역량 (ADDON) - 경력/이력 ====================
        {
            "item_code": "ADDON_COACHING_HOURS",
            "item_name": "코칭 시간 (총 누적)",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.NUMBER,
            "template": ItemTemplate.NUMBER,
            "template_config": json.dumps({"unit": "시간", "min": 0, "max": 99999}),
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "ADDON_COACHING_HISTORY",
            "item_name": "코칭 경력",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.COACHING_HISTORY,
            "is_repeatable": True,
            "max_entries": 20,
            "fields": [
                {"field_name": "org_name", "field_label": "기관/회사명", "field_type": "text",
                 "is_required": True, "display_order": 1, "placeholder": "예: 삼성전자"},
                {"field_name": "coaching_type", "field_label": "코칭 유형", "field_type": "select",
                 "field_options": json.dumps(["1:1코칭", "그룹코칭", "팀코칭", "워크샵", "기타"]),
                 "is_required": True, "display_order": 2},
                {"field_name": "target_role", "field_label": "대상 직급/역할", "field_type": "text",
                 "is_required": False, "display_order": 3, "placeholder": "예: 임원, 팀장"},
                {"field_name": "period", "field_label": "기간", "field_type": "text",
                 "is_required": False, "display_order": 4, "placeholder": "예: 2022.01 ~ 2023.06"},
                {"field_name": "hours", "field_label": "코칭 시간", "field_type": "number",
                 "is_required": False, "display_order": 5, "placeholder": "총 시간"},
                {"field_name": "description", "field_label": "주요 내용", "field_type": "text",
                 "is_required": False, "display_order": 6},
                {"field_name": "proof_file", "field_label": "증빙자료", "field_type": "file",
                 "is_required": False, "display_order": 7}
            ]
        },
        {
            "item_code": "ADDON_WORK_EXPERIENCE",
            "item_name": "직장 경력",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "max_entries": 10,
            "fields": [
                {"field_name": "company_name", "field_label": "회사명", "field_type": "text",
                 "is_required": True, "display_order": 1},
                {"field_name": "position", "field_label": "직위/직책", "field_type": "text",
                 "is_required": True, "display_order": 2, "placeholder": "예: 부장"},
                {"field_name": "department", "field_label": "부서", "field_type": "text",
                 "is_required": False, "display_order": 3},
                {"field_name": "period", "field_label": "재직기간", "field_type": "text",
                 "is_required": False, "display_order": 4, "placeholder": "예: 2015.03 ~ 2022.12"},
                {"field_name": "description", "field_label": "주요 업무", "field_type": "text",
                 "is_required": False, "display_order": 5},
                {"field_name": "proof_file", "field_label": "경력증명서", "field_type": "file",
                 "is_required": False, "display_order": 6}
            ]
        },

        # ==================== 추가역량 (ADDON) - 교육이수 ====================
        {
            "item_code": "ADDON_COACH_TRAINING",
            "item_name": "코칭 교육 이수",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "max_entries": 20,
            "fields": [
                {"field_name": "program_name", "field_label": "교육 프로그램명", "field_type": "text",
                 "is_required": True, "display_order": 1, "placeholder": "예: ICF ACTP 과정"},
                {"field_name": "provider", "field_label": "교육기관", "field_type": "text",
                 "is_required": True, "display_order": 2},
                {"field_name": "hours", "field_label": "교육시간", "field_type": "number",
                 "is_required": False, "display_order": 3, "placeholder": "시간"},
                {"field_name": "completion_date", "field_label": "수료일", "field_type": "text",
                 "is_required": False, "display_order": 4, "placeholder": "예: 2023-06-30"},
                {"field_name": "proof_file", "field_label": "수료증", "field_type": "file",
                 "is_required": False, "display_order": 5}
            ]
        },

        # ==================== 추가역량 (ADDON) - 기타 ====================
        {
            "item_code": "ADDON_INTRO",
            "item_name": "자기소개",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "template_config": json.dumps({"multiline": True, "max_length": 2000}),
            "is_repeatable": False,
            "fields": []
        },
        {
            "item_code": "ADDON_SPECIALTY",
            "item_name": "전문 분야/강점",
            "category": CompetencyCategory.ADDON,
            "input_type": InputType.TEXT,
            "template": ItemTemplate.TEXT,
            "template_config": json.dumps({"multiline": True, "max_length": 1000}),
            "is_repeatable": False,
            "fields": []
        },
    ]

    async with async_session_maker() as session:
        async with session.begin():
            created_count = 0
            skipped_count = 0

            for item_data in items_data:
                # 기존 항목 확인
                result = await session.execute(
                    select(CompetencyItem).where(CompetencyItem.item_code == item_data["item_code"])
                )
                existing = result.scalar_one_or_none()

                if existing:
                    print(f"  ⚠️ 건너뜀: {item_data['item_code']} (이미 존재)")
                    skipped_count += 1
                    continue

                # 필드 데이터 분리
                fields_data = item_data.pop("fields", [])

                # 새 항목 생성
                item = CompetencyItem(
                    item_code=item_data["item_code"],
                    item_name=item_data["item_name"],
                    category=item_data["category"],
                    input_type=item_data["input_type"],
                    template=item_data.get("template"),
                    template_config=item_data.get("template_config"),
                    is_repeatable=item_data.get("is_repeatable", False),
                    max_entries=item_data.get("max_entries"),
                    is_active=True
                )
                session.add(item)
                await session.flush()  # Get item_id

                # 필드 생성
                for field_data in fields_data:
                    field = CompetencyItemField(
                        item_id=item.item_id,
                        field_name=field_data["field_name"],
                        field_label=field_data["field_label"],
                        field_type=field_data["field_type"],
                        field_options=field_data.get("field_options"),
                        is_required=field_data.get("is_required", True),
                        display_order=field_data.get("display_order", 0),
                        placeholder=field_data.get("placeholder")
                    )
                    session.add(field)

                print(f"  ✅ 생성: {item_data['item_code']} - {item_data['item_name']}")
                if fields_data:
                    print(f"      └─ 필드 {len(fields_data)}개 추가")
                created_count += 1

    await engine.dispose()

    print()
    print("=" * 70)
    print(f"✅ 생성 완료: {created_count}개 항목")
    print(f"⚠️  건너뜀: {skipped_count}개 항목")
    print("=" * 70)
    print()
    print("📋 생성된 역량 항목 카테고리:")
    print("-" * 70)
    print("  BASIC    - 기본정보 (이름, 연락처, 이메일 등)")
    print("  DETAIL   - 세부정보 (코칭분야, 최상위자격 등)")
    print("  EDUCATION- 학력 (학위, 전공, 졸업증명)")
    print("  ADDON    - 추가역량 (자격증, 경력, 교육이수 등)")
    print("-" * 70)


if __name__ == "__main__":
    asyncio.run(create_competency_items())

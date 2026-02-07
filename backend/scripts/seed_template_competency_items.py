"""
템플릿 기반 역량 항목 Seed 데이터

기존 항목 삭제 및 16개 새 항목 생성
"""
import asyncio
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.core.config import settings
from app.models.competency import (
    CompetencyItem, CompetencyItemField,
    CompetencyCategory, InputType, ItemTemplate
)


async def seed_template_items():
    """템플릿 기반 역량 항목 생성"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    print("=" * 80)
    print("템플릿 기반 역량 항목 Seed 시작")
    print("=" * 80)

    # 1. 삭제 트랜잭션
    async with async_session() as session:
        async with session.begin():
            items_to_delete = [
                "COACHING_FIELD",  # 기본정보에서 처리
                "STRENGTH",  # 삭제
                "TOTAL_COACHING_TIME",  # 누적 시간과 중복
                "EDU_BACHELOR",  # 최종학력으로 통합
                "EDU_BACHELOR_PROOF",
                "EDU_MASTER",
                "EDU_MASTER_PROOF",
                "EDU_DOCTORATE",
                "EDU_DOCTORATE_PROOF"
            ]

            print("\n[1단계] 기존 항목 삭제")
            for code in items_to_delete:
                result = await session.execute(
                    select(CompetencyItem).where(CompetencyItem.item_code == code)
                )
                item = result.scalar_one_or_none()
                if item:
                    await session.delete(item)
                    print(f"  ❌ 삭제: {item.item_name} ({code})")

    # 2. 생성 트랜잭션
    async with async_session() as session:
        async with session.begin():
            print("\n[2단계] 새 역량 항목 생성")

            items_data = [
                # 기본 평가 항목 (관리자 전용)
                {
                    "item_name": "이전과제수행평가",
                    "item_code": "EVAL_PREVIOUS_PROJECT",
                    "category": CompetencyCategory.DETAIL,  # 관리자 전용 평가 항목
                    "template": ItemTemplate.SELECT,
                    "template_config": json.dumps({"options": ["우수", "양호", "미비"]}),
                    "is_repeatable": False,
                    "display_order": 800,
                    "fields": [
                        {
                            "field_name": "score",
                            "field_label": "평가",
                            "field_type": "select",
                            "field_options": json.dumps(["우수", "양호", "미비"]),
                            "is_required": True,
                            "display_order": 1
                        }
                    ]
                },
                {
                    "item_name": "심사위원평가",
                    "item_code": "EVAL_COMMITTEE",
                    "category": CompetencyCategory.DETAIL,  # 관리자 전용 평가 항목
                    "template": ItemTemplate.SELECT,
                    "template_config": json.dumps({"options": ["우수", "양호", "미비"]}),
                    "display_order": 810,
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "score",
                            "field_label": "평가",
                            "field_type": "select",
                            "field_options": json.dumps(["우수", "양호", "미비"]),
                            "is_required": True,
                            "display_order": 1
                        }
                    ]
                },

                # 학력 (EDUCATION)
                {
                    "item_name": "코칭/상담/심리 관련 최종학력",
                    "item_code": "EDU_COACHING_FINAL",
                    "category": CompetencyCategory.EDUCATION,
                    "template": ItemTemplate.DEGREE,
                    "template_config": json.dumps({"degree_options": ["박사", "박사수료", "석사", "학사"]}),
                    "is_repeatable": False,
                    "display_order": 300,
                    "fields": [
                        {
                            "field_name": "degree_level",
                            "field_label": "학위",
                            "field_type": "select",
                            "field_options": json.dumps(["박사", "박사수료", "석사", "학사"]),
                            "is_required": True,
                            "display_order": 1
                        },
                        {
                            "field_name": "major",
                            "field_label": "전공명",
                            "field_type": "text",
                            "field_options": None,
                            "is_required": True,
                            "display_order": 2,
                            "placeholder": "전공명을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "field_options": None,
                            "is_required": True,
                            "display_order": 3
                        }
                    ]
                },
                {
                    "item_name": "기타분야 관련 최종학력",
                    "item_code": "EDU_OTHER_FINAL",
                    "category": CompetencyCategory.EDUCATION,
                    "template": ItemTemplate.DEGREE,
                    "template_config": json.dumps({"degree_options": ["박사", "박사수료", "석사", "학사"]}),
                    "display_order": 310,
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "degree_level",
                            "field_label": "학위",
                            "field_type": "select",
                            "field_options": json.dumps(["박사", "박사수료", "석사", "학사"]),
                            "is_required": True,
                            "display_order": 1
                        },
                        {
                            "field_name": "major",
                            "field_label": "전공명",
                            "field_type": "text",
                            "field_options": None,
                            "is_required": True,
                            "display_order": 2,
                            "placeholder": "전공명을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "field_options": None,
                            "is_required": True,
                            "display_order": 3
                        }
                    ]
                },

                # 자격증 (CERTIFICATION) - 복수 가능
                {
                    "item_name": "KCA 코칭관련 자격증",
                    "item_code": "CERT_KCA",
                    "category": CompetencyCategory.CERTIFICATION,
                    "template": ItemTemplate.TEXT_FILE,
                    "is_repeatable": True,
                    "display_order": 100,
                    "max_entries": None,
                    "fields": [
                        {
                            "field_name": "cert_name",
                            "field_label": "자격증 명칭",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "자격증 명칭을 입력하세요"
                        },
                        {
                            "field_name": "cert_file",
                            "field_label": "자격증 업로드",
                            "field_type": "file",
                            "is_required": True,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "item_name": "상담,심리치료관련 자격",
                    "item_code": "CERT_COUNSELING",
                    "category": CompetencyCategory.CERTIFICATION,
                    "template": ItemTemplate.TEXT_FILE,
                    "is_repeatable": True,
                    "max_entries": None,
                    "display_order": 110,
                    "fields": [
                        {
                            "field_name": "cert_name",
                            "field_label": "자격증 명칭",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "자격증 명칭을 입력하세요"
                        },
                        {
                            "field_name": "cert_file",
                            "field_label": "자격증 업로드",
                            "field_type": "file",
                            "is_required": True,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "item_name": "멘토링/수퍼비전 경험",
                    "item_code": "EXP_MENTORING",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.TEXT_FILE,
                    "is_repeatable": True,
                    "display_order": 900,  # 비활성 대상
                    "max_entries": None,
                    "fields": [
                        {
                            "field_name": "experience",
                            "field_label": "경험 내용",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "경험 내용을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": True,
                            "display_order": 2
                        }
                    ]
                },

                # 역량이력 (EXPERIENCE)
                {
                    "item_name": "총 코칭 경력",
                    "item_code": "EXP_COACHING_YEARS",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.NUMBER,
                    "is_repeatable": False,
                    "display_order": 910,  # 비활성 대상
                    "fields": [
                        {
                            "field_name": "years",
                            "field_label": "경력 (년)",
                            "field_type": "number",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "숫자만 입력"
                        }
                    ]
                },
                {
                    "item_name": "누적 코칭 시간",
                    "item_code": "EXP_COACHING_HOURS",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.NUMBER,
                    "is_repeatable": False,
                    "display_order": 200,
                    "fields": [
                        {
                            "field_name": "hours",
                            "field_label": "시간",
                            "field_type": "number",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "숫자만 입력"
                        }
                    ]
                },

                # 코칭 분야별 이력 (EXPERIENCE)
                {
                    "item_name": "비즈니스코칭 이력",
                    "item_code": "COACHING_BUSINESS",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.COACHING_HISTORY,
                    "display_order": 220,
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "history",
                            "field_label": "이력",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "이력을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": False,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "item_name": "코칭관련 연수/교육",
                    "item_code": "EDUCATION_TRAINING",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.TEXT_FILE,
                    "display_order": 210,
                    "is_repeatable": True,
                    "max_entries": None,
                    "fields": [
                        {
                            "field_name": "training_name",
                            "field_label": "연수/교육명",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "연수/교육명을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": False,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "display_order": 920,  # 비활성 대상
                    "item_name": "커리어코칭 이력",
                    "item_code": "COACHING_CAREER",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.COACHING_HISTORY,
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "history",
                            "field_label": "이력",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "이력을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": False,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "item_name": "청소년코칭 이력",
                    "item_code": "COACHING_YOUTH",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.COACHING_HISTORY,
                    "display_order": 230,
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "history",
                            "field_label": "이력",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "이력을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": False,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "item_name": "청년코칭 이력",
                    "item_code": "COACHING_YOUNG_ADULT",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.COACHING_HISTORY,
                    "display_order": 930,  # 비활성 대상
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "history",
                            "field_label": "이력",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "이력을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": False,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "item_name": "가족코칭 이력",
                    "item_code": "COACHING_FAMILY",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.COACHING_HISTORY,
                    "display_order": 940,  # 비활성 대상
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "history",
                            "field_label": "이력",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "이력을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": False,
                            "display_order": 2
                        }
                    ]
                },
                {
                    "item_name": "라이프코칭 이력",
                    "item_code": "COACHING_LIFE",
                    "category": CompetencyCategory.EXPERIENCE,
                    "template": ItemTemplate.COACHING_HISTORY,
                    "display_order": 950,  # 비활성 대상
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "history",
                            "field_label": "이력",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "이력을 입력하세요"
                        },
                        {
                            "field_name": "proof",
                            "field_label": "증빙 업로드",
                            "field_type": "file",
                            "is_required": False,
                            "display_order": 2
                        }
                    ]
                },

                # 기타 (OTHER)
                {
                    "item_name": "전문 분야",
                    "item_code": "SPECIALTY",
                    "category": CompetencyCategory.OTHER,
                    "template": ItemTemplate.TEXT,
                    "display_order": 960,  # 비활성 대상
                    "is_repeatable": False,
                    "fields": [
                        {
                            "field_name": "value",
                            "field_label": "전문 분야",
                            "field_type": "text",
                            "is_required": True,
                            "display_order": 1,
                            "placeholder": "코칭 분야(비즈니스, 라이프 등)로 표현될 수 없는 구체적인 전문성을 자유롭게 기재해 주세요."
                        }
                    ]
                }
            ]

            # Create items
            for item_data in items_data:
                # Check if exists
                result = await session.execute(
                    select(CompetencyItem).where(
                        CompetencyItem.item_code == item_data["item_code"]
                    )
                )
                existing = result.scalar_one_or_none()

                if existing:
                    print(f"  ⊘ {item_data['item_name']} - 이미 존재함")
                    continue

                # Extract fields
                fields_data = item_data.pop("fields", [])

                # Create item
                item = CompetencyItem(
                    item_name=item_data["item_name"],
                    item_code=item_data["item_code"],
                    category=item_data["category"],
                    input_type=InputType.TEXT,  # Deprecated, but required
                    is_active=True,
                    template=item_data["template"],
                    template_config=item_data.get("template_config"),
                    is_repeatable=item_data.get("is_repeatable", False),
                    max_entries=item_data.get("max_entries"),
                    display_order=item_data.get("display_order", 999)
                )
                session.add(item)
                await session.flush()  # Get item_id

                # Create fields
                for field_data in fields_data:
                    field = CompetencyItemField(
                        item_id=item.item_id,
                        field_name=field_data["field_name"],
                        field_label=field_data["field_label"],
                        field_type=field_data["field_type"],
                        field_options=field_data.get("field_options"),
                        is_required=field_data.get("is_required", True),
                        display_order=field_data["display_order"],
                        placeholder=field_data.get("placeholder")
                    )
                    session.add(field)

                repeatable_text = " [복수 가능]" if item.is_repeatable else ""
                print(f"  ✓ {item.item_name} ({item.template.value}){repeatable_text}")

            await session.commit()

            print("\n" + "=" * 80)
            print("Seed 완료!")
            print("=" * 80)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_template_items())

"""
평가 템플릿 초기 데이터 삽입 스크립트
gradeTemplates.ts의 상수를 DB로 이관
"""
import asyncio
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


# gradeTemplates.ts에서 추출한 템플릿 데이터
SCORING_TEMPLATES_DATA = [
    # TEMPLATE_DEGREE
    {
        "template_id": "degree",
        "template_name": "학위",
        "description": "학위별로 점수를 부여합니다",
        "grade_type": "string",
        "matching_type": "grade",
        "value_source": "SUBMITTED",
        "source_field": None,
        "aggregation_mode": "best_match",
        "default_mappings": json.dumps([
            {"value": "박사", "score": 30, "label": "박사"},
            {"value": "석사", "score": 20, "label": "석사"},
            {"value": "학사", "score": 10, "label": "학사"}
        ]),
        "fixed_grades": False,
        "allow_add_grades": True,
        "proof_required": "REQUIRED",
        "verification_note": None,
        "is_required_default": False,
        "allow_multiple": True,
        "auto_confirm_across_projects": True,
        "keywords": json.dumps(["학위", "학력", "degree", "박사", "석사", "학사"]),
        "is_active": True
    },
    # TEMPLATE_KCA_CERTIFICATION
    {
        "template_id": "kca_certification",
        "template_name": "코칭관련자격증 (KCA)",
        "description": "기본정보의 코치인증번호를 자동 조회합니다",
        "grade_type": "string",
        "matching_type": "grade",
        "value_source": "USER_FIELD",
        "source_field": "kca_certification_level",
        "aggregation_mode": "best_match",
        "default_mappings": json.dumps([
            {"value": "KSC", "score": 40, "label": "KSC (수석코치)", "fixed": True},
            {"value": "KAC", "score": 30, "label": "KAC (전문코치)", "fixed": True},
            {"value": "KPC", "score": 20, "label": "KPC (전문코치)", "fixed": True},
            {"value": "무자격", "score": 0, "label": "무자격", "fixed": True}
        ]),
        "fixed_grades": True,
        "allow_add_grades": False,
        "proof_required": "OPTIONAL",
        "verification_note": "기본정보에 등록된 코치인증번호가 자동으로 조회됩니다",
        "is_required_default": False,
        "allow_multiple": False,
        "auto_confirm_across_projects": True,
        "keywords": json.dumps(["kca"]),
        "is_active": True
    },
    # TEMPLATE_COACHING_HOURS
    {
        "template_id": "coaching_hours",
        "template_name": "코칭 경력 시간",
        "description": "시간 범위별로 점수를 부여합니다",
        "grade_type": "numeric",
        "matching_type": "range",
        "value_source": "SUBMITTED",
        "source_field": None,
        "aggregation_mode": "sum",
        "default_mappings": json.dumps([
            {"value": 1000, "score": 30, "label": "1000시간 이상"},
            {"value": 500, "score": 20, "label": "500-999시간"},
            {"value": 100, "score": 10, "label": "100-499시간"}
        ]),
        "fixed_grades": False,
        "allow_add_grades": True,
        "proof_required": "OPTIONAL",
        "verification_note": None,
        "is_required_default": False,
        "allow_multiple": True,
        "auto_confirm_across_projects": True,
        "keywords": json.dumps(["경력", "시간", "hour"]),
        "is_active": True
    },
    # TEMPLATE_COUNSELING_BY_NAME
    {
        "template_id": "counseling_by_name",
        "template_name": "상담/심리치료관련자격 (이름 기준)",
        "description": '자격증 이름으로 등급을 설정합니다 (예: "임상심리사" 포함 시)',
        "grade_type": "string",
        "matching_type": "contains",
        "value_source": "SUBMITTED",
        "source_field": None,
        "aggregation_mode": "best_match",
        "default_mappings": json.dumps([
            {"value": "임상심리사", "score": 30, "label": '"임상심리사" 포함'},
            {"value": "상담심리사", "score": 20, "label": '"상담심리사" 포함'}
        ]),
        "fixed_grades": False,
        "allow_add_grades": True,
        "proof_required": "REQUIRED",
        "verification_note": "자격증 적합성은 검토자가 증빙을 확인하여 판단합니다",
        "is_required_default": False,
        "allow_multiple": True,
        "auto_confirm_across_projects": False,
        "keywords": json.dumps(["상담", "심리", "치료", "심리치료"]),
        "is_active": True
    },
    # TEMPLATE_COUNSELING_BY_EXISTS
    {
        "template_id": "counseling_by_exists",
        "template_name": "상담/심리치료관련자격 (유무 기준)",
        "description": "자격증 유무로 등급을 설정합니다 (증빙 확인 후 점수 부여)",
        "grade_type": "file_exists",
        "matching_type": "exact",
        "value_source": "SUBMITTED",
        "source_field": None,
        "aggregation_mode": "first",
        "default_mappings": json.dumps([
            {"value": "true", "score": 20, "label": "유자격 (증빙 확인)", "fixed": True},
            {"value": "false", "score": 0, "label": "무자격", "fixed": True}
        ]),
        "fixed_grades": True,
        "allow_add_grades": False,
        "proof_required": "REQUIRED",
        "verification_note": "의미있는 자격증 적합성 기준은 과제관리자가 설정하고 확인은 검토자가 진행합니다",
        "is_required_default": False,
        "allow_multiple": False,
        "auto_confirm_across_projects": False,
        "keywords": json.dumps(["상담", "심리", "치료", "심리치료"]),
        "is_active": True
    },
    # TEMPLATE_OTHER_BY_NAME
    {
        "template_id": "other_by_name",
        "template_name": "기타 자격증 (이름 기준)",
        "description": "자격증 이름으로 등급을 설정합니다",
        "grade_type": "string",
        "matching_type": "contains",
        "value_source": "SUBMITTED",
        "source_field": None,
        "aggregation_mode": "best_match",
        "default_mappings": json.dumps([
            {"value": "", "score": 20, "label": "특정 자격증명 입력"}
        ]),
        "fixed_grades": False,
        "allow_add_grades": True,
        "proof_required": "REQUIRED",
        "verification_note": "자격증 적합성은 검토자가 증빙을 확인하여 판단합니다",
        "is_required_default": False,
        "allow_multiple": True,
        "auto_confirm_across_projects": False,
        "keywords": json.dumps([]),
        "is_active": True
    },
    # TEMPLATE_OTHER_BY_EXISTS
    {
        "template_id": "other_by_exists",
        "template_name": "기타 자격증 (유무 기준)",
        "description": "자격증 유무로 등급을 설정합니다",
        "grade_type": "file_exists",
        "matching_type": "exact",
        "value_source": "SUBMITTED",
        "source_field": None,
        "aggregation_mode": "first",
        "default_mappings": json.dumps([
            {"value": "true", "score": 20, "label": "유자격 (증빙 확인)", "fixed": True},
            {"value": "false", "score": 0, "label": "무자격", "fixed": True}
        ]),
        "fixed_grades": True,
        "allow_add_grades": False,
        "proof_required": "REQUIRED",
        "verification_note": "자격증 적합성은 검토자가 증빙을 확인하여 판단합니다",
        "is_required_default": False,
        "allow_multiple": False,
        "auto_confirm_across_projects": False,
        "keywords": json.dumps([]),
        "is_active": True
    },
    # TEMPLATE_COACHING_TRAINING (새로 추가 - 코칭연수)
    {
        "template_id": "coaching_training",
        "template_name": "코칭연수/경험",
        "description": "시간 합산 후 범위별 점수를 부여합니다",
        "grade_type": "numeric",
        "matching_type": "range",
        "value_source": "SUBMITTED",
        "source_field": None,
        "aggregation_mode": "sum",
        "default_mappings": json.dumps([
            {"value": 1000, "score": 40, "label": "1000시간 이상"},
            {"value": 500, "score": 30, "label": "500시간 이상"},
            {"value": 100, "score": 20, "label": "100시간 이상"},
            {"value": 0, "score": 10, "label": "100시간 미만"}
        ]),
        "fixed_grades": False,
        "allow_add_grades": True,
        "proof_required": "REQUIRED",
        "verification_note": None,
        "is_required_default": False,
        "allow_multiple": True,
        "auto_confirm_across_projects": True,
        "keywords": json.dumps(["연수", "경험", "training", "experience"]),
        "is_active": True
    },
]

# 역량 항목과 평가 템플릿 매핑
# 항목코드 -> 템플릿ID
ITEM_TEMPLATE_MAPPING = {
    # 자격증
    "CERT_KCA": "kca_certification",
    "CERT_COUNSELING": "counseling_by_name",  # 또는 counseling_by_exists
    "CERT_OTHER": "counseling_by_name",       # 기타자격도 상담자격과 동일

    # 학력
    "EDU_COACHING_FINAL": "degree",
    "EDU_OTHER_FINAL": "degree",

    # 경력
    "EXP_COACHING_HOURS": "coaching_hours",
    "EXP_COACHING_TRAINING": "coaching_training",
    "EXP_COACHING_EXPERIENCE": "coaching_training",
}


async def seed_scoring_templates():
    """평가 템플릿 초기 데이터 삽입"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        async with session.begin():
            print("=" * 60)
            print("평가 템플릿 데이터를 삽입합니다...")
            print("=" * 60)

            # 1. 평가 템플릿 삽입 (upsert 방식)
            for template_data in SCORING_TEMPLATES_DATA:
                # Check if template exists
                result = await session.execute(
                    text("SELECT template_id FROM scoring_templates WHERE template_id = :id"),
                    {"id": template_data["template_id"]}
                )
                existing = result.fetchone()

                if existing:
                    # Update existing template
                    update_sql = """
                        UPDATE scoring_templates SET
                            template_name = :template_name,
                            description = :description,
                            grade_type = :grade_type,
                            matching_type = :matching_type,
                            value_source = :value_source,
                            source_field = :source_field,
                            aggregation_mode = :aggregation_mode,
                            default_mappings = :default_mappings,
                            fixed_grades = :fixed_grades,
                            allow_add_grades = :allow_add_grades,
                            proof_required = :proof_required,
                            verification_note = :verification_note,
                            is_required_default = :is_required_default,
                            allow_multiple = :allow_multiple,
                            auto_confirm_across_projects = :auto_confirm_across_projects,
                            keywords = :keywords,
                            is_active = :is_active
                        WHERE template_id = :template_id
                    """
                    await session.execute(text(update_sql), template_data)
                    print(f"  ↻ 업데이트: {template_data['template_name']} ({template_data['template_id']})")
                else:
                    # Insert new template
                    insert_sql = """
                        INSERT INTO scoring_templates (
                            template_id, template_name, description,
                            grade_type, matching_type, value_source, source_field, aggregation_mode,
                            default_mappings, fixed_grades, allow_add_grades, proof_required, verification_note,
                            is_required_default, allow_multiple, auto_confirm_across_projects, keywords, is_active
                        ) VALUES (
                            :template_id, :template_name, :description,
                            :grade_type, :matching_type, :value_source, :source_field, :aggregation_mode,
                            :default_mappings, :fixed_grades, :allow_add_grades, :proof_required, :verification_note,
                            :is_required_default, :allow_multiple, :auto_confirm_across_projects, :keywords, :is_active
                        )
                    """
                    await session.execute(text(insert_sql), template_data)
                    print(f"  ✓ 삽입: {template_data['template_name']} ({template_data['template_id']})")

            print(f"\n총 {len(SCORING_TEMPLATES_DATA)}개의 평가 템플릿 처리 완료")

            # 2. 역량 항목에 템플릿 연결
            print("\n" + "=" * 60)
            print("역량 항목에 평가 템플릿을 연결합니다...")
            print("=" * 60)

            for item_code, template_id in ITEM_TEMPLATE_MAPPING.items():
                update_sql = """
                    UPDATE competency_items
                    SET scoring_template_id = :template_id
                    WHERE item_code = :item_code
                """
                result = await session.execute(
                    text(update_sql),
                    {"template_id": template_id, "item_code": item_code}
                )
                if result.rowcount > 0:
                    print(f"  ✓ {item_code} → {template_id}")
                else:
                    print(f"  - {item_code} (항목 없음, 건너뜀)")

            await session.commit()
            print("\n✅ 모든 데이터 처리 완료!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_scoring_templates())

"""
입력 템플릿 (InputTemplate) 초기 데이터 시드 스크립트

기존 ItemTemplate enum 값들을 DB 레코드로 마이그레이션합니다.

단순화된 구조:
- 파일 첨부 여부: fields_schema에 file 타입 필드 유무로 자동 판단
- 파일 필수 여부: file 필드의 required 속성으로 결정
- 허용 파일 형식: 실행파일만 차단 (백엔드 로직)
"""
import json
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.input_template import InputTemplate


# 입력 템플릿 정의 (12개)
INPUT_TEMPLATES = [
    {
        "template_id": "text",
        "template_name": "텍스트",
        "description": "단일 텍스트 입력",
        "fields_schema": json.dumps([
            {"name": "value", "type": "text", "label": "값", "required": True}
        ]),
        "layout_type": "vertical",
        "is_repeatable": False,
        "keywords": json.dumps(["텍스트", "문자열", "TEXT"])
    },
    {
        "template_id": "number",
        "template_name": "숫자",
        "description": "단일 숫자 입력",
        "fields_schema": json.dumps([
            {"name": "value", "type": "number", "label": "값", "required": True}
        ]),
        "layout_type": "vertical",
        "is_repeatable": False,
        "keywords": json.dumps(["숫자", "NUMBER"])
    },
    {
        "template_id": "select",
        "template_name": "단일선택",
        "description": "옵션 중 하나 선택",
        "fields_schema": json.dumps([
            {"name": "value", "type": "select", "label": "선택", "required": True, "options": []}
        ]),
        "layout_type": "vertical",
        "is_repeatable": False,
        "keywords": json.dumps(["선택", "SELECT"])
    },
    {
        "template_id": "multiselect",
        "template_name": "다중선택",
        "description": "옵션 중 여러 개 선택",
        "fields_schema": json.dumps([
            {"name": "values", "type": "multiselect", "label": "선택", "required": True, "options": []}
        ]),
        "layout_type": "vertical",
        "is_repeatable": False,
        "keywords": json.dumps(["다중선택", "MULTISELECT"])
    },
    {
        "template_id": "file",
        "template_name": "파일",
        "description": "파일 업로드",
        "fields_schema": json.dumps([
            {"name": "file", "type": "file", "label": "파일", "required": True}
        ]),
        "layout_type": "vertical",
        "is_repeatable": False,
        "keywords": json.dumps(["파일", "FILE"])
    },
    {
        "template_id": "text_file",
        "template_name": "텍스트+파일",
        "description": "텍스트 입력과 파일 첨부 (자격증/경험 형태)",
        "fields_schema": json.dumps([
            {"name": "description", "type": "text", "label": "설명", "required": True},
            {"name": "file", "type": "file", "label": "증빙파일", "required": False}
        ]),
        "layout_type": "vertical",
        "is_repeatable": True,
        "keywords": json.dumps(["텍스트파일", "TEXT_FILE"])
    },
    {
        "template_id": "degree",
        "template_name": "학위",
        "description": "학위 정보 입력 (학위, 전공, 학교, 졸업연도 등)",
        "fields_schema": json.dumps([
            {"name": "degree_level", "type": "select", "label": "학위", "required": True,
             "options": ["학사", "석사", "박사", "박사수료", "기타"]},
            {"name": "major", "type": "text", "label": "전공", "required": True},
            {"name": "school_name", "type": "text", "label": "학교명", "required": True},
            {"name": "graduation_year", "type": "text", "label": "졸업연도", "required": False},
            {"name": "file", "type": "file", "label": "증빙서류", "required": False}
        ]),
        "layout_type": "vertical",
        "is_repeatable": True,
        "max_entries": "5",
        "help_text": "최종 학력부터 입력해주세요.",
        "keywords": json.dumps(["학위", "학력", "DEGREE", "EDUCATION"])
    },
    {
        "template_id": "coaching_history",
        "template_name": "코칭이력",
        "description": "코칭 분야 이력 입력 (분야명, 기간, 내용 등)",
        "fields_schema": json.dumps([
            {"name": "field_name", "type": "text", "label": "코칭 분야", "required": True},
            {"name": "period", "type": "text", "label": "기간", "required": False},
            {"name": "description", "type": "textarea", "label": "주요 내용", "required": False},
            {"name": "file", "type": "file", "label": "증빙자료", "required": False}
        ]),
        "layout_type": "vertical",
        "is_repeatable": True,
        "keywords": json.dumps(["코칭이력", "COACHING_HISTORY"])
    },
    {
        "template_id": "coaching_time",
        "template_name": "코칭시간",
        "description": "코칭 시간 입력 (내용, 연도, 시간, 증빙)",
        "fields_schema": json.dumps([
            {"name": "content", "type": "text", "label": "내용", "required": True},
            {"name": "year", "type": "text", "label": "연도", "required": True},
            {"name": "hours", "type": "number", "label": "시간", "required": True},
            {"name": "file", "type": "file", "label": "증빙자료", "required": False}
        ]),
        "layout_type": "horizontal",
        "is_repeatable": True,
        "help_text": "코칭 시간을 연도별로 입력해주세요.",
        "keywords": json.dumps(["코칭시간", "COACHING_TIME", "시간"])
    },
    {
        "template_id": "coaching_experience",
        "template_name": "코칭경력",
        "description": "코칭 경력 입력 (기관명, 연도, 시간, 증빙)",
        "fields_schema": json.dumps([
            {"name": "organization", "type": "text", "label": "기관명", "required": True},
            {"name": "year", "type": "text", "label": "연도", "required": True},
            {"name": "hours", "type": "number", "label": "시간", "required": False},
            {"name": "description", "type": "textarea", "label": "내용", "required": False},
            {"name": "file", "type": "file", "label": "증빙자료", "required": False}
        ]),
        "layout_type": "vertical",
        "is_repeatable": True,
        "help_text": "코칭 경력을 기관별로 입력해주세요.",
        "keywords": json.dumps(["코칭경력", "COACHING_EXPERIENCE", "경력"])
    },
    {
        "template_id": "kca_certification",
        "template_name": "KCA자격증",
        "description": "코칭 관련 자격증 입력 (KSC, KAC, KPC 등)",
        "fields_schema": json.dumps([
            {"name": "cert_level", "type": "select", "label": "자격증", "required": True,
             "options": ["KSC", "KAC", "KPC", "ACC", "PCC", "MCC", "기타"]},
            {"name": "cert_number", "type": "text", "label": "자격증번호", "required": False},
            {"name": "issue_date", "type": "text", "label": "취득일", "required": False},
            {"name": "file", "type": "file", "label": "자격증 사본", "required": True}
        ]),
        "layout_type": "vertical",
        "is_repeatable": True,
        "max_entries": "10",
        "help_text": "취득한 코칭 자격증을 모두 입력해주세요.",
        "keywords": json.dumps(["자격증", "KCA", "KSC", "KAC", "KPC", "CERTIFICATION"])
    },
    {
        "template_id": "other_certification",
        "template_name": "기타자격증",
        "description": "기타 자격증 입력",
        "fields_schema": json.dumps([
            {"name": "cert_name", "type": "text", "label": "자격증명", "required": True},
            {"name": "issuer", "type": "text", "label": "발급기관", "required": False},
            {"name": "cert_number", "type": "text", "label": "자격증번호", "required": False},
            {"name": "issue_date", "type": "text", "label": "취득일", "required": False},
            {"name": "file", "type": "file", "label": "자격증 사본", "required": False}
        ]),
        "layout_type": "vertical",
        "is_repeatable": True,
        "keywords": json.dumps(["기타자격증", "OTHER_CERTIFICATION"])
    },
]


async def seed_input_templates():
    """입력 템플릿 시드 데이터 삽입"""
    async with AsyncSessionLocal() as db:
        created = 0
        skipped = 0

        for template_data in INPUT_TEMPLATES:
            # 이미 존재하는지 확인
            existing = await db.execute(
                select(InputTemplate).where(
                    InputTemplate.template_id == template_data["template_id"]
                )
            )
            if existing.scalar_one_or_none():
                print(f"  [SKIP] {template_data['template_id']} - 이미 존재")
                skipped += 1
                continue

            # 새로 생성
            template = InputTemplate(
                template_id=template_data["template_id"],
                template_name=template_data["template_name"],
                description=template_data.get("description"),
                fields_schema=template_data.get("fields_schema", "[]"),
                layout_type=template_data.get("layout_type", "vertical"),
                is_repeatable=template_data.get("is_repeatable", False),
                max_entries=template_data.get("max_entries"),
                validation_rules=template_data.get("validation_rules"),
                help_text=template_data.get("help_text"),
                placeholder=template_data.get("placeholder"),
                keywords=template_data.get("keywords"),
                is_active=True
            )
            db.add(template)
            print(f"  [CREATE] {template_data['template_id']} - {template_data['template_name']}")
            created += 1

        await db.commit()
        print(f"\n입력 템플릿 시드 완료: {created}개 생성, {skipped}개 스킵")
        return {"created": created, "skipped": skipped}


if __name__ == "__main__":
    print("입력 템플릿 시드 시작...")
    asyncio.run(seed_input_templates())

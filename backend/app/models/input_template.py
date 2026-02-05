"""
입력 템플릿 (InputTemplate) 모델

코치가 역량 데이터를 입력하는 폼 구조를 정의합니다.
- 필드 스키마 (JSON)
- 레이아웃 유형
- 검증 규칙
- 데이터 소스 (폼 입력 vs 기존 데이터 참조)
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class DataSourceType(str, enum.Enum):
    """데이터 소스 유형"""
    FORM_INPUT = "form_input"           # 사용자가 폼에서 직접 입력 (기본값)
    USER_PROFILE = "user_profile"       # User 테이블 필드 참조 (읽기 전용)
    COACH_COMPETENCY = "coach_competency"  # 중앙 DB에서 가져옴 (재사용)


# User 테이블에서 참조 가능한 필드 목록
USER_PROFILE_FIELDS = {
    "coach_certification_number": {
        "label": "KCA 인증번호",
        "description": "코칭 자격 인증번호 (예: KSC-12345)",
        "type": "string"
    },
    "organization": {
        "label": "소속기관",
        "description": "현재 소속 기관명",
        "type": "string"
    },
    "introduction": {
        "label": "자기소개",
        "description": "코치 자기소개",
        "type": "text"
    },
    "name": {
        "label": "이름",
        "description": "사용자 이름",
        "type": "string"
    },
    "email": {
        "label": "이메일",
        "description": "사용자 이메일",
        "type": "string"
    },
    "phone": {
        "label": "연락처",
        "description": "사용자 전화번호",
        "type": "string"
    }
}


class InputTemplate(Base):
    """입력 템플릿 모델"""
    __tablename__ = "input_templates"

    # 기본 정보
    template_id = Column(String(50), primary_key=True, index=True)
    template_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # 데이터 소스 설정 (NEW)
    data_source = Column(String(50), nullable=False, default="form_input")  # form_input, user_profile, coach_competency
    source_field = Column(String(100), nullable=True)  # data_source가 user_profile일 때 User 테이블 필드명
    display_only = Column(Boolean, nullable=False, default=False)  # True면 읽기 전용 표시

    # 필드 스키마 (JSON) - data_source가 form_input일 때만 사용
    # 예: [{"name": "degree_name", "type": "select", "label": "학위", "options": ["학사", "석사", "박사"], "required": true}]
    fields_schema = Column(Text, nullable=False, default="[]")

    # 레이아웃 설정
    layout_type = Column(String(50), nullable=False, default="vertical")  # vertical, horizontal, grid

    # 입력 특성
    is_repeatable = Column(Boolean, nullable=False, default=False)  # 다중 입력 허용
    max_entries = Column(String(10), nullable=True)  # 최대 입력 수 (null=무제한)

    # 검증 규칙 (JSON)
    # 예: {"min_length": 10, "max_length": 500, "pattern": "^[가-힣]+$"}
    validation_rules = Column(Text, nullable=True)

    # 도움말/안내
    help_text = Column(Text, nullable=True)
    placeholder = Column(String(200), nullable=True)

    # 키워드 (자동 매칭용, JSON)
    keywords = Column(Text, nullable=True)  # ["학력", "학위", "DEGREE"]

    # 상태
    is_active = Column(Boolean, nullable=False, default=True)

    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    # CompetencyItem과의 관계는 competency.py에서 정의 (순환 import 방지)

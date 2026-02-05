"""
입력 템플릿 (InputTemplate) 모델

코치가 역량 데이터를 입력하는 폼 구조를 정의합니다.
- 필드 스키마 (JSON)
- 레이아웃 유형
- 검증 규칙
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class InputTemplate(Base):
    """입력 템플릿 모델"""
    __tablename__ = "input_templates"

    # 기본 정보
    template_id = Column(String(50), primary_key=True, index=True)
    template_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # 필드 스키마 (JSON)
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

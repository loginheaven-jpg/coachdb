"""
평가 템플릿 (Scoring Template) 모델
- 역량 항목의 평가 방법을 미리 정의
- gradeTemplates.ts의 상수를 DB로 이관
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class GradeType:
    """등급 유형 상수"""
    STRING = "string"           # 문자열 (예: KSC, KAC, KPC)
    NUMERIC = "numeric"         # 숫자 (예: 점수, 시간)
    FILE_EXISTS = "file_exists" # 파일 유무
    MULTI_SELECT = "multi_select"  # 복수 선택


class ScoringTemplate(Base):
    """
    평가 템플릿 마스터 데이터
    - 역량 항목과 1:N 관계 (여러 항목이 같은 템플릿 사용 가능)
    - 예: KCA 자격증, 학위, 코칭 경력 시간 등
    """
    __tablename__ = "scoring_templates"

    # 기본 식별
    template_id = Column(String(100), primary_key=True, index=True)  # "kca_certification", "degree", etc.
    template_name = Column(String(200), nullable=False)              # "코칭관련자격증 (KCA)"
    description = Column(Text, nullable=True)                        # 템플릿 설명

    # 평가 설정
    grade_type = Column(String(50), nullable=False)                  # STRING, NUMERIC, FILE_EXISTS, MULTI_SELECT
    matching_type = Column(String(50), nullable=False)               # EXACT, CONTAINS, RANGE, GRADE
    value_source = Column(String(50), nullable=False, default="SUBMITTED")  # SUBMITTED, USER_FIELD, JSON_FIELD
    source_field = Column(String(100), nullable=True)                # USER_FIELD, JSON_FIELD인 경우 필드명
    aggregation_mode = Column(String(50), nullable=False, default="FIRST")  # FIRST, SUM, MAX, COUNT, ANY_MATCH, BEST_MATCH

    # 등급 매핑 (JSON 배열)
    # 형식: [{"value": "KSC", "score": 40, "label": "KSC (수석코치)", "fixed": true}, ...]
    default_mappings = Column(Text, nullable=False)

    # 템플릿 특성
    fixed_grades = Column(Boolean, nullable=False, default=False)         # 등급 목록 고정 (점수만 수정 가능)
    allow_add_grades = Column(Boolean, nullable=False, default=True)      # 사용자가 등급 추가 가능
    proof_required = Column(String(20), nullable=False, default="OPTIONAL")  # NOT_REQUIRED, OPTIONAL, REQUIRED
    verification_note = Column(Text, nullable=True)                       # 검증 안내 메시지

    # 항목 설정 기본값
    is_required_default = Column(Boolean, nullable=False, default=False)  # 필수 입력 여부 기본값
    allow_multiple = Column(Boolean, nullable=False, default=False)       # 복수 항목 입력 가능 여부

    # 자동 컨펌 정책
    auto_confirm_across_projects = Column(Boolean, nullable=False, default=False)  # 다른 과제에서도 자동 컨펌 가능

    # 자동 적용 조건 (JSON 배열)
    # 형식: ["kca", "자격증"]
    keywords = Column(Text, nullable=True)                               # 항목명에 포함되면 자동 제안

    # 상태
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    competency_items = relationship("CompetencyItem", back_populates="scoring_template")

    def __repr__(self):
        return f"<ScoringTemplate(template_id={self.template_id}, name={self.template_name})>"

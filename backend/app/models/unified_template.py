"""
통합 템플릿 (UnifiedTemplate) 모델

입력 템플릿과 평가 템플릿을 통합한 단일 템플릿.
역량 항목의 입력 폼 구조와 평가 방법을 함께 정의합니다.
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import json

from app.core.database import Base


class DataSource(str, enum.Enum):
    """데이터 소스 유형"""
    FORM_INPUT = "form_input"           # 직접 폼 입력
    USER_PROFILE = "user_profile"       # 사용자 프로필 참조
    COACH_COMPETENCY = "coach_competency"  # 중앙 역량 DB 참조


class EvaluationMethod(str, enum.Enum):
    """평가 방법 (자격증 특수 케이스 처리)"""
    STANDARD = "standard"       # 일반 평가
    BY_NAME = "by_name"         # 이름 기준 평가 (CONTAINS 매칭)
    BY_EXISTENCE = "by_existence"  # 유무 기준 평가 (FILE_EXISTS)


class GradeType(str, enum.Enum):
    """등급 유형"""
    STRING = "string"           # 문자열 (예: KSC, KAC, KPC)
    NUMERIC = "numeric"         # 숫자 (예: 점수, 시간)
    FILE_EXISTS = "file_exists" # 파일 유무
    MULTI_SELECT = "multi_select"  # 복수 선택


class MatchingType(str, enum.Enum):
    """매칭 방식"""
    EXACT = "exact"       # 정확히 일치
    CONTAINS = "contains" # 포함 여부
    RANGE = "range"       # 범위 (이상/이하)
    GRADE = "grade"       # 등급별 점수


class ValueSource(str, enum.Enum):
    """평가 값 소스"""
    SUBMITTED = "submitted"       # 제출된 값
    USER_FIELD = "user_field"     # 사용자 테이블 필드
    JSON_FIELD = "json_field"     # JSON 데이터 필드


class AggregationMode(str, enum.Enum):
    """복수 입력 집계 방식"""
    FIRST = "first"           # 첫 번째 값만
    SUM = "sum"               # 합계
    MAX = "max"               # 최대값
    COUNT = "count"           # 개수
    ANY_MATCH = "any_match"   # 하나라도 일치
    BEST_MATCH = "best_match" # 가장 높은 점수


class ProofRequired(str, enum.Enum):
    """증빙 필수 여부"""
    NOT_REQUIRED = "not_required"
    OPTIONAL = "optional"
    REQUIRED = "required"


class GradeEditMode(str, enum.Enum):
    """등급 수정 모드 (프로젝트에서 등급 매핑 수정 권한)"""
    FIXED = "fixed"              # 수정불가: 점수, 항목 모두 수정 불가
    SCORE_ONLY = "score_only"    # 점수만 수정: 점수만 변경 가능, 항목 추가/삭제/이름변경 불가
    FLEXIBLE = "flexible"        # 자유수정: 점수, 항목 모두 수정 가능


class UnifiedTemplate(Base):
    """통합 템플릿 모델"""
    __tablename__ = "unified_templates"

    # =====================
    # 기본 정보
    # =====================
    template_id = Column(String(100), primary_key=True, index=True)
    template_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # =====================
    # 입력 설정 (from InputTemplate)
    # =====================
    # 데이터 소스
    data_source = Column(String(50), nullable=False, default="form_input")
    source_field = Column(String(100), nullable=True)  # user_profile일 때 필드명
    display_only = Column(Boolean, nullable=False, default=False)

    # 필드 스키마 (JSON)
    fields_schema = Column(Text, nullable=False, default="[]")

    # 레이아웃
    layout_type = Column(String(50), nullable=False, default="vertical")

    # 반복 입력
    is_repeatable = Column(Boolean, nullable=False, default=False)
    max_entries = Column(String(10), nullable=True)

    # 검증 및 도움말
    validation_rules = Column(Text, nullable=True)
    help_text = Column(Text, nullable=True)
    placeholder = Column(String(200), nullable=True)

    # =====================
    # 평가 설정 (from ScoringTemplate)
    # =====================
    # 평가 방법 (자격증 특수 케이스)
    evaluation_method = Column(String(50), nullable=False, default="standard")

    # 등급 유형 및 매칭
    grade_type = Column(String(50), nullable=True)  # None이면 평가 불필요
    matching_type = Column(String(50), nullable=True)

    # 값 소스
    scoring_value_source = Column(String(50), nullable=True, default="submitted")
    scoring_source_field = Column(String(100), nullable=True)
    extract_pattern = Column(String(200), nullable=True)

    # 집계 방식
    aggregation_mode = Column(String(50), nullable=True, default="first")

    # 등급 매핑 (JSON)
    default_mappings = Column(Text, nullable=False, default="[]")

    # 평가 옵션
    grade_edit_mode = Column(String(20), nullable=False, default="flexible")  # fixed, score_only, flexible
    proof_required = Column(String(20), nullable=False, default="optional")
    verification_note = Column(Text, nullable=True)

    # 항목 설정 기본값
    is_required_default = Column(Boolean, nullable=False, default=False)
    allow_multiple = Column(Boolean, nullable=False, default=False)

    # 자동 컨펌 정책
    auto_confirm_across_projects = Column(Boolean, nullable=False, default=False)

    # =====================
    # 공통
    # =====================
    keywords = Column(Text, nullable=True)  # JSON 배열
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    competency_items = relationship("CompetencyItem", back_populates="unified_template")

    def get_effective_scoring_config(self, method_override: str = None) -> dict:
        """
        평가 방법에 따른 실제 평가 설정 반환

        Args:
            method_override: 평가 방법 오버라이드 (역량항목 수준에서 지정 가능)

        Returns:
            실제 적용될 평가 설정 dict
        """
        method = method_override or self.evaluation_method

        if method == EvaluationMethod.BY_EXISTENCE.value:
            # 유무 기준 평가: FILE_EXISTS
            return {
                "grade_type": "file_exists",
                "matching_type": "exact",
                "default_mappings": [
                    {"value": "true", "score": 20, "label": "유자격"},
                    {"value": "false", "score": 0, "label": "무자격"}
                ],
                "grade_edit_mode": "fixed",  # 유무 평가는 항상 수정불가
                "scoring_value_source": "submitted",
                "aggregation_mode": "first"
            }
        else:
            # 일반 평가 또는 이름 기준 평가
            try:
                mappings = json.loads(self.default_mappings) if self.default_mappings else []
            except json.JSONDecodeError:
                mappings = []

            return {
                "grade_type": self.grade_type,
                "matching_type": self.matching_type,
                "default_mappings": mappings,
                "grade_edit_mode": self.grade_edit_mode,
                "scoring_value_source": self.scoring_value_source,
                "scoring_source_field": self.scoring_source_field,
                "extract_pattern": self.extract_pattern,
                "aggregation_mode": self.aggregation_mode
            }

    def has_scoring(self) -> bool:
        """평가 설정이 있는지 확인"""
        return self.grade_type is not None and self.matching_type is not None

    def is_certification_template(self) -> bool:
        """자격증 템플릿인지 확인 (평가 방법 선택 가능)"""
        return self.evaluation_method in [
            EvaluationMethod.BY_NAME.value,
            EvaluationMethod.BY_EXISTENCE.value
        ] or "certification" in (self.template_id or "").lower()

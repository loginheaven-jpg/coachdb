"""
평가 템플릿 (ScoringTemplate) 모델

역량 항목의 평가 방법을 정의합니다.
- 등급 유형 (문자열, 숫자, 파일유무)
- 매칭 방식 (정확일치, 포함, 범위, 등급)
- 값 소스 (제출값, 사용자필드, JSON필드)
- 집계 방식 (첫번째, 합계, 최대, 개수 등)
- 등급별 점수 매핑
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


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
    """값을 가져올 위치"""
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


class ScoringTemplate(Base):
    """평가 템플릿 모델"""
    __tablename__ = "scoring_templates"

    # 기본 정보
    template_id = Column(String(100), primary_key=True, index=True)
    template_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # 평가 설정
    grade_type = Column(String(50), nullable=False, default="string")  # string, numeric, file_exists, multi_select
    matching_type = Column(String(50), nullable=False, default="exact")  # exact, contains, range, grade
    value_source = Column(String(50), nullable=False, default="submitted")  # submitted, user_field, json_field
    source_field = Column(String(100), nullable=True)  # user_field, json_field일 때 필드명
    extract_pattern = Column(String(200), nullable=True)  # JSON 추출 패턴
    aggregation_mode = Column(String(50), nullable=False, default="first")  # first, sum, max, count, any_match, best_match

    # 등급 매핑 (JSON)
    # 예: [{"value": "KSC", "score": 40, "label": "KSC (최고급)"}, {"value": "KAC", "score": 30}]
    default_mappings = Column(Text, nullable=False, default="[]")

    # 설정 옵션
    fixed_grades = Column(Boolean, nullable=False, default=False)  # True면 등급 추가/삭제 불가
    allow_add_grades = Column(Boolean, nullable=False, default=True)  # 과제관리자가 등급 추가 가능 여부
    proof_required = Column(String(20), nullable=False, default="optional")  # not_required, optional, required
    verification_note = Column(Text, nullable=True)  # 검증 안내 메모

    # 항목 설정 기본값
    is_required_default = Column(Boolean, nullable=False, default=False)  # 기본 필수 여부
    allow_multiple = Column(Boolean, nullable=False, default=False)  # 다중 입력 허용

    # 자동 컨펌 정책
    auto_confirm_across_projects = Column(Boolean, nullable=False, default=False)  # 타 과제 자동 컨펌

    # 키워드 (자동 매칭용)
    keywords = Column(Text, nullable=True)  # JSON 배열: ["자격증", "KCA"]

    # 상태
    is_active = Column(Boolean, nullable=False, default=True)

    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    competency_items = relationship("CompetencyItem", back_populates="scoring_template")

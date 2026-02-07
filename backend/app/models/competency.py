from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, Boolean, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class CompetencyCategory(str, enum.Enum):
    # Primary categories (aligned with survey grouping)
    BASIC = "BASIC"                  # 기본정보 (User 테이블에서 직접)
    CERTIFICATION = "CERTIFICATION"  # 자격증
    EDUCATION = "EDUCATION"          # 학력
    EXPERIENCE = "EXPERIENCE"        # 역량이력
    OTHER = "OTHER"                  # 기타 (자기소개, 전문분야 등)
    # Legacy categories (deprecated, for backward compatibility)
    DETAIL = "DETAIL"                # Deprecated: use CERTIFICATION/EDUCATION/EXPERIENCE/OTHER
    ADDON = "ADDON"                  # Deprecated: use OTHER
    COACHING = "COACHING"            # Deprecated: use EXPERIENCE
    INFO = "INFO"                    # Deprecated: use BASIC
    EVALUATION = "EVALUATION"        # Deprecated: use specific categories above


class InputType(str, enum.Enum):
    TEXT = "text"
    SELECT = "select"
    NUMBER = "number"
    FILE = "file"


class ItemTemplate(str, enum.Enum):
    """역량 항목 템플릿 유형"""
    TEXT = "text"                      # 단일 텍스트 입력
    NUMBER = "number"                  # 단일 숫자 입력
    SELECT = "select"                  # 단일 선택
    MULTISELECT = "multiselect"        # 다중 선택
    FILE = "file"                      # 단일 파일
    TEXT_FILE = "text_file"            # 텍스트 + 파일 (자격증/경험 형태, 복수 가능)
    DEGREE = "degree"                  # 학위 (선택 + 텍스트 + 파일)
    COACHING_HISTORY = "coaching_history"  # 코칭 분야 이력 + 증빙
    COACHING_TIME = "coaching_time"    # 코칭시간 (내용 + 연도 + 시간 + 증빙)
    COACHING_EXPERIENCE = "coaching_experience"  # 코칭경력 (기관명 + 연도 + 시간 + 증빙)


class MatchingType(str, enum.Enum):
    EXACT = "exact"
    CONTAINS = "contains"
    RANGE = "range"
    GRADE = "grade"  # 등급별 점수 (문자열/숫자 범위 모두 지원)


class ValueSourceType(str, enum.Enum):
    """점수 계산용 값을 가져올 소스 유형"""
    SUBMITTED = "submitted"      # ApplicationData.submitted_value (기본값)
    USER_FIELD = "user_field"    # User 테이블 필드 (예: coach_certification_number)
    JSON_FIELD = "json_field"    # submitted_value JSON 내부 필드 (예: degree_level)


class ProofRequiredLevel(str, enum.Enum):
    NOT_REQUIRED = "not_required"  # 증빙 불필요
    OPTIONAL = "optional"           # 증빙 선택 (제출 가능하나 보류 표시)
    REQUIRED = "required"           # 증빙 필수 (임시저장만 가능)


class AggregationMode(str, enum.Enum):
    """복수입력 항목의 값 집계 방식"""
    FIRST = "first"          # 첫 번째만 (기본값, 현재 동작)
    SUM = "sum"              # 합산 (숫자 범위용)
    MAX = "max"              # 최대값
    COUNT = "count"          # 입력 개수
    ANY_MATCH = "any_match"  # 하나라도 매칭되면 (문자열용)
    BEST_MATCH = "best_match"  # 가장 높은 점수 매칭


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUPPLEMENTED = "supplemented"


class CompetencyItem(Base):
    """Master data - all possible competency items"""

    __tablename__ = "competency_items"

    item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_name = Column(String(200), nullable=False)
    item_code = Column(String(100), nullable=False, unique=True, index=True)
    category = Column(Enum(CompetencyCategory), nullable=False)
    input_type = Column(Enum(InputType), nullable=False)  # Deprecated: use template
    is_active = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=999)  # 전역 정렬 순서

    # Template system (legacy - deprecated, use input_template_id instead)
    template = Column(Enum(ItemTemplate), nullable=True)  # Deprecated: use input_template_id
    template_config = Column(Text, nullable=True)  # JSON configuration for template (legacy)
    is_repeatable = Column(Boolean, nullable=False, default=False)  # Allows multiple entries
    max_entries = Column(Integer, nullable=True)  # Max entries if repeatable (null = unlimited)
    description = Column(Text, nullable=True)  # 설문 입력 안내 문구

    # Input template - 입력 폼 구조 설정 (NEW)
    input_template_id = Column(String(50), ForeignKey("input_templates.template_id"), nullable=True)

    # Scoring template - 평가 방법 설정 (deprecated - use unified_template_id)
    scoring_template_id = Column(String(100), ForeignKey("scoring_templates.template_id"), nullable=True)
    scoring_config_override = Column(Text, nullable=True)  # 커스터마이즈 시 사용 (JSON)

    # Unified template - 통합 템플릿 (입력+평가 통합, NEW)
    unified_template_id = Column(String(100), ForeignKey("unified_templates.template_id"), nullable=True)
    evaluation_method_override = Column(String(50), nullable=True)  # 자격증의 경우 by_name/by_existence 오버라이드

    # 템플릿에서 복사 후 독립 관리하는 필드들
    grade_mappings = Column(Text, nullable=True, default="[]")  # 등급-점수 매핑 JSON
    proof_required = Column(String(20), nullable=True, default="optional")  # not_required, optional, required
    help_text = Column(Text, nullable=True)  # 도움말
    placeholder = Column(String(200), nullable=True)  # 플레이스홀더

    # 평가 설정 (Phase 4: 템플릿에서 역량항목으로 완전 이동)
    grade_type = Column(String(50), nullable=True)  # string, numeric, file_exists, multi_select
    matching_type = Column(String(50), nullable=True)  # exact, contains, range, grade
    grade_edit_mode = Column(String(20), nullable=False, default="flexible")  # fixed, score_only, flexible
    evaluation_method = Column(String(50), nullable=False, default="standard")  # standard, by_name, by_existence
    data_source = Column(String(50), nullable=False, default="form_input")  # form_input, user_profile, coach_competency

    # 점수 소스 설정 (Phase 5: 프리셋에서 완전 독립)
    scoring_value_source = Column(String(50), nullable=True, default="submitted")  # submitted, user_field, json_field
    scoring_source_field = Column(String(100), nullable=True)  # User 필드명 (예: coach_certification_number)
    extract_pattern = Column(String(200), nullable=True)  # 정규식 패턴 (예: ^(.{3}))

    # 역량항목 전용 필드
    verification_note = Column(Text, nullable=True)  # 검증 안내 문구
    auto_confirm_across_projects = Column(Boolean, nullable=True, default=False)  # 타 과제 자동 컨펌
    field_label_overrides = Column(Text, nullable=True, default="{}")  # 필드 라벨 오버라이드 JSON

    # Profile visibility (유무/종류 분리: 프로필에는 대표항목만 표시)
    visible_in_profile = Column(Boolean, nullable=False, default=True)  # 프로필(나의정보)에 표시 여부
    data_source_item_code = Column(String(100), nullable=True)  # 평가전용 항목의 데이터 소스 item_code

    # Custom question support
    is_custom = Column(Boolean, nullable=False, default=False)  # True for custom questions
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)  # Creator for custom questions

    # Relationships
    project_items = relationship("ProjectItem", back_populates="competency_item")
    coach_competencies = relationship("CoachCompetency", back_populates="competency_item")
    fields = relationship("CompetencyItemField", back_populates="item", cascade="all, delete-orphan")
    input_template = relationship("InputTemplate", backref="competency_items")
    scoring_template = relationship("ScoringTemplate", back_populates="competency_items")
    unified_template = relationship("UnifiedTemplate", back_populates="competency_items")

    def __repr__(self):
        return f"<CompetencyItem(item_id={self.item_id}, code={self.item_code}, name={self.item_name})>"


class CompetencyItemField(Base):
    """Template-based fields for competency items"""

    __tablename__ = "competency_item_fields"

    field_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("competency_items.item_id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(100), nullable=False)  # e.g., "degree_level", "major", "proof"
    field_label = Column(String(200), nullable=False)  # e.g., "학위", "전공명", "증빙업로드"
    field_type = Column(String(50), nullable=False)  # "text", "select", "multiselect", "number", "file"
    field_options = Column(Text, nullable=True)  # JSON array for select/multiselect options
    is_required = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=0)
    placeholder = Column(String(200), nullable=True)  # Input hint

    # Relationships
    item = relationship("CompetencyItem", back_populates="fields")

    def __repr__(self):
        return f"<CompetencyItemField(field_id={self.field_id}, item_id={self.item_id}, field_name={self.field_name})>"


class ProjectItem(Base):
    """Project-specific configuration - which items are used in each project"""

    __tablename__ = "project_items"

    project_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("competency_items.item_id"), nullable=False)
    is_required = Column(Boolean, nullable=False, default=False)
    proof_required_level = Column(Enum(ProofRequiredLevel), nullable=False, default=ProofRequiredLevel.NOT_REQUIRED)
    max_score = Column(Numeric(5, 2), nullable=True)  # Max score for this item in this project
    display_order = Column(Integer, nullable=False, default=0)

    # Relationships
    project = relationship("Project", back_populates="project_items")
    competency_item = relationship("CompetencyItem", back_populates="project_items")
    scoring_criteria = relationship("ScoringCriteria", back_populates="project_item", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ProjectItem(project_item_id={self.project_item_id}, project_id={self.project_id}, item_id={self.item_id})>"


class ScoringCriteria(Base):
    """Scoring rules for project items"""

    __tablename__ = "scoring_criteria"

    criteria_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_item_id = Column(Integer, ForeignKey("project_items.project_item_id", ondelete="CASCADE"), nullable=False)
    matching_type = Column(Enum(MatchingType), nullable=False)
    expected_value = Column(Text, nullable=False)  # Value to match (e.g., "KSC", "1500", etc.)
    # GRADE 타입의 경우: {"type": "string", "grades": [{"value": "KSC", "score": 10}, ...]}
    # 또는: {"type": "numeric", "grades": [{"min": 1000, "score": 10}, {"min": 500, "max": 999, "score": 5}]}
    score = Column(Numeric(5, 2), nullable=False)  # Points awarded for this match (GRADE 타입에서는 사용 안함)

    # 값 소스 설정 (GRADE 타입용)
    value_source = Column(
        Enum(ValueSourceType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ValueSourceType.SUBMITTED
    )
    source_field = Column(String(100), nullable=True)  # User 필드명 또는 JSON 필드명 (예: "coach_certification_number", "degree_level")
    extract_pattern = Column(String(100), nullable=True)  # 정규식 패턴 (예: "^(.{3})" - 앞 3글자 추출)

    # 복수입력 항목의 집계 방식 (기본값: first = 첫 번째만)
    # nullable=True for backward compatibility before migration
    aggregation_mode = Column(
        Enum(AggregationMode, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
        default=AggregationMode.FIRST,
        server_default='first'
    )

    # Relationships
    project_item = relationship("ProjectItem", back_populates="scoring_criteria")

    def __repr__(self):
        return f"<ScoringCriteria(criteria_id={self.criteria_id}, expected_value={self.expected_value}, score={self.score})>"


class CoachCompetency(Base):
    """Central wallet - coach competencies (reusable across projects)"""

    __tablename__ = "coach_competencies"

    competency_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("competency_items.item_id"), nullable=False)
    value = Column(Text, nullable=True)
    file_id = Column(BigInteger, ForeignKey("files.file_id"), nullable=True)
    verification_status = Column(Enum(VerificationStatus), nullable=False, default=VerificationStatus.PENDING)
    verified_by = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)  # NEW: reason for supplement request
    is_anonymized = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # 전역 검증 관련 필드 (다중 Verifier 컨펌 시스템)
    is_globally_verified = Column(Boolean, nullable=False, default=False)  # 전역 검증 완료 여부
    globally_verified_at = Column(DateTime(timezone=True), nullable=True)  # 전역 검증 완료 시각

    # Relationships
    user = relationship("User", back_populates="competencies", foreign_keys=[user_id])
    competency_item = relationship("CompetencyItem", back_populates="coach_competencies")
    file = relationship("File", foreign_keys=[file_id])
    verifier = relationship("User", foreign_keys=[verified_by])
    application_data = relationship("ApplicationData", back_populates="linked_competency")
    verification_records = relationship("VerificationRecord", back_populates="competency", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CoachCompetency(competency_id={self.competency_id}, user_id={self.user_id}, item_id={self.item_id}, status={self.verification_status})>"

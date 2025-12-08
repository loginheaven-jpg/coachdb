from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, Boolean, ForeignKey, DateTime, Numeric, func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.competency import ProofRequiredLevel


class CustomQuestion(Base):
    """과제별 커스텀 질문"""

    __tablename__ = "custom_questions"

    question_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)

    question_text = Column(String(500), nullable=False)  # 질문 내용
    question_type = Column(String(20), nullable=False, default="text")  # text, textarea, select, file
    is_required = Column(Boolean, nullable=False, default=False)  # 필수 입력 여부
    display_order = Column(Integer, nullable=False, default=0)  # 표시 순서

    # 추가 역량 항목을 위한 새 필드
    allows_text = Column(Boolean, nullable=False, default=True)  # 텍스트 답변 허용 여부
    allows_file = Column(Boolean, nullable=False, default=False)  # 파일 답변 허용 여부
    file_required = Column(Boolean, nullable=False, default=False)  # 파일 필수 여부 (allows_file=True일 때 유효)

    # 평가 관련 필드
    is_evaluation_item = Column(Boolean, nullable=False, default=False)  # 평가 항목 여부
    max_score = Column(Numeric(5, 2), nullable=True)  # 최대 배점 (평가 항목인 경우)
    proof_required_level = Column(Enum(ProofRequiredLevel), nullable=False, default=ProofRequiredLevel.NOT_REQUIRED)  # 증빙 필요성
    scoring_rules = Column(Text, nullable=True)  # 평가 기준 (JSON 문자열: [{"expected_value": "미비", "score": 1}, ...])

    # Select 타입인 경우 선택지 (JSON 문자열로 저장)
    options = Column(Text, nullable=True)  # JSON array string: ["옵션1", "옵션2", "옵션3"]

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="custom_questions")
    answers = relationship("CustomQuestionAnswer", back_populates="question", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CustomQuestion(question_id={self.question_id}, project_id={self.project_id}, text='{self.question_text[:30]}...')>"


class CustomQuestionAnswer(Base):
    """커스텀 질문에 대한 답변"""

    __tablename__ = "custom_question_answers"

    answer_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    application_id = Column(BigInteger, ForeignKey("applications.application_id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("custom_questions.question_id", ondelete="CASCADE"), nullable=False, index=True)

    answer_text = Column(Text, nullable=True)  # 텍스트 답변
    answer_file_id = Column(BigInteger, ForeignKey("files.file_id"), nullable=True)  # 파일 답변

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    application = relationship("Application", back_populates="custom_question_answers")
    question = relationship("CustomQuestion", back_populates="answers")
    answer_file = relationship("File", foreign_keys=[answer_file_id])

    def __repr__(self):
        return f"<CustomQuestionAnswer(answer_id={self.answer_id}, application_id={self.application_id}, question_id={self.question_id})>"

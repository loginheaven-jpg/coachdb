from sqlalchemy import Column, Integer, BigInteger, Text, Numeric, DateTime, ForeignKey, UniqueConstraint, Enum, CheckConstraint, func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class Recommendation(str, enum.Enum):
    """심사위원 추천 의견"""
    STRONGLY_RECOMMEND = "strongly_recommend"  # 강력 추천
    RECOMMEND = "recommend"                     # 추천
    NEUTRAL = "neutral"                         # 보류
    NOT_RECOMMEND = "not_recommend"             # 비추천


class ReviewerEvaluation(Base):
    """심사위원의 지원서 정성평가"""

    __tablename__ = "reviewer_evaluations"

    evaluation_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    application_id = Column(BigInteger, ForeignKey("applications.application_id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)

    # 정성평가 점수 (각 0-10점)
    motivation_score = Column(Integer, nullable=False)  # 지원동기 점수
    expertise_score = Column(Integer, nullable=False)   # 전문성 점수
    role_fit_score = Column(Integer, nullable=False)    # 역할적합성 점수
    total_score = Column(Numeric(5, 2), nullable=False)  # 합계 (0-30점)

    # 종합 의견
    comment = Column(Text, nullable=True)

    # 추천 여부
    recommendation = Column(Enum(Recommendation), nullable=True)

    evaluated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 중복 평가 방지 (1 지원서에 1 심사위원은 1개의 평가만)
    __table_args__ = (
        UniqueConstraint('application_id', 'reviewer_id', name='uq_application_reviewer'),
        CheckConstraint('motivation_score >= 0 AND motivation_score <= 10', name='check_motivation_score'),
        CheckConstraint('expertise_score >= 0 AND expertise_score <= 10', name='check_expertise_score'),
        CheckConstraint('role_fit_score >= 0 AND role_fit_score <= 10', name='check_role_fit_score'),
    )

    # Relationships
    application = relationship("Application", back_populates="reviewer_evaluations")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

    def __repr__(self):
        return f"<ReviewerEvaluation(evaluation_id={self.evaluation_id}, application_id={self.application_id}, reviewer_id={self.reviewer_id}, total_score={self.total_score})>"

    def calculate_total(self):
        """점수 합계 계산"""
        self.total_score = (self.motivation_score or 0) + (self.expertise_score or 0) + (self.role_fit_score or 0)
        return self.total_score

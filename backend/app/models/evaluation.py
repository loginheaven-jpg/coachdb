from sqlalchemy import Column, Integer, BigInteger, Text, Boolean, DateTime, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CoachEvaluation(Base):
    """과제 종료 후 참여코치 평가"""

    __tablename__ = "coach_evaluations"

    evaluation_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    coach_user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)  # 평가 대상 코치
    evaluated_by = Column(BigInteger, ForeignKey("users.user_id"), nullable=False)  # 평가자 (과제관리자)

    # 4점 척도 평가
    # 4점: 매우 적극적인 참여 (10~20%)
    # 3점: 원만한 참여
    # 2점: 적극 참여가 곤란했음 (과제제출, 소집, 중간회의, 진행보고 등)
    # 1점: 중도 이탈 (단, 객관적으로 납득할 사정, 천재지변에 의한 사정의 경우 참여이력 삭제 또는 과제관리자가 점수부여)
    participation_score = Column(Integer, nullable=False)  # 1~4점

    # 평가 코멘트
    feedback_text = Column(Text, nullable=True)

    # 특이사항 (예: 천재지변, 납득할 사정 등)
    special_notes = Column(Text, nullable=True)

    # 참여 이력 삭제 여부 (천재지변, 객관적 사정 등)
    is_participation_deleted = Column(Boolean, nullable=False, default=False)
    deletion_reason = Column(Text, nullable=True)  # 삭제 사유

    evaluated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 점수 범위 체크 제약 조건
    __table_args__ = (
        CheckConstraint('participation_score >= 1 AND participation_score <= 4', name='check_score_range'),
    )

    # Relationships
    project = relationship("Project", back_populates="evaluations")
    coach = relationship("User", foreign_keys=[coach_user_id])
    evaluator = relationship("User", foreign_keys=[evaluated_by])

    def __repr__(self):
        return f"<CoachEvaluation(evaluation_id={self.evaluation_id}, project_id={self.project_id}, coach_user_id={self.coach_user_id}, score={self.participation_score})>"

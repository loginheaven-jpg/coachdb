from sqlalchemy import Column, BigInteger, Boolean, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class VerificationRecord(Base):
    """개별 Verifier의 증빙 컨펌 기록"""

    __tablename__ = "verification_records"

    record_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    competency_id = Column(BigInteger, ForeignKey("coach_competencies.competency_id", ondelete="CASCADE"), nullable=False, index=True)
    verifier_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    verified_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_valid = Column(Boolean, nullable=False, default=True)  # Reset 시 False로 변경

    # 한 Verifier가 같은 증빙에 중복 컨펌 방지
    __table_args__ = (
        UniqueConstraint('competency_id', 'verifier_id', name='uq_competency_verifier'),
    )

    # Relationships
    competency = relationship("CoachCompetency", back_populates="verification_records")
    verifier = relationship("User", foreign_keys=[verifier_id])

    def __repr__(self):
        return f"<VerificationRecord(record_id={self.record_id}, competency_id={self.competency_id}, verifier_id={self.verifier_id}, is_valid={self.is_valid})>"

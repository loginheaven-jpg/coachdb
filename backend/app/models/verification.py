from sqlalchemy import Column, BigInteger, Boolean, DateTime, ForeignKey, func, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class VerificationRecord(Base):
    """개별 Verifier의 증빙 컨펌 기록

    CoachCompetency 또는 ApplicationData에 대한 Verifier 컨펌을 기록합니다.
    - competency_id: CoachCompetency 검증 시 설정
    - application_data_id: ApplicationData 검증 시 설정
    둘 중 하나만 설정되어야 합니다.
    """

    __tablename__ = "verification_records"

    record_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)

    # CoachCompetency 검증용 (기존)
    competency_id = Column(BigInteger, ForeignKey("coach_competencies.competency_id", ondelete="CASCADE"), nullable=True, index=True)

    # ApplicationData 검증용 (신규)
    application_data_id = Column(BigInteger, ForeignKey("application_data.data_id", ondelete="CASCADE"), nullable=True, index=True)

    verifier_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    verified_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_valid = Column(Boolean, nullable=False, default=True)  # Reset 시 False로 변경

    __table_args__ = (
        # 한 Verifier가 같은 CoachCompetency에 중복 컨펌 방지
        UniqueConstraint('competency_id', 'verifier_id', name='uq_competency_verifier'),
        # 한 Verifier가 같은 ApplicationData에 중복 컨펌 방지
        UniqueConstraint('application_data_id', 'verifier_id', name='uq_appdata_verifier'),
        # competency_id 또는 application_data_id 둘 중 하나는 반드시 설정
        CheckConstraint(
            '(competency_id IS NOT NULL AND application_data_id IS NULL) OR '
            '(competency_id IS NULL AND application_data_id IS NOT NULL)',
            name='chk_one_target'
        ),
        # ApplicationData 인덱스 추가
        Index('ix_verification_records_application_data_id', 'application_data_id'),
    )

    # Relationships
    competency = relationship("CoachCompetency", back_populates="verification_records")
    application_data = relationship("ApplicationData", back_populates="verification_records")
    verifier = relationship("User", foreign_keys=[verifier_id])

    def __repr__(self):
        target = f"competency_id={self.competency_id}" if self.competency_id else f"application_data_id={self.application_data_id}"
        return f"<VerificationRecord(record_id={self.record_id}, {target}, verifier_id={self.verifier_id}, is_valid={self.is_valid})>"

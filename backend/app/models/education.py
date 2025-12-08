from sqlalchemy import Column, BigInteger, String, Integer, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CoachEducationHistory(Base):
    """교육이력 테이블"""

    __tablename__ = "coach_education_history"

    education_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"), nullable=False, index=True)
    education_name = Column(String(200), nullable=False)  # 교육명
    institution = Column(String(200), nullable=True)  # 교육기관
    completion_date = Column(Date, nullable=True)  # 이수일
    hours = Column(Integer, nullable=True)  # 교육시간
    certificate_file_id = Column(BigInteger, ForeignKey("files.file_id"), nullable=True)  # 수료증 파일
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="education_history")
    certificate_file = relationship("File")

    def __repr__(self):
        return f"<CoachEducationHistory(education_id={self.education_id}, user_id={self.user_id}, education_name={self.education_name})>"

from sqlalchemy import Column, BigInteger, String, Integer, Enum, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class UploadPurpose(str, enum.Enum):
    PROOF = "proof"
    PROFILE = "profile"
    OTHER = "other"


class File(Base):
    """Store all uploaded documents"""

    __tablename__ = "files"

    file_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False, unique=True)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    upload_purpose = Column(Enum(UploadPurpose), nullable=False, default=UploadPurpose.OTHER)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    scheduled_deletion_date = Column(Date, nullable=True)  # For 5-year retention policy

    # Relationships
    uploader = relationship("User", back_populates="uploaded_files")

    def __repr__(self):
        return f"<File(file_id={self.file_id}, original_filename={self.original_filename}, uploaded_by={self.uploaded_by})>"

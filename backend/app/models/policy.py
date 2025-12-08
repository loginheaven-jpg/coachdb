from sqlalchemy import Column, Integer, String, Enum, Boolean
import enum

from app.core.database import Base


class ActionOnExpiry(str, enum.Enum):
    ARCHIVE = "archive"
    DELETE = "delete"
    ANONYMIZE = "anonymize"


class DataRetentionPolicy(Base):
    """Define data retention rules"""

    __tablename__ = "data_retention_policy"

    policy_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    data_type = Column(String(100), nullable=False, unique=True)  # e.g., "files", "applications", "logs"
    retention_period_years = Column(Integer, nullable=False)
    action_on_expiry = Column(Enum(ActionOnExpiry), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    def __repr__(self):
        return f"<DataRetentionPolicy(policy_id={self.policy_id}, data_type={self.data_type}, retention_period_years={self.retention_period_years})>"

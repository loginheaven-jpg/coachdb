from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings and configuration"""

    # Application
    APP_NAME: str = "Coach Competency Database Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database - Railway provides postgresql://, we need postgresql+asyncpg://
    DATABASE_URL: str = "postgresql+asyncpg://coachdb:coachdb123@localhost:5432/coachdb"

    @property
    def async_database_url(self) -> str:
        """Convert standard postgresql:// to postgresql+asyncpg:// for async support"""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production-min-32-chars-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS - Allow specific origins for Railway deployment
    # NOTE: Cannot use "*" with allow_credentials=True per CORS spec
    CORS_ORIGINS: str = '[]'  # Can be overridden via env variable
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://kca.up.railway.app",
        "https://coacdbfront-production.up.railway.app",
        "https://coachdbfrontend-production.up.railway.app"
    ]

    # File Storage
    FILE_STORAGE_TYPE: str = "local"  # "local", "s3", "minio", or "r2"
    FILE_STORAGE_PATH: str = "./uploads"
    FILE_MAX_SIZE_MB: int = 10
    # 허용 파일 형식 (비어있으면 모든 형식 허용, BLOCKED_FILE_TYPES 제외)
    FILE_ALLOWED_TYPES: list = []  # 빈 리스트 = 모든 형식 허용
    # 차단 파일 형식 (실행 파일 등 보안 위험 파일)
    FILE_BLOCKED_TYPES: list = [
        ".exe", ".msi", ".bat", ".cmd", ".com", ".dll", ".scr",
        ".vbs", ".vbe", ".js", ".jse", ".ws", ".wsf", ".wsc", ".wsh",
        ".ps1", ".psm1", ".psd1", ".sh", ".bash", ".bin", ".app",
        ".jar", ".msc", ".reg", ".pif", ".gadget", ".hta", ".inf", ".cpl"
    ]

    # AWS S3 (if using S3)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_S3_BUCKET: Optional[str] = None
    AWS_REGION: Optional[str] = "us-east-1"

    # MinIO (if using MinIO)
    MINIO_ENDPOINT: Optional[str] = "localhost:9000"
    MINIO_ACCESS_KEY: Optional[str] = "minioadmin"
    MINIO_SECRET_KEY: Optional[str] = "minioadmin"
    MINIO_BUCKET: Optional[str] = "coach-competency"
    MINIO_SECURE: bool = False

    # Cloudflare R2 (S3 호환)
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET: Optional[str] = None

    @property
    def r2_endpoint_url(self) -> str:
        """R2 S3 호환 엔드포인트"""
        if self.R2_ACCOUNT_ID:
            return f"{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return ""

    # File Retention
    FILE_RETENTION_YEARS: int = 5

    # Review Lock Settings
    REVIEW_LOCK_EXPIRE_MINUTES: int = 30

    # Auto-save Settings
    AUTO_SAVE_INTERVAL_SECONDS: int = 30

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Email Settings (for password reset)
    # SendGrid API (recommended for Railway)
    SENDGRID_API_KEY: Optional[str] = None
    # Legacy SMTP settings (fallback)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    # Common email settings
    SMTP_FROM_EMAIL: str = "noreply@coachdb.com"
    SMTP_FROM_NAME: str = "CoachDB"

    # Password Reset
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24
    FRONTEND_URL: str = "https://kca.up.railway.app"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

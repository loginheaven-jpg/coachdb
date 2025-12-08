from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional


class FileUploadResponse(BaseModel):
    file_id: int
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    upload_purpose: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class FileInfo(BaseModel):
    file_id: int
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
    uploaded_by: int

    class Config:
        from_attributes = True


class FileDownloadInfo(BaseModel):
    file_id: int
    original_filename: str
    file_path: str
    mime_type: str

    class Config:
        from_attributes = True

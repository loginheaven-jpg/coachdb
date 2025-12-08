from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os
import uuid
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error
from io import BytesIO

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.file import File as FileModel, UploadPurpose
from app.schemas.file import FileUploadResponse, FileInfo

router = APIRouter(prefix="/files", tags=["files"])


# MinIO client initialization
def get_minio_client():
    """Get MinIO client instance"""
    if settings.FILE_STORAGE_TYPE != "minio":
        return None

    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE
    )


def ensure_bucket_exists(client: Minio):
    """Ensure MinIO bucket exists"""
    try:
        if not client.bucket_exists(settings.MINIO_BUCKET):
            client.make_bucket(settings.MINIO_BUCKET)
    except S3Error as e:
        print(f"Error creating bucket: {e}")


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    purpose: UploadPurpose = UploadPurpose.PROOF,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file to MinIO storage

    - **file**: The file to upload
    - **purpose**: Upload purpose (proof, profile, other)
    """
    # Validate file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    max_size = settings.FILE_MAX_SIZE_MB * 1024 * 1024  # Convert to bytes
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.FILE_MAX_SIZE_MB}MB"
        )

    # Validate file type
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in settings.FILE_ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file_ext} not allowed. Allowed types: {settings.FILE_ALLOWED_TYPES}"
        )

    # Generate unique filename
    stored_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"uploads/{purpose.value}/{datetime.now().strftime('%Y/%m')}/{stored_filename}"

    try:
        # Upload to MinIO
        if settings.FILE_STORAGE_TYPE == "minio":
            minio_client = get_minio_client()
            ensure_bucket_exists(minio_client)

            # Read file content
            file_content = await file.read()
            file_stream = BytesIO(file_content)

            # Upload to MinIO
            minio_client.put_object(
                settings.MINIO_BUCKET,
                file_path,
                file_stream,
                length=len(file_content),
                content_type=file.content_type
            )
        else:
            # Local file storage
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)

        # Save file metadata to database
        db_file = FileModel(
            original_filename=file.filename,
            stored_filename=stored_filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=file.content_type,
            uploaded_by=current_user.user_id,
            upload_purpose=purpose,
            scheduled_deletion_date=datetime.now().date() + timedelta(days=365 * settings.FILE_RETENTION_YEARS)
        )

        db.add(db_file)
        await db.commit()
        await db.refresh(db_file)

        return FileUploadResponse(
            file_id=db_file.file_id,
            original_filename=db_file.original_filename,
            stored_filename=db_file.stored_filename,
            file_size=db_file.file_size,
            mime_type=db_file.mime_type,
            upload_purpose=db_file.upload_purpose.value,
            uploaded_at=db_file.uploaded_at
        )

    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file to storage: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/{file_id}", response_class=StreamingResponse)
async def download_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download a file from storage

    - **file_id**: The ID of the file to download
    """
    # Get file metadata from database
    result = await db.execute(
        select(FileModel).where(FileModel.file_id == file_id)
    )
    db_file = result.scalar_one_or_none()

    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    # Check permission: user can only download their own files
    # or staff/admin can download any file
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(UserModel.user_id == current_user.user_id)
    )
    user = result.scalar_one()
    import json
    user_roles = json.loads(user.roles)

    if db_file.uploaded_by != current_user.user_id and not any(role in ['staff', 'admin'] for role in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this file"
        )

    try:
        # Download from MinIO
        if settings.FILE_STORAGE_TYPE == "minio":
            minio_client = get_minio_client()

            response = minio_client.get_object(
                settings.MINIO_BUCKET,
                db_file.file_path
            )

            return StreamingResponse(
                response,
                media_type=db_file.mime_type,
                headers={
                    "Content-Disposition": f"attachment; filename={db_file.original_filename}"
                }
            )
        else:
            # Local file storage
            if not os.path.exists(db_file.file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found in storage"
                )

            def file_iterator():
                with open(db_file.file_path, "rb") as f:
                    yield from f

            return StreamingResponse(
                file_iterator(),
                media_type=db_file.mime_type,
                headers={
                    "Content-Disposition": f"attachment; filename={db_file.original_filename}"
                }
            )

    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file from storage: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file: {str(e)}"
        )


@router.get("/{file_id}/info", response_model=FileInfo)
async def get_file_info(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get file metadata

    - **file_id**: The ID of the file
    """
    result = await db.execute(
        select(FileModel).where(FileModel.file_id == file_id)
    )
    db_file = result.scalar_one_or_none()

    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    return FileInfo(
        file_id=db_file.file_id,
        original_filename=db_file.original_filename,
        file_size=db_file.file_size,
        mime_type=db_file.mime_type,
        uploaded_at=db_file.uploaded_at,
        uploaded_by=db_file.uploaded_by
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a file from storage and database

    - **file_id**: The ID of the file to delete
    """
    # Get file metadata from database
    result = await db.execute(
        select(FileModel).where(FileModel.file_id == file_id)
    )
    db_file = result.scalar_one_or_none()

    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    # Check permission: user can only delete their own files
    if db_file.uploaded_by != current_user.user_id:
        from app.models.user import User as UserModel
        result = await db.execute(
            select(UserModel).where(UserModel.user_id == current_user.user_id)
        )
        user = result.scalar_one()
        import json
        user_roles = json.loads(user.roles)

        if not any(role in ['staff', 'admin'] for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this file"
            )

    try:
        # Delete from MinIO
        if settings.FILE_STORAGE_TYPE == "minio":
            minio_client = get_minio_client()
            minio_client.remove_object(
                settings.MINIO_BUCKET,
                db_file.file_path
            )
        else:
            # Local file storage
            if os.path.exists(db_file.file_path):
                os.remove(db_file.file_path)

        # Delete from database
        await db.delete(db_file)
        await db.commit()

        return {"message": "File deleted successfully"}

    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file from storage: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}"
        )

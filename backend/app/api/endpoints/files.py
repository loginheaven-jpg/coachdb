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
from app.core.utils import get_user_roles
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


def ensure_bucket_exists(client: Minio, bucket_name: str):
    """Ensure bucket exists"""
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
    except S3Error as e:
        print(f"Error creating bucket: {e}")


# Cloudflare R2 client initialization
def get_r2_client():
    """Get R2 client instance (S3 compatible)"""
    if settings.FILE_STORAGE_TYPE != "r2":
        return None

    return Minio(
        settings.r2_endpoint_url,
        access_key=settings.R2_ACCESS_KEY_ID,
        secret_key=settings.R2_SECRET_ACCESS_KEY,
        secure=True
    )


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
    # 차단된 파일 형식 확인 (실행 파일 등)
    if file_ext in settings.FILE_BLOCKED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"실행 파일({file_ext})은 보안상의 이유로 업로드할 수 없습니다."
        )
    # 허용 파일 형식이 지정된 경우 확인 (빈 리스트면 모든 형식 허용)
    if settings.FILE_ALLOWED_TYPES and file_ext not in settings.FILE_ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file_ext} not allowed. Allowed types: {settings.FILE_ALLOWED_TYPES}"
        )

    # Generate unique filename
    stored_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"uploads/{purpose.value}/{datetime.now().strftime('%Y/%m')}/{stored_filename}"

    try:
        # Read file content once for all storage types
        file_content = await file.read()

        # Upload to storage
        if settings.FILE_STORAGE_TYPE == "r2":
            # Cloudflare R2
            r2_client = get_r2_client()
            ensure_bucket_exists(r2_client, settings.R2_BUCKET)

            file_stream = BytesIO(file_content)
            r2_client.put_object(
                settings.R2_BUCKET,
                file_path,
                file_stream,
                length=len(file_content),
                content_type=file.content_type
            )

            # Verify upload was successful
            try:
                r2_client.stat_object(settings.R2_BUCKET, file_path)
            except S3Error as verify_error:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"파일 업로드 검증 실패: 파일이 스토리지에 저장되지 않았습니다. ({verify_error.code})"
                )
        elif settings.FILE_STORAGE_TYPE == "minio":
            # MinIO
            minio_client = get_minio_client()
            ensure_bucket_exists(minio_client, settings.MINIO_BUCKET)

            file_stream = BytesIO(file_content)
            minio_client.put_object(
                settings.MINIO_BUCKET,
                file_path,
                file_stream,
                length=len(file_content),
                content_type=file.content_type
            )

            # Verify upload was successful
            try:
                minio_client.stat_object(settings.MINIO_BUCKET, file_path)
            except S3Error as verify_error:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"파일 업로드 검증 실패: 파일이 스토리지에 저장되지 않았습니다. ({verify_error.code})"
                )
        else:
            # Local file storage
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(file_content)

            # Verify upload was successful
            if not os.path.exists(file_path):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="파일 업로드 검증 실패: 파일이 로컬 스토리지에 저장되지 않았습니다."
                )

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
    # or staff/admin/verifier can download any file
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(UserModel.user_id == current_user.user_id)
    )
    user = result.scalar_one()
    user_roles = get_user_roles(user)

    # 허용된 역할: staff, admin (레거시) + VERIFIER, REVIEWER, PROJECT_MANAGER, SUPER_ADMIN
    allowed_roles = ['staff', 'admin', 'VERIFIER', 'REVIEWER', 'PROJECT_MANAGER', 'SUPER_ADMIN']
    if db_file.uploaded_by != current_user.user_id and not any(role in allowed_roles for role in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this file"
        )

    try:
        # Download from storage
        if settings.FILE_STORAGE_TYPE == "r2":
            # Cloudflare R2
            r2_client = get_r2_client()

            response = r2_client.get_object(
                settings.R2_BUCKET,
                db_file.file_path
            )

            return StreamingResponse(
                response,
                media_type=db_file.mime_type,
                headers={
                    "Content-Disposition": f"attachment; filename={db_file.original_filename}"
                }
            )
        elif settings.FILE_STORAGE_TYPE == "minio":
            # MinIO
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
        # NoSuchKey means the file doesn't exist in storage
        if e.code == "NoSuchKey":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found in storage: {db_file.file_path}"
            )
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


@router.get("/{file_id}/download-url")
async def get_download_url(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a presigned URL for direct file download from R2/MinIO storage.
    This is more efficient than proxying through the backend.

    - **file_id**: The ID of the file

    Returns a presigned URL valid for 1 hour.
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

    # Check permission
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(UserModel.user_id == current_user.user_id)
    )
    user = result.scalar_one()
    user_roles = get_user_roles(user)

    allowed_roles = ['staff', 'admin', 'VERIFIER', 'REVIEWER', 'PROJECT_MANAGER', 'SUPER_ADMIN']
    if db_file.uploaded_by != current_user.user_id and not any(role in allowed_roles for role in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this file"
        )

    try:
        if settings.FILE_STORAGE_TYPE == "r2":
            r2_client = get_r2_client()
            # Check if file exists before generating presigned URL
            try:
                r2_client.stat_object(settings.R2_BUCKET, db_file.file_path)
            except S3Error as stat_error:
                if stat_error.code == "NoSuchKey":
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"File not found in storage: {db_file.file_path}"
                    )
                raise
            # Generate presigned URL valid for 1 hour
            url = r2_client.presigned_get_object(
                settings.R2_BUCKET,
                db_file.file_path,
                expires=timedelta(hours=1)
            )
            return {
                "download_url": url,
                "filename": db_file.original_filename,
                "expires_in": 3600  # seconds
            }
        elif settings.FILE_STORAGE_TYPE == "minio":
            minio_client = get_minio_client()
            # Check if file exists before generating presigned URL
            try:
                minio_client.stat_object(settings.MINIO_BUCKET, db_file.file_path)
            except S3Error as stat_error:
                if stat_error.code == "NoSuchKey":
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"File not found in storage: {db_file.file_path}"
                    )
                raise
            url = minio_client.presigned_get_object(
                settings.MINIO_BUCKET,
                db_file.file_path,
                expires=timedelta(hours=1)
            )
            return {
                "download_url": url,
                "filename": db_file.original_filename,
                "expires_in": 3600
            }
        else:
            # Local storage - check if file exists and return the direct download endpoint
            if not os.path.exists(db_file.file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File not found in storage: {db_file.file_path}"
                )
            return {
                "download_url": f"/api/files/{file_id}",
                "filename": db_file.original_filename,
                "expires_in": None,
                "is_local": True
            }
    except HTTPException:
        raise
    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}"
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
    # or staff/admin/PM can delete any file
    if db_file.uploaded_by != current_user.user_id:
        from app.models.user import User as UserModel
        result = await db.execute(
            select(UserModel).where(UserModel.user_id == current_user.user_id)
        )
        user = result.scalar_one()
        user_roles = get_user_roles(user)

        # 허용된 역할: staff, admin (레거시) + PROJECT_MANAGER, SUPER_ADMIN
        allowed_roles = ['staff', 'admin', 'PROJECT_MANAGER', 'SUPER_ADMIN']
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this file"
            )

    try:
        # Delete from storage
        if settings.FILE_STORAGE_TYPE == "r2":
            # Cloudflare R2
            r2_client = get_r2_client()
            r2_client.remove_object(
                settings.R2_BUCKET,
                db_file.file_path
            )
        elif settings.FILE_STORAGE_TYPE == "minio":
            # MinIO
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


@router.get("/admin/check-orphans")
async def check_orphan_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check for orphan files - files that exist in database but not in storage.
    Only accessible by SUPER_ADMIN or PROJECT_MANAGER.

    Returns a list of file records that have missing files in storage.
    """
    # Check permission
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(UserModel.user_id == current_user.user_id)
    )
    user = result.scalar_one()
    user_roles = get_user_roles(user)

    allowed_roles = ['SUPER_ADMIN', 'PROJECT_MANAGER']
    if not any(role in allowed_roles for role in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 접근할 수 있습니다."
        )

    # Get all files from database
    result = await db.execute(select(FileModel))
    all_files = result.scalars().all()

    orphan_files = []

    if settings.FILE_STORAGE_TYPE == "r2":
        r2_client = get_r2_client()
        for db_file in all_files:
            try:
                r2_client.stat_object(settings.R2_BUCKET, db_file.file_path)
            except S3Error as e:
                if e.code == "NoSuchKey":
                    orphan_files.append({
                        "file_id": db_file.file_id,
                        "original_filename": db_file.original_filename,
                        "file_path": db_file.file_path,
                        "uploaded_at": db_file.uploaded_at.isoformat() if db_file.uploaded_at else None,
                        "uploaded_by": db_file.uploaded_by
                    })
    elif settings.FILE_STORAGE_TYPE == "minio":
        minio_client = get_minio_client()
        for db_file in all_files:
            try:
                minio_client.stat_object(settings.MINIO_BUCKET, db_file.file_path)
            except S3Error as e:
                if e.code == "NoSuchKey":
                    orphan_files.append({
                        "file_id": db_file.file_id,
                        "original_filename": db_file.original_filename,
                        "file_path": db_file.file_path,
                        "uploaded_at": db_file.uploaded_at.isoformat() if db_file.uploaded_at else None,
                        "uploaded_by": db_file.uploaded_by
                    })
    else:
        for db_file in all_files:
            if not os.path.exists(db_file.file_path):
                orphan_files.append({
                    "file_id": db_file.file_id,
                    "original_filename": db_file.original_filename,
                    "file_path": db_file.file_path,
                    "uploaded_at": db_file.uploaded_at.isoformat() if db_file.uploaded_at else None,
                    "uploaded_by": db_file.uploaded_by
                })

    return {
        "total_files": len(all_files),
        "orphan_count": len(orphan_files),
        "orphan_files": orphan_files
    }


@router.get("/admin/orphan-competencies")
async def check_orphan_competencies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Find CoachCompetency records that reference files missing from storage.
    This helps identify competency records that need to be updated or deleted.

    Returns competency details including user info and item info.
    """
    from app.models.competency import CoachCompetency, CompetencyItem
    from sqlalchemy.orm import selectinload

    # Check permission
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(UserModel.user_id == current_user.user_id)
    )
    user = result.scalar_one()
    user_roles = get_user_roles(user)

    allowed_roles = ['SUPER_ADMIN', 'PROJECT_MANAGER']
    if not any(role in allowed_roles for role in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 접근할 수 있습니다."
        )

    # Get all competencies with file_id
    result = await db.execute(
        select(CoachCompetency)
        .options(
            selectinload(CoachCompetency.competency_item),
            selectinload(CoachCompetency.user),
            selectinload(CoachCompetency.file)
        )
        .where(CoachCompetency.file_id.isnot(None))
    )
    competencies = result.scalars().all()

    orphan_competencies = []

    if settings.FILE_STORAGE_TYPE == "r2":
        r2_client = get_r2_client()
        for comp in competencies:
            if comp.file:
                try:
                    r2_client.stat_object(settings.R2_BUCKET, comp.file.file_path)
                except S3Error as e:
                    if e.code == "NoSuchKey":
                        orphan_competencies.append({
                            "competency_id": comp.competency_id,
                            "user_id": comp.user_id,
                            "user_name": comp.user.name if comp.user else None,
                            "user_email": comp.user.email if comp.user else None,
                            "item_id": comp.item_id,
                            "item_name": comp.competency_item.item_name if comp.competency_item else None,
                            "item_code": comp.competency_item.item_code if comp.competency_item else None,
                            "file_id": comp.file_id,
                            "original_filename": comp.file.original_filename if comp.file else None,
                            "file_path": comp.file.file_path if comp.file else None,
                            "verification_status": comp.verification_status.value if comp.verification_status else None,
                            "is_globally_verified": comp.is_globally_verified,
                            "created_at": comp.created_at.isoformat() if comp.created_at else None
                        })
    elif settings.FILE_STORAGE_TYPE == "minio":
        minio_client = get_minio_client()
        for comp in competencies:
            if comp.file:
                try:
                    minio_client.stat_object(settings.MINIO_BUCKET, comp.file.file_path)
                except S3Error as e:
                    if e.code == "NoSuchKey":
                        orphan_competencies.append({
                            "competency_id": comp.competency_id,
                            "user_id": comp.user_id,
                            "user_name": comp.user.name if comp.user else None,
                            "user_email": comp.user.email if comp.user else None,
                            "item_id": comp.item_id,
                            "item_name": comp.competency_item.item_name if comp.competency_item else None,
                            "item_code": comp.competency_item.item_code if comp.competency_item else None,
                            "file_id": comp.file_id,
                            "original_filename": comp.file.original_filename if comp.file else None,
                            "file_path": comp.file.file_path if comp.file else None,
                            "verification_status": comp.verification_status.value if comp.verification_status else None,
                            "is_globally_verified": comp.is_globally_verified,
                            "created_at": comp.created_at.isoformat() if comp.created_at else None
                        })

    return {
        "total_competencies_with_files": len(competencies),
        "orphan_count": len(orphan_competencies),
        "orphan_competencies": orphan_competencies,
        "message": "고아 역량 레코드를 발견했습니다. 해당 코치에게 역량 수정을 요청하거나, /api/files/admin/delete-orphan-competency API를 사용하여 삭제할 수 있습니다." if orphan_competencies else "고아 역량 레코드가 없습니다."
    }


@router.delete("/admin/delete-orphan-competency/{competency_id}")
async def delete_orphan_competency(
    competency_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a CoachCompetency record that references a missing file.
    This is used to clean up orphan competency records.

    WARNING: This will permanently delete the competency record and its associated
    verification records. Use with caution.
    """
    from app.models.competency import CoachCompetency

    # Check permission
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(UserModel.user_id == current_user.user_id)
    )
    user = result.scalar_one()
    user_roles = get_user_roles(user)

    allowed_roles = ['SUPER_ADMIN', 'PROJECT_MANAGER']
    if not any(role in allowed_roles for role in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 접근할 수 있습니다."
        )

    # Get competency
    result = await db.execute(
        select(CoachCompetency).where(CoachCompetency.competency_id == competency_id)
    )
    competency = result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="역량 레코드를 찾을 수 없습니다."
        )

    # Verify it's actually an orphan (file doesn't exist in storage)
    if competency.file_id:
        file_result = await db.execute(
            select(FileModel).where(FileModel.file_id == competency.file_id)
        )
        db_file = file_result.scalar_one_or_none()

        if db_file:
            is_orphan = False
            if settings.FILE_STORAGE_TYPE == "r2":
                r2_client = get_r2_client()
                try:
                    r2_client.stat_object(settings.R2_BUCKET, db_file.file_path)
                    is_orphan = False
                except S3Error as e:
                    if e.code == "NoSuchKey":
                        is_orphan = True
            elif settings.FILE_STORAGE_TYPE == "minio":
                minio_client = get_minio_client()
                try:
                    minio_client.stat_object(settings.MINIO_BUCKET, db_file.file_path)
                    is_orphan = False
                except S3Error as e:
                    if e.code == "NoSuchKey":
                        is_orphan = True

            if not is_orphan:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이 역량 레코드는 고아 상태가 아닙니다. 파일이 스토리지에 존재합니다."
                )

    # Delete the competency (cascade will delete verification records)
    await db.delete(competency)
    await db.commit()

    return {
        "message": f"역량 레코드 (ID: {competency_id})가 삭제되었습니다.",
        "deleted_competency_id": competency_id
    }

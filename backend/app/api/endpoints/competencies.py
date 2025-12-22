from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
import json
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.utils import get_user_roles
from app.models.user import User
from app.models.competency import CoachCompetency, CompetencyItem, CompetencyItemField, VerificationStatus
from app.models.verification import VerificationRecord
from app.models.file import File
from app.schemas.competency import (
    CompetencyCreate,
    CompetencyUpdate,
    CoachCompetencyResponse,
    CompetencyItemResponse,
    CompetencyItemFieldResponse,
    FileBasicInfo,
    CompetencyItemCreate,
    CompetencyItemUpdate,
    CompetencyItemFieldCreate,
    CompetencyItemFieldUpdate
)

router = APIRouter(prefix="/competencies", tags=["competencies"])

# Debug: Log router initialization
print("[competencies.py] Router initialized with prefix=/competencies")


# ============================================================================
# Migration Endpoint - 기존 응모 데이터를 세부정보로 마이그레이션
# ============================================================================
@router.get("/migrate-test")
async def migrate_test(current_user: User = Depends(get_current_user)):
    """Test endpoint to verify migration route is accessible"""
    print("[migrate-test] GET endpoint called!")
    return {"message": "Migration endpoint is accessible", "user_id": current_user.user_id}


@router.post("/migrate-from-applications")
async def migrate_from_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Migrate current user's application data to competency wallet

    This endpoint reads all ApplicationData for the user and creates
    corresponding CoachCompetency entries.
    """
    print("[migrate-from-applications] Endpoint called!")  # Debug log
    from app.models.application import Application, ApplicationData

    print(f"[Migration] Starting for user {current_user.user_id}")

    # Get all user's applications
    apps_result = await db.execute(
        select(Application).where(Application.user_id == current_user.user_id)
    )
    applications = apps_result.scalars().all()
    print(f"[Migration] Found {len(applications)} applications")

    migrated_count = 0
    skipped_count = 0
    errors = []

    for application in applications:
        # Get application data
        data_result = await db.execute(
            select(ApplicationData).where(ApplicationData.application_id == application.application_id)
        )
        app_data_items = data_result.scalars().all()
        print(f"[Migration] Application {application.application_id} has {len(app_data_items)} data items")

        for data_item in app_data_items:
            if not data_item.submitted_value:
                skipped_count += 1
                continue

            try:
                # Check if competency already exists
                comp_result = await db.execute(
                    select(CoachCompetency).where(
                        CoachCompetency.user_id == current_user.user_id,
                        CoachCompetency.item_id == data_item.item_id
                    )
                )
                existing = comp_result.scalar_one_or_none()

                if existing:
                    if existing.value != data_item.submitted_value:
                        existing.value = data_item.submitted_value
                        if data_item.submitted_file_id:
                            existing.file_id = data_item.submitted_file_id
                        migrated_count += 1
                        print(f"[Migration] Updated competency for item_id={data_item.item_id}")
                    else:
                        skipped_count += 1
                else:
                    new_comp = CoachCompetency(
                        user_id=current_user.user_id,
                        item_id=data_item.item_id,
                        value=data_item.submitted_value,
                        file_id=data_item.submitted_file_id,
                        verification_status=VerificationStatus.PENDING
                    )
                    db.add(new_comp)
                    migrated_count += 1
                    print(f"[Migration] Created competency for item_id={data_item.item_id}")
            except Exception as e:
                errors.append(f"item_id={data_item.item_id}: {str(e)}")
                print(f"[Migration] Error: {str(e)}")

    await db.commit()
    print(f"[Migration] Complete: migrated={migrated_count}, skipped={skipped_count}")

    return {
        "message": f"마이그레이션 완료: {migrated_count}개 동기화, {skipped_count}개 스킵",
        "migrated": migrated_count,
        "skipped": skipped_count,
        "errors": errors if errors else None
    }


@router.get("/items", response_model=List[CompetencyItemResponse])
async def get_competency_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all active competency items (master data)"""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.is_active == True)
        .options(selectinload(CompetencyItem.fields))
    )
    items = result.scalars().all()
    return items


@router.get("/my", response_model=List[CoachCompetencyResponse])
async def get_my_competencies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's competencies"""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(CoachCompetency)
        .where(CoachCompetency.user_id == current_user.user_id)
        .options(
            selectinload(CoachCompetency.competency_item).selectinload(CompetencyItem.fields),
            selectinload(CoachCompetency.file)
        )
        .order_by(CoachCompetency.created_at.desc())
    )
    competencies = result.scalars().all()

    # Manually construct response to avoid model_validate issues with nested objects
    response_list = []
    for competency in competencies:
        # Build competency_item response if exists
        competency_item_response = None
        if competency.competency_item:
            item = competency.competency_item
            fields_response = []
            if item.fields:
                for field in item.fields:
                    fields_response.append(CompetencyItemFieldResponse(
                        field_id=field.field_id,
                        field_name=field.field_name or "",
                        field_label=field.field_label or "",
                        field_type=field.field_type or "text",
                        field_options=field.field_options,
                        is_required=field.is_required if field.is_required is not None else True,
                        display_order=field.display_order if field.display_order is not None else 0,
                        placeholder=field.placeholder
                    ))

            competency_item_response = CompetencyItemResponse(
                item_id=item.item_id,
                item_name=item.item_name or "",
                item_code=item.item_code or "",
                category=item.category.value if item.category else "ADDON",
                input_type=item.input_type.value if item.input_type else "text",
                is_active=item.is_active if item.is_active is not None else True,
                template=item.template,
                template_config=item.template_config,
                is_repeatable=item.is_repeatable if item.is_repeatable is not None else False,
                max_entries=item.max_entries,
                description=item.description,
                is_custom=item.is_custom if item.is_custom is not None else False,
                created_by=item.created_by,
                fields=fields_response
            )

        # Build file_info response if exists
        file_info_response = None
        if competency.file:
            file_info_response = FileBasicInfo(
                file_id=competency.file.file_id,
                original_filename=competency.file.original_filename,
                file_size=competency.file.file_size,
                mime_type=competency.file.mime_type,
                uploaded_at=competency.file.uploaded_at
            )

        # Build main response with null handling for required fields
        try:
            response = CoachCompetencyResponse(
                competency_id=competency.competency_id,
                user_id=competency.user_id,
                item_id=competency.item_id,
                value=competency.value,
                file_id=competency.file_id,
                verification_status=competency.verification_status if competency.verification_status else VerificationStatus.PENDING,
                verified_by=competency.verified_by,
                verified_at=competency.verified_at,
                rejection_reason=competency.rejection_reason,
                is_anonymized=competency.is_anonymized if competency.is_anonymized is not None else False,
                created_at=competency.created_at,
                updated_at=competency.updated_at,
                is_globally_verified=competency.is_globally_verified if competency.is_globally_verified is not None else False,
                globally_verified_at=competency.globally_verified_at,
                competency_item=competency_item_response,
                file_info=file_info_response
            )
            response_list.append(response)
        except Exception as e:
            # Log the error but continue processing other competencies
            import logging
            logging.error(f"Error processing competency {competency.competency_id}: {str(e)}")

    return response_list


@router.post("/", response_model=CoachCompetencyResponse, status_code=status.HTTP_201_CREATED)
async def create_competency(
    competency_data: CompetencyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new competency for current user"""
    # Verify item exists
    item_result = await db.execute(
        select(CompetencyItem).where(CompetencyItem.item_id == competency_data.item_id)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency item not found"
        )

    # Create competency
    new_competency = CoachCompetency(
        user_id=current_user.user_id,
        item_id=competency_data.item_id,
        value=competency_data.value,
        file_id=competency_data.file_id,
        verification_status=VerificationStatus.PENDING
    )

    db.add(new_competency)
    await db.commit()
    await db.refresh(new_competency)

    # Build competency_item response
    from sqlalchemy.orm import selectinload
    item_with_fields_result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == new_competency.item_id)
        .options(selectinload(CompetencyItem.fields))
    )
    item_with_fields = item_with_fields_result.scalar_one_or_none()

    competency_item_response = None
    if item_with_fields:
        fields_response = []
        if item_with_fields.fields:
            for field in item_with_fields.fields:
                fields_response.append(CompetencyItemFieldResponse(
                    field_id=field.field_id,
                    field_name=field.field_name or "",
                    field_label=field.field_label or "",
                    field_type=field.field_type or "text",
                    field_options=field.field_options,
                    is_required=field.is_required if field.is_required is not None else True,
                    display_order=field.display_order if field.display_order is not None else 0,
                    placeholder=field.placeholder
                ))

        competency_item_response = CompetencyItemResponse(
            item_id=item_with_fields.item_id,
            item_name=item_with_fields.item_name or "",
            item_code=item_with_fields.item_code or "",
            category=item_with_fields.category.value if item_with_fields.category else "ADDON",
            input_type=item_with_fields.input_type.value if item_with_fields.input_type else "text",
            is_active=item_with_fields.is_active if item_with_fields.is_active is not None else True,
            template=item_with_fields.template,
            template_config=item_with_fields.template_config,
            is_repeatable=item_with_fields.is_repeatable if item_with_fields.is_repeatable is not None else False,
            max_entries=item_with_fields.max_entries,
            description=item_with_fields.description,
            is_custom=item_with_fields.is_custom if item_with_fields.is_custom is not None else False,
            created_by=item_with_fields.created_by,
            fields=fields_response
        )

    # Fetch file info if file_id exists
    file_info_response = None
    if new_competency.file_id:
        file_result = await db.execute(
            select(File).where(File.file_id == new_competency.file_id)
        )
        file_obj = file_result.scalar_one_or_none()
        if file_obj:
            file_info_response = FileBasicInfo(
                file_id=file_obj.file_id,
                original_filename=file_obj.original_filename,
                file_size=file_obj.file_size,
                mime_type=file_obj.mime_type,
                uploaded_at=file_obj.uploaded_at
            )

    # Build and return response
    return CoachCompetencyResponse(
        competency_id=new_competency.competency_id,
        user_id=new_competency.user_id,
        item_id=new_competency.item_id,
        value=new_competency.value,
        file_id=new_competency.file_id,
        verification_status=new_competency.verification_status if new_competency.verification_status else VerificationStatus.PENDING,
        verified_by=new_competency.verified_by,
        verified_at=new_competency.verified_at,
        rejection_reason=new_competency.rejection_reason,
        is_anonymized=new_competency.is_anonymized if new_competency.is_anonymized is not None else False,
        created_at=new_competency.created_at,
        updated_at=new_competency.updated_at,
        is_globally_verified=new_competency.is_globally_verified if new_competency.is_globally_verified is not None else False,
        globally_verified_at=new_competency.globally_verified_at,
        competency_item=competency_item_response,
        file_info=file_info_response
    )


@router.put("/{competency_id}", response_model=CoachCompetencyResponse)
async def update_competency(
    competency_id: int,
    competency_data: CompetencyUpdate,
    sync_to_applications: bool = Query(False, description="연결된 ApplicationData에도 동기화 여부"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing competency"""
    # Find competency
    result = await db.execute(
        select(CoachCompetency).where(
            CoachCompetency.competency_id == competency_id,
            CoachCompetency.user_id == current_user.user_id
        )
    )
    competency = result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency not found"
        )

    # Check if value or file is actually changed
    value_changed = competency_data.value is not None and competency_data.value != competency.value
    file_changed = competency_data.file_id is not None and competency_data.file_id != competency.file_id

    # Update fields
    if competency_data.value is not None:
        competency.value = competency_data.value
    if competency_data.file_id is not None:
        competency.file_id = competency_data.file_id

    # Reset verification status when updated
    competency.verification_status = VerificationStatus.PENDING
    competency.verified_by = None
    competency.verified_at = None
    competency.rejection_reason = None

    # If value or file changed, reset global verification and invalidate all verification records
    if value_changed or file_changed:
        competency.is_globally_verified = False
        competency.globally_verified_at = None

        # Invalidate all existing verification records for this competency
        records_result = await db.execute(
            select(VerificationRecord).where(
                and_(
                    VerificationRecord.competency_id == competency_id,
                    VerificationRecord.is_valid == True
                )
            )
        )
        records = records_result.scalars().all()
        for record in records:
            record.is_valid = False

        # Sync to linked ApplicationData if requested (역방향 동기화)
        if sync_to_applications:
            from app.models.application import ApplicationData, Application

            # 1. competency_id로 직접 연결된 ApplicationData 찾기
            app_data_result = await db.execute(
                select(ApplicationData).where(
                    ApplicationData.competency_id == competency_id
                )
            )
            linked_app_data = list(app_data_result.scalars().all())

            # 2. competency_id가 없는 기존 데이터도 item_id + user's applications으로 찾기
            # (backward compatibility for data created before competency_id link was added)
            user_apps_result = await db.execute(
                select(Application.application_id).where(
                    Application.user_id == current_user.user_id
                )
            )
            user_app_ids = [app_id for (app_id,) in user_apps_result.fetchall()]

            if user_app_ids:
                unlinked_result = await db.execute(
                    select(ApplicationData).where(
                        ApplicationData.application_id.in_(user_app_ids),
                        ApplicationData.item_id == competency.item_id,
                        ApplicationData.competency_id.is_(None)  # Only unlinked data
                    )
                )
                unlinked_app_data = unlinked_result.scalars().all()

                # Add to linked list and also set competency_id for future syncs
                for app_data in unlinked_app_data:
                    app_data.competency_id = competency_id  # Link for future
                    if app_data not in linked_app_data:
                        linked_app_data.append(app_data)

            for app_data in linked_app_data:
                # Update the snapshot values to match current competency
                app_data.submitted_value = competency.value
                app_data.submitted_file_id = competency.file_id
                # Reset verification status to pending
                app_data.verification_status = "pending"

            print(f"[Sync] Updated {len(linked_app_data)} ApplicationData items for competency {competency_id}")

    await db.commit()
    await db.refresh(competency)

    # Fetch competency item with fields
    from sqlalchemy.orm import selectinload
    item_result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == competency.item_id)
        .options(selectinload(CompetencyItem.fields))
    )
    item = item_result.scalar_one_or_none()

    # Build competency_item response
    competency_item_response = None
    if item:
        fields_response = []
        if item.fields:
            for field in item.fields:
                fields_response.append(CompetencyItemFieldResponse(
                    field_id=field.field_id,
                    field_name=field.field_name or "",
                    field_label=field.field_label or "",
                    field_type=field.field_type or "text",
                    field_options=field.field_options,
                    is_required=field.is_required if field.is_required is not None else True,
                    display_order=field.display_order if field.display_order is not None else 0,
                    placeholder=field.placeholder
                ))

        competency_item_response = CompetencyItemResponse(
            item_id=item.item_id,
            item_name=item.item_name or "",
            item_code=item.item_code or "",
            category=item.category.value if item.category else "ADDON",
            input_type=item.input_type.value if item.input_type else "text",
            is_active=item.is_active if item.is_active is not None else True,
            template=item.template,
            template_config=item.template_config,
            is_repeatable=item.is_repeatable if item.is_repeatable is not None else False,
            max_entries=item.max_entries,
            description=item.description,
            is_custom=item.is_custom if item.is_custom is not None else False,
            created_by=item.created_by,
            fields=fields_response
        )

    # Fetch file info if file_id exists
    file_info_response = None
    if competency.file_id:
        file_result = await db.execute(
            select(File).where(File.file_id == competency.file_id)
        )
        file_obj = file_result.scalar_one_or_none()
        if file_obj:
            file_info_response = FileBasicInfo(
                file_id=file_obj.file_id,
                original_filename=file_obj.original_filename,
                file_size=file_obj.file_size,
                mime_type=file_obj.mime_type,
                uploaded_at=file_obj.uploaded_at
            )

    # Build and return response
    return CoachCompetencyResponse(
        competency_id=competency.competency_id,
        user_id=competency.user_id,
        item_id=competency.item_id,
        value=competency.value,
        file_id=competency.file_id,
        verification_status=competency.verification_status if competency.verification_status else VerificationStatus.PENDING,
        verified_by=competency.verified_by,
        verified_at=competency.verified_at,
        rejection_reason=competency.rejection_reason,
        is_anonymized=competency.is_anonymized if competency.is_anonymized is not None else False,
        created_at=competency.created_at,
        updated_at=competency.updated_at,
        is_globally_verified=competency.is_globally_verified if competency.is_globally_verified is not None else False,
        globally_verified_at=competency.globally_verified_at,
        competency_item=competency_item_response,
        file_info=file_info_response
    )


@router.get("/{competency_id}/has-linked-applications")
async def check_linked_applications(
    competency_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check if a competency has linked ApplicationData records.
    Used by frontend to determine whether to show sync confirmation dialog.
    """
    from app.models.application import ApplicationData, Application
    from sqlalchemy import func, or_

    # Verify competency belongs to current user
    comp_result = await db.execute(
        select(CoachCompetency).where(
            CoachCompetency.competency_id == competency_id,
            CoachCompetency.user_id == current_user.user_id
        )
    )
    competency = comp_result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency not found"
        )

    # Get user's application IDs
    user_apps_result = await db.execute(
        select(Application.application_id).where(
            Application.user_id == current_user.user_id
        )
    )
    user_app_ids = [app_id for (app_id,) in user_apps_result.fetchall()]

    # Count linked ApplicationData - both by competency_id AND by item_id (for old unlinked data)
    count_result = await db.execute(
        select(func.count(ApplicationData.data_id)).where(
            or_(
                ApplicationData.competency_id == competency_id,
                and_(
                    ApplicationData.application_id.in_(user_app_ids) if user_app_ids else False,
                    ApplicationData.item_id == competency.item_id,
                    ApplicationData.competency_id.is_(None)
                )
            )
        )
    )
    linked_count = count_result.scalar() or 0

    return {
        "competency_id": competency_id,
        "has_linked_applications": linked_count > 0,
        "linked_count": linked_count
    }


@router.delete("/{competency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competency(
    competency_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a competency"""
    # Find competency
    result = await db.execute(
        select(CoachCompetency).where(
            CoachCompetency.competency_id == competency_id,
            CoachCompetency.user_id == current_user.user_id
        )
    )
    competency = result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency not found"
        )

    await db.delete(competency)
    await db.commit()

    return None


# ============================================================================
# Admin Endpoints (SUPER_ADMIN only)
# ============================================================================
def check_super_admin(user: User):
    """Check if user is SUPER_ADMIN"""
    roles = get_user_roles(user)
    if "SUPER_ADMIN" not in roles and "admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SUPER_ADMIN can access this endpoint"
        )


def check_custom_question_permission(user: User):
    """Check if user can create/manage custom questions (SUPER_ADMIN or PROJECT_MANAGER)"""
    roles = get_user_roles(user)
    allowed_roles = ["SUPER_ADMIN", "PROJECT_MANAGER", "admin"]
    if not any(role in roles for role in allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SUPER_ADMIN or PROJECT_MANAGER can manage custom questions"
        )


def is_super_admin(user: User) -> bool:
    """Check if user is SUPER_ADMIN (returns bool, doesn't raise)"""
    roles = get_user_roles(user)
    return "SUPER_ADMIN" in roles or "admin" in roles


@router.post("/items", response_model=CompetencyItemResponse, status_code=status.HTTP_201_CREATED)
async def create_competency_item(
    item_data: CompetencyItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new competency item (SUPER_ADMIN for master items, SUPER_ADMIN/PROJECT_MANAGER for custom questions)"""
    # Check permissions based on is_custom flag
    if item_data.is_custom:
        check_custom_question_permission(current_user)
    else:
        check_super_admin(current_user)

    # Auto-generate item_code for custom questions
    if item_data.is_custom and not item_data.item_code:
        item_code = f"CUSTOM_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"
    else:
        item_code = item_data.item_code

    # Check if item_code already exists
    if item_code:
        result = await db.execute(
            select(CompetencyItem).where(CompetencyItem.item_code == item_code)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item code '{item_code}' already exists"
            )

    # Create item
    new_item = CompetencyItem(
        item_code=item_code,
        item_name=item_data.item_name,
        category=item_data.category,
        input_type=item_data.input_type,
        template=item_data.template,
        template_config=item_data.template_config,
        is_repeatable=item_data.is_repeatable,
        max_entries=item_data.max_entries,
        is_active=item_data.is_active,
        description=item_data.description,
        is_custom=item_data.is_custom,
        created_by=current_user.user_id if item_data.is_custom else None
    )
    db.add(new_item)
    await db.flush()

    # Create fields
    for field_data in item_data.fields:
        field = CompetencyItemField(
            item_id=new_item.item_id,
            field_name=field_data.field_name,
            field_label=field_data.field_label,
            field_type=field_data.field_type,
            field_options=field_data.field_options,
            is_required=field_data.is_required,
            display_order=field_data.display_order,
            placeholder=field_data.placeholder
        )
        db.add(field)

    await db.commit()

    # Reload with fields
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == new_item.item_id)
        .options(selectinload(CompetencyItem.fields))
    )
    return result.scalar_one()


@router.put("/items/{item_id}", response_model=CompetencyItemResponse)
async def update_competency_item(
    item_id: int,
    item_data: CompetencyItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a competency item

    Permission rules:
    - SUPER_ADMIN can update any item (master or custom)
    - PROJECT_MANAGER can only update their own custom questions
    """
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == item_id)
        .options(selectinload(CompetencyItem.fields))
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency item not found"
        )

    # Check permissions
    if item.is_custom:
        # Custom questions: SUPER_ADMIN can update any, PROJECT_MANAGER only their own
        if is_super_admin(current_user):
            pass  # SUPER_ADMIN can update
        elif item.created_by == current_user.user_id:
            check_custom_question_permission(current_user)  # Verify they have PM role
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update custom questions you created"
            )
    else:
        # Master items: SUPER_ADMIN only
        check_super_admin(current_user)

    # Update fields
    if item_data.item_name is not None:
        item.item_name = item_data.item_name
    if item_data.category is not None:
        item.category = item_data.category
    if item_data.template is not None:
        item.template = item_data.template
    if item_data.template_config is not None:
        item.template_config = item_data.template_config
    if item_data.is_repeatable is not None:
        item.is_repeatable = item_data.is_repeatable
    if item_data.max_entries is not None:
        item.max_entries = item_data.max_entries
    if item_data.is_active is not None:
        item.is_active = item_data.is_active
    if item_data.description is not None:
        item.description = item_data.description

    await db.commit()
    await db.refresh(item)

    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competency_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete a competency item - sets is_active=False

    Permission rules:
    - SUPER_ADMIN can delete any item (master or custom)
    - PROJECT_MANAGER can only delete their own custom questions
    """
    result = await db.execute(
        select(CompetencyItem).where(CompetencyItem.item_id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency item not found"
        )

    # Check permissions
    if item.is_custom:
        # Custom questions: SUPER_ADMIN can delete any, PROJECT_MANAGER only their own
        if is_super_admin(current_user):
            pass  # SUPER_ADMIN can delete
        elif item.created_by == current_user.user_id:
            check_custom_question_permission(current_user)  # Verify they have PM role
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete custom questions you created"
            )
    else:
        # Master items: SUPER_ADMIN only
        check_super_admin(current_user)

    # Soft delete - just set is_active to False
    item.is_active = False
    await db.commit()

    return None


@router.post("/items/{item_id}/fields", response_model=CompetencyItemFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_competency_item_field(
    item_id: int,
    field_data: CompetencyItemFieldCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a field for a competency item (Admin only)"""
    check_super_admin(current_user)

    # Verify item exists
    result = await db.execute(
        select(CompetencyItem).where(CompetencyItem.item_id == item_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency item not found"
        )

    # Create field
    new_field = CompetencyItemField(
        item_id=item_id,
        field_name=field_data.field_name,
        field_label=field_data.field_label,
        field_type=field_data.field_type,
        field_options=field_data.field_options,
        is_required=field_data.is_required,
        display_order=field_data.display_order,
        placeholder=field_data.placeholder
    )
    db.add(new_field)
    await db.commit()
    await db.refresh(new_field)

    return new_field


@router.put("/items/{item_id}/fields/{field_id}", response_model=CompetencyItemFieldResponse)
async def update_competency_item_field(
    item_id: int,
    field_id: int,
    field_data: CompetencyItemFieldUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a field of a competency item (Admin only)"""
    check_super_admin(current_user)

    result = await db.execute(
        select(CompetencyItemField).where(
            CompetencyItemField.field_id == field_id,
            CompetencyItemField.item_id == item_id
        )
    )
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found"
        )

    # Update fields
    if field_data.field_name is not None:
        field.field_name = field_data.field_name
    if field_data.field_label is not None:
        field.field_label = field_data.field_label
    if field_data.field_type is not None:
        field.field_type = field_data.field_type
    if field_data.field_options is not None:
        field.field_options = field_data.field_options
    if field_data.is_required is not None:
        field.is_required = field_data.is_required
    if field_data.display_order is not None:
        field.display_order = field_data.display_order
    if field_data.placeholder is not None:
        field.placeholder = field_data.placeholder

    await db.commit()
    await db.refresh(field)

    return field


@router.delete("/items/{item_id}/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competency_item_field(
    item_id: int,
    field_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a field from a competency item (Admin only)"""
    check_super_admin(current_user)

    result = await db.execute(
        select(CompetencyItemField).where(
            CompetencyItemField.field_id == field_id,
            CompetencyItemField.item_id == item_id
        )
    )
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found"
        )

    await db.delete(field)
    await db.commit()

    return None


@router.get("/items/all", response_model=List[CompetencyItemResponse])
async def get_all_competency_items(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all competency items including inactive (Admin only)"""
    check_super_admin(current_user)

    from sqlalchemy.orm import selectinload
    query = select(CompetencyItem).options(selectinload(CompetencyItem.fields))

    if not include_inactive:
        query = query.where(CompetencyItem.is_active == True)

    result = await db.execute(query)
    items = result.scalars().all()
    return items

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
    from app.schemas.competency import UnifiedTemplateBasicInfo

    result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.is_active == True)
        .options(
            selectinload(CompetencyItem.fields),
            selectinload(CompetencyItem.unified_template)
        )
    )
    items = result.scalars().all()

    # Build response with unified_template info
    response_items = []
    for item in items:
        item_dict = {
            "item_id": item.item_id,
            "item_name": item.item_name or "",
            "item_code": item.item_code or "",
            "category": item.category.value if item.category else "ADDON",
            "input_type": item.input_type.value if item.input_type else "text",
            "is_active": item.is_active if item.is_active is not None else True,
            "template": item.template,
            "template_config": item.template_config,
            "is_repeatable": item.is_repeatable if item.is_repeatable is not None else False,
            "max_entries": item.max_entries,
            "description": item.description,
            "is_custom": item.is_custom if item.is_custom is not None else False,
            "created_by": item.created_by,
            "input_template_id": item.input_template_id,
            "scoring_template_id": item.scoring_template_id,
            "scoring_config_override": item.scoring_config_override,
            "unified_template_id": item.unified_template_id,
            "evaluation_method_override": item.evaluation_method_override,
            # 역량항목 독립 필드
            "grade_mappings": item.grade_mappings,
            "proof_required": item.proof_required,
            "help_text": item.help_text,
            "placeholder": item.placeholder,
            "verification_note": item.verification_note,
            "auto_confirm_across_projects": item.auto_confirm_across_projects,
            "field_label_overrides": item.field_label_overrides,
            # Phase 4: 평가 설정 (역량항목 완전 독립화)
            "grade_type": item.grade_type,
            "matching_type": item.matching_type,
            "grade_edit_mode": item.grade_edit_mode or "flexible",
            "evaluation_method": item.evaluation_method or "standard",
            "data_source": item.data_source or "form_input",
            "has_scoring": item.grade_type is not None and item.matching_type is not None,
            "fields": [
                {
                    "field_id": f.field_id,
                    "field_name": f.field_name or "",
                    "field_label": f.field_label or "",
                    "field_type": f.field_type or "text",
                    "field_options": f.field_options,
                    "is_required": f.is_required if f.is_required is not None else True,
                    "display_order": f.display_order if f.display_order is not None else 0,
                    "placeholder": f.placeholder
                } for f in (item.fields or [])
            ],
            "unified_template": None
        }

        # Add unified_template info if exists (kept for preset reference)
        if item.unified_template:
            ut = item.unified_template
            item_dict["unified_template"] = {
                "template_id": ut.template_id,
                "template_name": ut.template_name,
                "description": ut.description,
                "data_source": ut.data_source,
                "evaluation_method": ut.evaluation_method,
                "grade_type": ut.grade_type,
                "matching_type": ut.matching_type,
                "has_scoring": ut.has_scoring(),
                "is_certification": ut.is_certification_template()
            }

        response_items.append(item_dict)

    return response_items


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

        # 하이브리드 구조: sync_to_applications 로직 제거
        # - 마감 전: 프론트엔드에서 linked_competency_value로 실시간 표시
        # - 마감 시: freeze-applications API에서 스냅샷 저장
        # sync_to_applications 파라미터는 backward compatibility를 위해 유지하되 무시함

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

    # 템플릿에서 기본값 복사 (unified_template_id가 있는 경우)
    template_defaults = {}
    if item_data.unified_template_id:
        from app.models.unified_template import UnifiedTemplate
        template_result = await db.execute(
            select(UnifiedTemplate).where(UnifiedTemplate.template_id == item_data.unified_template_id)
        )
        template = template_result.scalar_one_or_none()
        if template:
            template_defaults = {
                'grade_mappings': template.default_mappings,
                'proof_required': template.proof_required,
                'help_text': template.help_text,
                'placeholder': template.placeholder,
                'verification_note': template.verification_note,
                'auto_confirm_across_projects': template.auto_confirm_across_projects,
                # Phase 4: 평가 설정도 복사
                'grade_type': template.grade_type,
                'matching_type': template.matching_type,
                'grade_edit_mode': template.grade_edit_mode,
                'evaluation_method': template.evaluation_method,
                'data_source': template.data_source,
            }

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
        created_by=current_user.user_id if item_data.is_custom else None,
        # Legacy template fields
        input_template_id=item_data.input_template_id,
        scoring_template_id=item_data.scoring_template_id,
        scoring_config_override=item_data.scoring_config_override,
        # 2-tier unified template
        unified_template_id=item_data.unified_template_id,
        evaluation_method_override=item_data.evaluation_method_override,
        # 템플릿에서 복사 (명시적 값이 없으면 템플릿 기본값 사용)
        grade_mappings=item_data.grade_mappings or template_defaults.get('grade_mappings', '[]'),
        proof_required=item_data.proof_required or template_defaults.get('proof_required', 'optional'),
        help_text=item_data.help_text or template_defaults.get('help_text'),
        placeholder=item_data.placeholder or template_defaults.get('placeholder'),
        verification_note=item_data.verification_note or template_defaults.get('verification_note'),
        auto_confirm_across_projects=item_data.auto_confirm_across_projects if item_data.auto_confirm_across_projects is not None else template_defaults.get('auto_confirm_across_projects', False),
        field_label_overrides=item_data.field_label_overrides or '{}',
        # Phase 4: 평가 설정 (역량항목 완전 독립화)
        grade_type=item_data.grade_type or template_defaults.get('grade_type'),
        matching_type=item_data.matching_type or template_defaults.get('matching_type'),
        grade_edit_mode=item_data.grade_edit_mode or template_defaults.get('grade_edit_mode', 'flexible'),
        evaluation_method=item_data.evaluation_method or item_data.evaluation_method_override or template_defaults.get('evaluation_method', 'standard'),
        data_source=item_data.data_source or template_defaults.get('data_source', 'form_input'),
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

    # Reload with fields and unified_template
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == new_item.item_id)
        .options(
            selectinload(CompetencyItem.fields),
            selectinload(CompetencyItem.unified_template)
        )
    )
    created_item = result.scalar_one()

    # Build response dict (same pattern as GET/PUT)
    response = {
        "item_id": created_item.item_id,
        "item_name": created_item.item_name or "",
        "item_code": created_item.item_code or "",
        "category": created_item.category.value if created_item.category else "ADDON",
        "input_type": created_item.input_type.value if created_item.input_type else "text",
        "is_active": created_item.is_active if created_item.is_active is not None else True,
        "template": created_item.template,
        "template_config": created_item.template_config,
        "is_repeatable": created_item.is_repeatable if created_item.is_repeatable is not None else False,
        "max_entries": created_item.max_entries,
        "description": created_item.description,
        "is_custom": created_item.is_custom if created_item.is_custom is not None else False,
        "created_by": created_item.created_by,
        "input_template_id": created_item.input_template_id,
        "scoring_template_id": created_item.scoring_template_id,
        "scoring_config_override": created_item.scoring_config_override,
        "unified_template_id": created_item.unified_template_id,
        "evaluation_method_override": created_item.evaluation_method_override,
        # 역량항목 독립 필드
        "grade_mappings": created_item.grade_mappings,
        "proof_required": created_item.proof_required,
        "help_text": created_item.help_text,
        "placeholder": created_item.placeholder,
        "verification_note": created_item.verification_note,
        "auto_confirm_across_projects": created_item.auto_confirm_across_projects,
        "field_label_overrides": created_item.field_label_overrides,
        # Phase 4: 평가 설정 (역량항목 완전 독립화)
        "grade_type": created_item.grade_type,
        "matching_type": created_item.matching_type,
        "grade_edit_mode": created_item.grade_edit_mode or "flexible",
        "evaluation_method": created_item.evaluation_method or "standard",
        "data_source": created_item.data_source or "form_input",
        "has_scoring": created_item.grade_type is not None and created_item.matching_type is not None,
        "fields": [
            {
                "field_id": f.field_id,
                "field_name": f.field_name or "",
                "field_label": f.field_label or "",
                "field_type": f.field_type or "text",
                "field_options": f.field_options,
                "is_required": f.is_required if f.is_required is not None else True,
                "display_order": f.display_order if f.display_order is not None else 0,
                "placeholder": f.placeholder
            } for f in (created_item.fields or [])
        ],
        "unified_template": None
    }

    if created_item.unified_template:
        ut = created_item.unified_template
        response["unified_template"] = {
            "template_id": ut.template_id,
            "template_name": ut.template_name,
            "description": ut.description,
            "data_source": ut.data_source,
            "evaluation_method": ut.evaluation_method,
            "grade_type": ut.grade_type,
            "matching_type": ut.matching_type,
            "has_scoring": ut.has_scoring(),
            "is_certification": ut.is_certification_template()
        }

    return response


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
    # Legacy template fields
    if item_data.input_template_id is not None:
        item.input_template_id = item_data.input_template_id
    if item_data.scoring_template_id is not None:
        item.scoring_template_id = item_data.scoring_template_id
    if item_data.scoring_config_override is not None:
        item.scoring_config_override = item_data.scoring_config_override
    # 2-tier unified template
    if item_data.unified_template_id is not None:
        item.unified_template_id = item_data.unified_template_id
    if item_data.evaluation_method_override is not None:
        item.evaluation_method_override = item_data.evaluation_method_override
    # 템플릿에서 복사 후 독립 관리 필드들
    if item_data.grade_mappings is not None:
        item.grade_mappings = item_data.grade_mappings
    if item_data.proof_required is not None:
        item.proof_required = item_data.proof_required
    if item_data.help_text is not None:
        item.help_text = item_data.help_text
    if item_data.placeholder is not None:
        item.placeholder = item_data.placeholder
    if item_data.verification_note is not None:
        item.verification_note = item_data.verification_note
    if item_data.auto_confirm_across_projects is not None:
        item.auto_confirm_across_projects = item_data.auto_confirm_across_projects
    if item_data.field_label_overrides is not None:
        item.field_label_overrides = item_data.field_label_overrides
    # Phase 4: 평가 설정 (역량항목 완전 독립화)
    if item_data.grade_type is not None:
        item.grade_type = item_data.grade_type
    if item_data.matching_type is not None:
        item.matching_type = item_data.matching_type
    if item_data.grade_edit_mode is not None:
        item.grade_edit_mode = item_data.grade_edit_mode
    if item_data.evaluation_method is not None:
        item.evaluation_method = item_data.evaluation_method
    if item_data.data_source is not None:
        item.data_source = item_data.data_source

    await db.commit()
    await db.refresh(item)

    # Reload with unified_template
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == item.item_id)
        .options(
            selectinload(CompetencyItem.fields),
            selectinload(CompetencyItem.unified_template)
        )
    )
    updated_item = result.scalar_one()

    # Build response with unified_template info
    response = {
        "item_id": updated_item.item_id,
        "item_name": updated_item.item_name or "",
        "item_code": updated_item.item_code or "",
        "category": updated_item.category.value if updated_item.category else "ADDON",
        "input_type": updated_item.input_type.value if updated_item.input_type else "text",
        "is_active": updated_item.is_active if updated_item.is_active is not None else True,
        "template": updated_item.template,
        "template_config": updated_item.template_config,
        "is_repeatable": updated_item.is_repeatable if updated_item.is_repeatable is not None else False,
        "max_entries": updated_item.max_entries,
        "description": updated_item.description,
        "is_custom": updated_item.is_custom if updated_item.is_custom is not None else False,
        "created_by": updated_item.created_by,
        "input_template_id": updated_item.input_template_id,
        "scoring_template_id": updated_item.scoring_template_id,
        "scoring_config_override": updated_item.scoring_config_override,
        "unified_template_id": updated_item.unified_template_id,
        "evaluation_method_override": updated_item.evaluation_method_override,
        "fields": [
            {
                "field_id": f.field_id,
                "field_name": f.field_name or "",
                "field_label": f.field_label or "",
                "field_type": f.field_type or "text",
                "field_options": f.field_options,
                "is_required": f.is_required if f.is_required is not None else True,
                "display_order": f.display_order if f.display_order is not None else 0,
                "placeholder": f.placeholder
            } for f in (updated_item.fields or [])
        ],
        "unified_template": None
    }

    if updated_item.unified_template:
        ut = updated_item.unified_template
        response["unified_template"] = {
            "template_id": ut.template_id,
            "template_name": ut.template_name,
            "description": ut.description,
            "data_source": ut.data_source,
            "evaluation_method": ut.evaluation_method,
            "grade_type": ut.grade_type,
            "matching_type": ut.matching_type,
            "has_scoring": ut.has_scoring(),
            "is_certification": ut.is_certification_template()
        }

    return response


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
    query = select(CompetencyItem).options(
        selectinload(CompetencyItem.fields),
        selectinload(CompetencyItem.unified_template)
    )

    if not include_inactive:
        query = query.where(CompetencyItem.is_active == True)

    result = await db.execute(query)
    items = result.scalars().all()

    # Build response with unified_template info
    response_items = []
    for item in items:
        item_dict = {
            "item_id": item.item_id,
            "item_name": item.item_name or "",
            "item_code": item.item_code or "",
            "category": item.category.value if item.category else "ADDON",
            "input_type": item.input_type.value if item.input_type else "text",
            "is_active": item.is_active if item.is_active is not None else True,
            "template": item.template,
            "template_config": item.template_config,
            "is_repeatable": item.is_repeatable if item.is_repeatable is not None else False,
            "max_entries": item.max_entries,
            "description": item.description,
            "is_custom": item.is_custom if item.is_custom is not None else False,
            "created_by": item.created_by,
            "input_template_id": item.input_template_id,
            "scoring_template_id": item.scoring_template_id,
            "scoring_config_override": item.scoring_config_override,
            "unified_template_id": item.unified_template_id,
            "evaluation_method_override": item.evaluation_method_override,
            # 역량항목 독립 필드
            "grade_mappings": item.grade_mappings,
            "proof_required": item.proof_required,
            "help_text": item.help_text,
            "placeholder": item.placeholder,
            "verification_note": item.verification_note,
            "auto_confirm_across_projects": item.auto_confirm_across_projects,
            "field_label_overrides": item.field_label_overrides,
            # Phase 4: 평가 설정 (역량항목 완전 독립화)
            "grade_type": item.grade_type,
            "matching_type": item.matching_type,
            "grade_edit_mode": item.grade_edit_mode or "flexible",
            "evaluation_method": item.evaluation_method or "standard",
            "data_source": item.data_source or "form_input",
            "has_scoring": item.grade_type is not None and item.matching_type is not None,
            "fields": [
                {
                    "field_id": f.field_id,
                    "field_name": f.field_name or "",
                    "field_label": f.field_label or "",
                    "field_type": f.field_type or "text",
                    "field_options": f.field_options,
                    "is_required": f.is_required if f.is_required is not None else True,
                    "display_order": f.display_order if f.display_order is not None else 0,
                    "placeholder": f.placeholder
                } for f in (item.fields or [])
            ],
            "unified_template": None
        }

        # Add unified_template info if exists (kept for preset reference)
        if item.unified_template:
            ut = item.unified_template
            item_dict["unified_template"] = {
                "template_id": ut.template_id,
                "template_name": ut.template_name,
                "description": ut.description,
                "data_source": ut.data_source,
                "evaluation_method": ut.evaluation_method,
                "grade_type": ut.grade_type,
                "matching_type": ut.matching_type,
                "has_scoring": ut.has_scoring(),
                "is_certification": ut.is_certification_template()
            }

        response_items.append(item_dict)

    return response_items

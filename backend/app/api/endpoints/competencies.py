from fastapi import APIRouter, Depends, HTTPException, status
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
                        field_name=field.field_name,
                        field_label=field.field_label,
                        field_type=field.field_type,
                        field_options=field.field_options,
                        is_required=field.is_required,
                        display_order=field.display_order,
                        placeholder=field.placeholder
                    ))

            competency_item_response = CompetencyItemResponse(
                item_id=item.item_id,
                item_name=item.item_name,
                item_code=item.item_code,
                category=item.category.value if item.category else None,
                input_type=item.input_type.value if item.input_type else None,
                is_active=item.is_active,
                template=item.template,
                template_config=item.template_config,
                is_repeatable=item.is_repeatable,
                max_entries=item.max_entries,
                description=item.description,
                is_custom=item.is_custom,
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

        # Build main response
        response = CoachCompetencyResponse(
            competency_id=competency.competency_id,
            user_id=competency.user_id,
            item_id=competency.item_id,
            value=competency.value,
            file_id=competency.file_id,
            verification_status=competency.verification_status,
            verified_by=competency.verified_by,
            verified_at=competency.verified_at,
            rejection_reason=competency.rejection_reason,
            is_anonymized=competency.is_anonymized,
            created_at=competency.created_at,
            updated_at=competency.updated_at,
            is_globally_verified=competency.is_globally_verified,
            globally_verified_at=competency.globally_verified_at,
            competency_item=competency_item_response,
            file_info=file_info_response
        )

        response_list.append(response)

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

    # Fetch competency item
    new_competency.competency_item = item

    # Fetch file info if file_id exists
    if new_competency.file_id:
        file_result = await db.execute(
            select(File).where(File.file_id == new_competency.file_id)
        )
        file_obj = file_result.scalar_one_or_none()
        if file_obj:
            new_competency.file_info = FileBasicInfo(
                file_id=file_obj.file_id,
                original_filename=file_obj.original_filename,
                file_size=file_obj.file_size,
                mime_type=file_obj.mime_type,
                uploaded_at=file_obj.uploaded_at
            )

    return new_competency


@router.put("/{competency_id}", response_model=CoachCompetencyResponse)
async def update_competency(
    competency_id: int,
    competency_data: CompetencyUpdate,
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

    await db.commit()
    await db.refresh(competency)

    # Fetch competency item
    item_result = await db.execute(
        select(CompetencyItem).where(CompetencyItem.item_id == competency.item_id)
    )
    competency.competency_item = item_result.scalar_one_or_none()

    # Fetch file info if file_id exists
    if competency.file_id:
        file_result = await db.execute(
            select(File).where(File.file_id == competency.file_id)
        )
        file_obj = file_result.scalar_one_or_none()
        if file_obj:
            competency.file_info = FileBasicInfo(
                file_id=file_obj.file_id,
                original_filename=file_obj.original_filename,
                file_size=file_obj.file_size,
                mime_type=file_obj.mime_type,
                uploaded_at=file_obj.uploaded_at
            )

    return competency


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

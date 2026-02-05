"""
입력 템플릿 (InputTemplate) API 엔드포인트
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.input_template import InputTemplate
from app.schemas.input_template import (
    InputTemplateCreate,
    InputTemplateUpdate,
    InputTemplateResponse,
    InputTemplateListResponse
)

router = APIRouter(prefix="/input-templates", tags=["input-templates"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require SUPER_ADMIN or ADMIN role"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )
    return current_user


@router.get("", response_model=InputTemplateListResponse)
async def list_input_templates(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """입력 템플릿 목록 조회"""
    query = select(InputTemplate)
    if active_only:
        query = query.where(InputTemplate.is_active == True)
    query = query.order_by(InputTemplate.template_id)

    result = await db.execute(query)
    templates = result.scalars().all()

    return InputTemplateListResponse(
        templates=[InputTemplateResponse.model_validate(t) for t in templates],
        total=len(templates)
    )


@router.get("/{template_id}", response_model=InputTemplateResponse)
async def get_input_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 입력 템플릿 조회"""
    result = await db.execute(
        select(InputTemplate).where(InputTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"입력 템플릿을 찾을 수 없습니다: {template_id}"
        )

    return InputTemplateResponse.model_validate(template)


@router.post("", response_model=InputTemplateResponse)
async def create_input_template(
    data: InputTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """입력 템플릿 생성 (관리자 전용)"""
    # 중복 체크
    existing = await db.execute(
        select(InputTemplate).where(InputTemplate.template_id == data.template_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이미 존재하는 템플릿 ID입니다: {data.template_id}"
        )

    template = InputTemplate(
        template_id=data.template_id,
        template_name=data.template_name,
        description=data.description,
        fields_schema=data.fields_schema,
        layout_type=data.layout_type,
        is_repeatable=data.is_repeatable,
        max_entries=data.max_entries,
        allow_file_upload=data.allow_file_upload,
        file_required=data.file_required,
        allowed_file_types=data.allowed_file_types,
        validation_rules=data.validation_rules,
        help_text=data.help_text,
        placeholder=data.placeholder,
        keywords=data.keywords,
        is_active=data.is_active
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return InputTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=InputTemplateResponse)
async def update_input_template(
    template_id: str,
    data: InputTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """입력 템플릿 수정 (관리자 전용)"""
    result = await db.execute(
        select(InputTemplate).where(InputTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"입력 템플릿을 찾을 수 없습니다: {template_id}"
        )

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return InputTemplateResponse.model_validate(template)


@router.delete("/{template_id}")
async def delete_input_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """입력 템플릿 비활성화 (관리자 전용)"""
    result = await db.execute(
        select(InputTemplate).where(InputTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"입력 템플릿을 찾을 수 없습니다: {template_id}"
        )

    template.is_active = False
    await db.commit()

    return {"message": f"입력 템플릿이 비활성화되었습니다: {template_id}"}

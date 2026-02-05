"""
평가 템플릿 (Scoring Template) API 엔드포인트
- 시스템관리 > 역량항목 설정 > 평가 템플릿 관리 탭에서 사용
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.scoring_template import ScoringTemplate
from app.schemas.scoring_template import (
    ScoringTemplateCreate,
    ScoringTemplateUpdate,
    ScoringTemplateResponse,
    ScoringTemplateListResponse
)

router = APIRouter(prefix="/scoring-templates", tags=["scoring-templates"])


@router.get("", response_model=ScoringTemplateListResponse)
async def get_scoring_templates(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    평가 템플릿 목록 조회

    Returns:
        모든 활성화된 평가 템플릿 목록
    """
    query = select(ScoringTemplate).order_by(ScoringTemplate.template_name)

    if active_only:
        query = query.where(ScoringTemplate.is_active == True)

    result = await db.execute(query)
    templates = result.scalars().all()

    return ScoringTemplateListResponse(
        templates=[ScoringTemplateResponse.model_validate(t) for t in templates],
        total=len(templates)
    )


@router.get("/{template_id}", response_model=ScoringTemplateResponse)
async def get_scoring_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    특정 평가 템플릿 조회

    Args:
        template_id: 템플릿 ID (예: "kca_certification", "degree")

    Returns:
        평가 템플릿 상세 정보
    """
    result = await db.execute(
        select(ScoringTemplate).where(ScoringTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"평가 템플릿 '{template_id}'을(를) 찾을 수 없습니다"
        )

    return ScoringTemplateResponse.model_validate(template)


@router.post("", response_model=ScoringTemplateResponse)
async def create_scoring_template(
    template_data: ScoringTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    평가 템플릿 생성 (SUPER_ADMIN 전용)

    Args:
        template_data: 평가 템플릿 생성 데이터

    Returns:
        생성된 평가 템플릿
    """
    # Check if template_id already exists
    result = await db.execute(
        select(ScoringTemplate).where(ScoringTemplate.template_id == template_data.template_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"템플릿 ID '{template_data.template_id}'이(가) 이미 존재합니다"
        )

    template = ScoringTemplate(
        template_id=template_data.template_id,
        template_name=template_data.template_name,
        description=template_data.description,
        grade_type=template_data.grade_type,
        matching_type=template_data.matching_type,
        value_source=template_data.value_source,
        source_field=template_data.source_field,
        aggregation_mode=template_data.aggregation_mode,
        default_mappings=template_data.default_mappings,
        fixed_grades=template_data.fixed_grades,
        allow_add_grades=template_data.allow_add_grades,
        proof_required=template_data.proof_required,
        verification_note=template_data.verification_note,
        is_required_default=template_data.is_required_default,
        allow_multiple=template_data.allow_multiple,
        auto_confirm_across_projects=template_data.auto_confirm_across_projects,
        keywords=template_data.keywords,
        is_active=template_data.is_active
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return ScoringTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=ScoringTemplateResponse)
async def update_scoring_template(
    template_id: str,
    update_data: ScoringTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    평가 템플릿 수정 (SUPER_ADMIN 전용)

    Args:
        template_id: 템플릿 ID
        update_data: 수정할 데이터 (변경할 필드만 포함)

    Returns:
        수정된 평가 템플릿
    """
    result = await db.execute(
        select(ScoringTemplate).where(ScoringTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"평가 템플릿 '{template_id}'을(를) 찾을 수 없습니다"
        )

    # Update only provided fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return ScoringTemplateResponse.model_validate(template)


@router.delete("/{template_id}")
async def delete_scoring_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    평가 템플릿 삭제 (SUPER_ADMIN 전용)

    실제 삭제가 아닌 비활성화(soft delete) 처리

    Args:
        template_id: 템플릿 ID

    Returns:
        삭제 결과 메시지
    """
    result = await db.execute(
        select(ScoringTemplate).where(ScoringTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"평가 템플릿 '{template_id}'을(를) 찾을 수 없습니다"
        )

    # Soft delete - just deactivate
    template.is_active = False
    await db.commit()

    return {"message": f"평가 템플릿 '{template_id}'이(가) 비활성화되었습니다"}

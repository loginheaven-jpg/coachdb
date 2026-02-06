"""
통합 템플릿 (UnifiedTemplate) API 엔드포인트
- 시스템관리 > 역량항목 설정 > 템플릿 관리 탭에서 사용
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.unified_template import UnifiedTemplate
from app.schemas.unified_template import (
    UnifiedTemplateCreate,
    UnifiedTemplateUpdate,
    UnifiedTemplateResponse,
    UnifiedTemplateListResponse,
    EffectiveScoringConfig
)

router = APIRouter(prefix="/unified-templates", tags=["unified-templates"])


def _to_response(template: UnifiedTemplate) -> UnifiedTemplateResponse:
    """UnifiedTemplate 모델을 응답 스키마로 변환"""
    # 모델을 dict로 변환 후 계산된 필드 추가
    data = {
        "template_id": template.template_id,
        "template_name": template.template_name,
        "description": template.description,
        "data_source": template.data_source,
        "source_field": template.source_field,
        "display_only": template.display_only,
        "fields_schema": template.fields_schema,
        "layout_type": template.layout_type,
        "is_repeatable": template.is_repeatable,
        "max_entries": template.max_entries,
        "validation_rules": template.validation_rules,
        "help_text": template.help_text,
        "placeholder": template.placeholder,
        "evaluation_method": template.evaluation_method,
        "grade_type": template.grade_type,
        "matching_type": template.matching_type,
        "scoring_value_source": template.scoring_value_source,
        "scoring_source_field": template.scoring_source_field,
        "extract_pattern": template.extract_pattern,
        "aggregation_mode": template.aggregation_mode,
        "default_mappings": template.default_mappings,
        "grade_edit_mode": template.grade_edit_mode,
        "proof_required": template.proof_required,
        "verification_note": template.verification_note,
        "is_required_default": template.is_required_default,
        "allow_multiple": template.allow_multiple,
        "auto_confirm_across_projects": template.auto_confirm_across_projects,
        "keywords": template.keywords,
        "is_active": template.is_active,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
        # 계산된 필드
        "has_scoring": template.has_scoring(),
        "is_certification": template.is_certification_template(),
    }
    return UnifiedTemplateResponse(**data)


@router.get("", response_model=UnifiedTemplateListResponse)
async def get_unified_templates(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    통합 템플릿 목록 조회

    Returns:
        모든 활성화된 통합 템플릿 목록
    """
    query = select(UnifiedTemplate).order_by(UnifiedTemplate.template_name)

    if active_only:
        query = query.where(UnifiedTemplate.is_active == True)

    result = await db.execute(query)
    templates = result.scalars().all()

    return UnifiedTemplateListResponse(
        templates=[_to_response(t) for t in templates],
        total=len(templates)
    )


@router.get("/{template_id}", response_model=UnifiedTemplateResponse)
async def get_unified_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    특정 통합 템플릿 조회

    Args:
        template_id: 템플릿 ID

    Returns:
        통합 템플릿 상세 정보
    """
    result = await db.execute(
        select(UnifiedTemplate).where(UnifiedTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"통합 템플릿 '{template_id}'을(를) 찾을 수 없습니다"
        )

    return _to_response(template)


@router.get("/{template_id}/effective-scoring", response_model=EffectiveScoringConfig)
async def get_effective_scoring_config(
    template_id: str,
    evaluation_method: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    실제 적용될 평가 설정 조회

    자격증 템플릿의 경우 evaluation_method를 오버라이드하여
    다른 평가 방법을 적용할 수 있습니다.

    Args:
        template_id: 템플릿 ID
        evaluation_method: 평가 방법 오버라이드 (optional)

    Returns:
        실제 적용될 평가 설정
    """
    result = await db.execute(
        select(UnifiedTemplate).where(UnifiedTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"통합 템플릿 '{template_id}'을(를) 찾을 수 없습니다"
        )

    config = template.get_effective_scoring_config(evaluation_method)
    return EffectiveScoringConfig(**config)


@router.post("", response_model=UnifiedTemplateResponse)
async def create_unified_template(
    template_data: UnifiedTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    통합 템플릿 생성 (SUPER_ADMIN 전용)

    Args:
        template_data: 통합 템플릿 생성 데이터

    Returns:
        생성된 통합 템플릿
    """
    # Check if template_id already exists
    result = await db.execute(
        select(UnifiedTemplate).where(UnifiedTemplate.template_id == template_data.template_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"템플릿 ID '{template_data.template_id}'이(가) 이미 존재합니다"
        )

    template = UnifiedTemplate(
        template_id=template_data.template_id,
        template_name=template_data.template_name,
        description=template_data.description,
        # 입력 설정
        data_source=template_data.data_source,
        source_field=template_data.source_field,
        display_only=template_data.display_only,
        fields_schema=template_data.fields_schema,
        layout_type=template_data.layout_type,
        is_repeatable=template_data.is_repeatable,
        max_entries=template_data.max_entries,
        validation_rules=template_data.validation_rules,
        help_text=template_data.help_text,
        placeholder=template_data.placeholder,
        # 평가 설정
        evaluation_method=template_data.evaluation_method,
        grade_type=template_data.grade_type,
        matching_type=template_data.matching_type,
        scoring_value_source=template_data.scoring_value_source,
        scoring_source_field=template_data.scoring_source_field,
        extract_pattern=template_data.extract_pattern,
        aggregation_mode=template_data.aggregation_mode,
        default_mappings=template_data.default_mappings,
        grade_edit_mode=template_data.grade_edit_mode,
        proof_required=template_data.proof_required,
        verification_note=template_data.verification_note,
        is_required_default=template_data.is_required_default,
        allow_multiple=template_data.allow_multiple,
        auto_confirm_across_projects=template_data.auto_confirm_across_projects,
        # 공통
        keywords=template_data.keywords,
        is_active=template_data.is_active
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return _to_response(template)


@router.put("/{template_id}", response_model=UnifiedTemplateResponse)
async def update_unified_template(
    template_id: str,
    update_data: UnifiedTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    통합 템플릿 수정 (SUPER_ADMIN 전용)

    Args:
        template_id: 템플릿 ID
        update_data: 수정할 데이터 (변경할 필드만 포함)

    Returns:
        수정된 통합 템플릿
    """
    result = await db.execute(
        select(UnifiedTemplate).where(UnifiedTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"통합 템플릿 '{template_id}'을(를) 찾을 수 없습니다"
        )

    # Update only provided fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return _to_response(template)


@router.delete("/{template_id}")
async def delete_unified_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    통합 템플릿 삭제 (SUPER_ADMIN 전용)

    실제 삭제가 아닌 비활성화(soft delete) 처리

    Args:
        template_id: 템플릿 ID

    Returns:
        삭제 결과 메시지
    """
    result = await db.execute(
        select(UnifiedTemplate).where(UnifiedTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"통합 템플릿 '{template_id}'을(를) 찾을 수 없습니다"
        )

    # Soft delete - just deactivate
    template.is_active = False
    await db.commit()

    return {"message": f"통합 템플릿 '{template_id}'이(가) 비활성화되었습니다"}

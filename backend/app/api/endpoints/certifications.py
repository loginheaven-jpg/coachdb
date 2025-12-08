"""
Certification API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.certification import Certification
from app.schemas.certification import (
    CertificationCreate,
    CertificationUpdate,
    CertificationResponse,
    CertificationListItem
)

router = APIRouter(prefix="/certifications", tags=["certifications"])


@router.post("", response_model=CertificationResponse, status_code=status.HTTP_201_CREATED)
async def create_certification(
    certification_data: CertificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """자격증 생성"""
    certification = Certification(
        user_id=current_user.user_id,
        **certification_data.model_dump()
    )

    db.add(certification)
    await db.commit()
    await db.refresh(certification)

    return certification


@router.get("/me", response_model=List[CertificationListItem])
async def get_my_certifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """내 자격증 목록 조회"""
    result = await db.execute(
        select(Certification)
        .where(Certification.user_id == current_user.user_id)
        .order_by(Certification.created_at.desc())
    )
    certifications = result.scalars().all()

    return [
        CertificationListItem(
            **cert.__dict__,
            has_file=cert.certificate_file_id is not None
        )
        for cert in certifications
    ]


@router.get("/{certification_id}", response_model=CertificationResponse)
async def get_certification(
    certification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """자격증 상세 조회"""
    result = await db.execute(
        select(Certification)
        .options(selectinload(Certification.certificate_file))
        .where(Certification.certification_id == certification_id)
    )
    certification = result.scalar_one_or_none()

    if not certification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자격증을 찾을 수 없습니다."
        )

    # 권한 확인: 본인의 자격증만 조회 가능
    if certification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )

    return certification


@router.put("/{certification_id}", response_model=CertificationResponse)
async def update_certification(
    certification_id: int,
    certification_data: CertificationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """자격증 수정"""
    result = await db.execute(
        select(Certification)
        .where(Certification.certification_id == certification_id)
    )
    certification = result.scalar_one_or_none()

    if not certification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자격증을 찾을 수 없습니다."
        )

    # 권한 확인: 본인의 자격증만 수정 가능
    if certification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )

    # 승인된 자격증은 수정 불가
    if certification.verification_status == "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="승인된 자격증은 수정할 수 없습니다."
        )

    # Update fields
    update_data = certification_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(certification, field, value)

    await db.commit()
    await db.refresh(certification)

    return certification


@router.delete("/{certification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certification(
    certification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """자격증 삭제"""
    result = await db.execute(
        select(Certification)
        .where(Certification.certification_id == certification_id)
    )
    certification = result.scalar_one_or_none()

    if not certification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자격증을 찾을 수 없습니다."
        )

    # 권한 확인: 본인의 자격증만 삭제 가능
    if certification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )

    await db.delete(certification)
    await db.commit()

    return None

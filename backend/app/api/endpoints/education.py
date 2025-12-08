from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.education import CoachEducationHistory
from app.models.file import File
from app.schemas.education import (
    CoachEducationHistoryCreate,
    CoachEducationHistoryUpdate,
    CoachEducationHistoryResponse
)

router = APIRouter(prefix="/education-history", tags=["education-history"])


@router.get("/my", response_model=List[CoachEducationHistoryResponse])
async def get_my_education_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's education history"""
    result = await db.execute(
        select(CoachEducationHistory)
        .where(CoachEducationHistory.user_id == current_user.user_id)
        .order_by(CoachEducationHistory.completion_date.desc().nullslast(),
                  CoachEducationHistory.created_at.desc())
    )
    education_history = result.scalars().all()
    return education_history


@router.post("/", response_model=CoachEducationHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_education_history(
    education_data: CoachEducationHistoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new education history entry for current user"""
    # Verify file exists if file_id is provided
    if education_data.certificate_file_id:
        file_result = await db.execute(
            select(File).where(
                File.file_id == education_data.certificate_file_id,
                File.uploaded_by == current_user.user_id
            )
        )
        file = file_result.scalar_one_or_none()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Certificate file not found or does not belong to you"
            )

    # Create education history entry
    new_education = CoachEducationHistory(
        user_id=current_user.user_id,
        education_name=education_data.education_name,
        institution=education_data.institution,
        completion_date=education_data.completion_date,
        hours=education_data.hours,
        certificate_file_id=education_data.certificate_file_id
    )

    db.add(new_education)
    await db.commit()
    await db.refresh(new_education)

    return new_education


@router.put("/{education_id}", response_model=CoachEducationHistoryResponse)
async def update_education_history(
    education_id: int,
    education_data: CoachEducationHistoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing education history entry"""
    # Find education history
    result = await db.execute(
        select(CoachEducationHistory).where(
            CoachEducationHistory.education_id == education_id,
            CoachEducationHistory.user_id == current_user.user_id
        )
    )
    education = result.scalar_one_or_none()

    if not education:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education history not found"
        )

    # Verify file exists if file_id is provided
    if education_data.certificate_file_id is not None:
        file_result = await db.execute(
            select(File).where(
                File.file_id == education_data.certificate_file_id,
                File.uploaded_by == current_user.user_id
            )
        )
        file = file_result.scalar_one_or_none()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Certificate file not found or does not belong to you"
            )

    # Update fields
    if education_data.education_name is not None:
        education.education_name = education_data.education_name
    if education_data.institution is not None:
        education.institution = education_data.institution
    if education_data.completion_date is not None:
        education.completion_date = education_data.completion_date
    if education_data.hours is not None:
        education.hours = education_data.hours
    if education_data.certificate_file_id is not None:
        education.certificate_file_id = education_data.certificate_file_id

    await db.commit()
    await db.refresh(education)

    return education


@router.delete("/{education_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_education_history(
    education_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an education history entry"""
    # Find education history
    result = await db.execute(
        select(CoachEducationHistory).where(
            CoachEducationHistory.education_id == education_id,
            CoachEducationHistory.user_id == current_user.user_id
        )
    )
    education = result.scalar_one_or_none()

    if not education:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education history not found"
        )

    await db.delete(education)
    await db.commit()

    return None

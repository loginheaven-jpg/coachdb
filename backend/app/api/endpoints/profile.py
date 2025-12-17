from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List, Any
import json

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.coach_profile import CoachProfile


router = APIRouter(prefix="/profile", tags=["profile"])


# Pydantic schemas
class DegreeItem(BaseModel):
    type: str  # "coaching" or "other"
    degreeLevel: Optional[str] = None  # "bachelor", "master", "doctorate", "none"
    degreeName: Optional[str] = None
    file_id: Optional[int] = None


class CertificationItem(BaseModel):
    name: str
    type: str  # "KCA" or "COUNSELING"
    file_id: Optional[int] = None


class MentoringExperienceItem(BaseModel):
    description: str
    file_id: Optional[int] = None


class FieldExperience(BaseModel):
    coaching_history: Optional[str] = None
    certifications: Optional[str] = None
    historyFiles: Optional[List[int]] = None
    certFiles: Optional[List[int]] = None


class DetailedProfileRequest(BaseModel):
    total_coaching_hours: Optional[int] = None
    coaching_years: Optional[int] = None
    specialty: Optional[str] = None
    degrees: Optional[List[DegreeItem]] = None
    certifications: Optional[List[CertificationItem]] = None
    mentoring_experiences: Optional[List[MentoringExperienceItem]] = None
    field_experiences: Optional[dict] = None  # {field_name: FieldExperience}


class DetailedProfileResponse(BaseModel):
    profile_id: Optional[int] = None
    user_id: int
    total_coaching_hours: Optional[int] = None
    coaching_years: Optional[int] = None
    specialty: Optional[str] = None
    degrees: Optional[List[Any]] = None
    certifications: Optional[List[Any]] = None
    mentoring_experiences: Optional[List[Any]] = None
    field_experiences: Optional[dict] = None

    class Config:
        from_attributes = True


@router.get("/detailed", response_model=DetailedProfileResponse)
async def get_detailed_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's detailed profile (CoachProfile).
    Returns empty profile if not yet created.
    """
    # Find existing coach profile
    result = await db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Return empty profile structure
        return DetailedProfileResponse(
            user_id=current_user.user_id,
            total_coaching_hours=None,
            coaching_years=None,
            specialty=None,
            degrees=[],
            certifications=[],
            mentoring_experiences=[],
            field_experiences={}
        )

    # Parse JSON fields
    degrees = json.loads(profile.degrees) if profile.degrees else []
    certifications = json.loads(profile.certifications) if profile.certifications else []
    mentoring_experiences = json.loads(profile.mentoring_experiences) if profile.mentoring_experiences else []
    field_experiences = json.loads(profile.field_experiences) if profile.field_experiences else {}

    return DetailedProfileResponse(
        profile_id=profile.profile_id,
        user_id=profile.user_id,
        total_coaching_hours=profile.total_coaching_hours,
        coaching_years=profile.coaching_years,
        specialty=profile.specialty,
        degrees=degrees,
        certifications=certifications,
        mentoring_experiences=mentoring_experiences,
        field_experiences=field_experiences
    )


@router.put("/detailed", response_model=DetailedProfileResponse)
async def update_detailed_profile(
    profile_data: DetailedProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user's detailed profile (CoachProfile).
    Creates profile if it doesn't exist.
    """
    # Find or create coach profile
    result = await db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Create new profile
        profile = CoachProfile(user_id=current_user.user_id)
        db.add(profile)

    # Update fields
    if profile_data.total_coaching_hours is not None:
        profile.total_coaching_hours = profile_data.total_coaching_hours

    if profile_data.coaching_years is not None:
        profile.coaching_years = profile_data.coaching_years

    if profile_data.specialty is not None:
        profile.specialty = profile_data.specialty

    if profile_data.degrees is not None:
        profile.degrees = json.dumps([d.dict() for d in profile_data.degrees], ensure_ascii=False)

    if profile_data.certifications is not None:
        profile.certifications = json.dumps([c.dict() for c in profile_data.certifications], ensure_ascii=False)

    if profile_data.mentoring_experiences is not None:
        profile.mentoring_experiences = json.dumps([m.dict() for m in profile_data.mentoring_experiences], ensure_ascii=False)

    if profile_data.field_experiences is not None:
        profile.field_experiences = json.dumps(profile_data.field_experiences, ensure_ascii=False)

    await db.commit()
    await db.refresh(profile)

    # Parse JSON fields for response
    degrees = json.loads(profile.degrees) if profile.degrees else []
    certifications = json.loads(profile.certifications) if profile.certifications else []
    mentoring_experiences = json.loads(profile.mentoring_experiences) if profile.mentoring_experiences else []
    field_experiences = json.loads(profile.field_experiences) if profile.field_experiences else {}

    return DetailedProfileResponse(
        profile_id=profile.profile_id,
        user_id=profile.user_id,
        total_coaching_hours=profile.total_coaching_hours,
        coaching_years=profile.coaching_years,
        specialty=profile.specialty,
        degrees=degrees,
        certifications=certifications,
        mentoring_experiences=mentoring_experiences,
        field_experiences=field_experiences
    )

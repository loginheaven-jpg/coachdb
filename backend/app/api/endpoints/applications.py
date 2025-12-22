from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.utils import get_user_roles
from app.models.user import User, UserRole
from app.models.application import Application, ApplicationData
from app.models.competency import CoachCompetency
from app.models.project import Project, ProjectStatus
from app.models.custom_question import CustomQuestion, CustomQuestionAnswer
from app.models.notification import Notification, NotificationType
from app.schemas.application import (
    ParticipationProjectResponse,
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    ApplicationSubmitRequest,
    CustomAnswerSubmit,
    ApplicationDataSubmit,
    ApplicationDataResponse,
    SupplementRequest,
    SupplementSubmit
)
from app.schemas.project import CustomQuestionResponse, CustomQuestionAnswerResponse
from app.schemas.competency import FileBasicInfo

router = APIRouter(prefix="/applications", tags=["applications"])


# ============================================================================
# Migration Endpoint - 기존 응모 데이터를 세부정보로 마이그레이션
# ============================================================================
@router.post("/migrate-to-competencies", status_code=200)
async def migrate_applications_to_competencies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Migrate current user's application data to competency wallet (세부정보)

    This is a one-time migration endpoint for existing applications.
    """
    from app.models.competency import CoachCompetency, VerificationStatus

    # Get all user's applications with data
    apps_result = await db.execute(
        select(Application).where(Application.user_id == current_user.user_id)
    )
    applications = apps_result.scalars().all()

    migrated_count = 0
    skipped_count = 0

    for application in applications:
        # Get application data
        data_result = await db.execute(
            select(ApplicationData).where(ApplicationData.application_id == application.application_id)
        )
        app_data_items = data_result.scalars().all()

        for data_item in app_data_items:
            if not data_item.submitted_value:
                skipped_count += 1
                continue

            # Check if competency already exists
            comp_result = await db.execute(
                select(CoachCompetency).where(
                    CoachCompetency.user_id == current_user.user_id,
                    CoachCompetency.item_id == data_item.item_id
                )
            )
            existing = comp_result.scalar_one_or_none()

            if existing:
                # Update if different
                if existing.value != data_item.submitted_value:
                    existing.value = data_item.submitted_value
                    if data_item.submitted_file_id:
                        existing.file_id = data_item.submitted_file_id
                    migrated_count += 1
                    print(f"[Migration] Updated competency for item_id={data_item.item_id}")
                else:
                    skipped_count += 1
            else:
                # Create new
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

    await db.commit()

    return {
        "message": f"마이그레이션 완료: {migrated_count}개 항목 동기화, {skipped_count}개 스킵",
        "migrated": migrated_count,
        "skipped": skipped_count
    }


@router.get("/my", response_model=List[ParticipationProjectResponse])
async def get_my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's participation project list"""
    # Get all applications for the current user
    result = await db.execute(
        select(Application)
        .where(Application.user_id == current_user.user_id)
        .order_by(Application.submitted_at.desc().nullslast(),
                  Application.last_updated.desc().nullslast(),
                  Application.application_id.desc())
    )
    applications = result.scalars().all()

    # Build response list
    response_list = []
    for application in applications:
        # Get project info
        project_result = await db.execute(
            select(Project).where(Project.project_id == application.project_id)
        )
        project = project_result.scalar_one_or_none()

        if not project:
            continue

        # Get all application data items for document verification status
        app_data_result = await db.execute(
            select(ApplicationData).where(
                ApplicationData.application_id == application.application_id
            )
        )
        app_data_items = app_data_result.scalars().all()

        # Calculate document verification status and supplement info
        supplement_count = 0
        if not app_data_items:
            doc_verification_status = "pending"
        else:
            statuses = [item.verification_status for item in app_data_items]
            supplement_count = sum(1 for s in statuses if s == "supplement_requested")

            if supplement_count > 0:
                doc_verification_status = "supplement_requested"
            elif all(s == "approved" for s in statuses):
                doc_verification_status = "approved"
            elif any(s == "rejected" for s in statuses):
                doc_verification_status = "rejected"
            elif any(s == "approved" for s in statuses):
                doc_verification_status = "partial"
            else:
                doc_verification_status = "pending"

        # Create response item
        response_item = ParticipationProjectResponse(
            application_id=application.application_id,
            project_id=project.project_id,
            project_name=project.project_name,
            recruitment_start_date=project.recruitment_start_date,
            recruitment_end_date=project.recruitment_end_date,
            application_status=application.status.value,
            document_verification_status=doc_verification_status,
            review_score=float(application.final_score) if application.final_score else (
                float(application.auto_score) if application.auto_score else None
            ),
            selection_result=application.selection_result.value,
            submitted_at=application.submitted_at,
            motivation=application.motivation,
            applied_role=application.applied_role.value if application.applied_role else None,
            has_supplement_request=supplement_count > 0,
            supplement_count=supplement_count
        )
        response_list.append(response_item)

    return response_list


# ============================================================================
# Application CRUD Endpoints
# ============================================================================
@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    application_data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new application (draft)

    **Permissions**: All authenticated users can create applications
    """
    # Check if project exists and is recruiting
    project_result = await db.execute(
        select(Project).where(Project.project_id == application_data.project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {application_data.project_id} not found"
        )

    # Check if project is accepting applications
    # READY status with dates within recruitment period OR legacy RECRUITING status
    from app.schemas.project import calculate_display_status
    from app.models.project import ProjectStatus as ProjStatus

    display_status = calculate_display_status(
        project.status,
        project.recruitment_start_date,
        project.recruitment_end_date
    )

    # Allow applications if display_status is "recruiting" OR legacy RECRUITING status
    is_recruiting = display_status == "recruiting" or project.status == ProjStatus.RECRUITING
    if not is_recruiting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project is not accepting applications"
        )

    # Check if user already has an application for this project
    existing_result = await db.execute(
        select(Application).where(
            Application.project_id == application_data.project_id,
            Application.user_id == current_user.user_id
        )
    )
    existing_application = existing_result.scalar_one_or_none()
    if existing_application:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "이미 지원한 과제입니다.",
                "application_id": existing_application.application_id
            }
        )

    # Create new application
    new_application = Application(
        project_id=application_data.project_id,
        user_id=current_user.user_id,
        motivation=application_data.motivation,
        applied_role=application_data.applied_role
    )

    db.add(new_application)
    await db.commit()
    await db.refresh(new_application)

    return ApplicationResponse(
        application_id=new_application.application_id,
        project_id=new_application.project_id,
        user_id=new_application.user_id,
        motivation=new_application.motivation,
        applied_role=new_application.applied_role,
        status=new_application.status.value,
        auto_score=float(new_application.auto_score) if new_application.auto_score else None,
        final_score=float(new_application.final_score) if new_application.final_score else None,
        score_visibility=new_application.score_visibility.value,
        can_submit=new_application.can_submit,
        selection_result=new_application.selection_result.value,
        submitted_at=new_application.submitted_at,
        last_updated=new_application.last_updated
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get application details

    **Permissions**: Users can view their own applications
    """
    result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission (user can only view their own applications)
    if application.user_id != current_user.user_id:
        user_roles = get_user_roles(current_user)
        if "SUPER_ADMIN" not in user_roles and "PROJECT_MANAGER" not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )

    return ApplicationResponse(
        application_id=application.application_id,
        project_id=application.project_id,
        user_id=application.user_id,
        motivation=application.motivation,
        applied_role=application.applied_role,
        status=application.status.value,
        auto_score=float(application.auto_score) if application.auto_score else None,
        final_score=float(application.final_score) if application.final_score else None,
        score_visibility=application.score_visibility.value,
        can_submit=application.can_submit,
        selection_result=application.selection_result.value,
        submitted_at=application.submitted_at,
        last_updated=application.last_updated
    )


@router.put("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: int,
    application_data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update application (motivation and role)

    **Permissions**: Users can update their own draft applications
    """
    result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission
    if application.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Update fields
    update_data = application_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)

    await db.commit()
    await db.refresh(application)

    return ApplicationResponse(
        application_id=application.application_id,
        project_id=application.project_id,
        user_id=application.user_id,
        motivation=application.motivation,
        applied_role=application.applied_role,
        status=application.status.value,
        auto_score=float(application.auto_score) if application.auto_score else None,
        final_score=float(application.final_score) if application.final_score else None,
        score_visibility=application.score_visibility.value,
        can_submit=application.can_submit,
        selection_result=application.selection_result.value,
        submitted_at=application.submitted_at,
        last_updated=application.last_updated
    )


# ============================================================================
# Custom Question Answer Endpoints
# ============================================================================
@router.post("/{application_id}/answers", response_model=CustomQuestionAnswerResponse, status_code=status.HTTP_201_CREATED)
async def save_custom_answer(
    application_id: int,
    answer_data: CustomAnswerSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save or update a custom question answer

    **Permissions**: Users can save answers for their own applications
    """
    # Get application
    app_result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission
    if application.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Check if answer already exists
    existing_result = await db.execute(
        select(CustomQuestionAnswer).where(
            CustomQuestionAnswer.application_id == application_id,
            CustomQuestionAnswer.question_id == answer_data.question_id
        )
    )
    existing_answer = existing_result.scalar_one_or_none()

    if existing_answer:
        # Update existing answer
        existing_answer.answer_text = answer_data.answer_text
        existing_answer.answer_file_id = answer_data.answer_file_id
        await db.commit()
        await db.refresh(existing_answer)
        return CustomQuestionAnswerResponse(
            answer_id=existing_answer.answer_id,
            application_id=existing_answer.application_id,
            question_id=existing_answer.question_id,
            answer_text=existing_answer.answer_text,
            answer_file_id=existing_answer.answer_file_id,
            created_at=existing_answer.created_at,
            updated_at=existing_answer.updated_at
        )
    else:
        # Create new answer
        new_answer = CustomQuestionAnswer(
            application_id=application_id,
            question_id=answer_data.question_id,
            answer_text=answer_data.answer_text,
            answer_file_id=answer_data.answer_file_id
        )
        db.add(new_answer)
        await db.commit()
        await db.refresh(new_answer)
        return CustomQuestionAnswerResponse(
            answer_id=new_answer.answer_id,
            application_id=new_answer.application_id,
            question_id=new_answer.question_id,
            answer_text=new_answer.answer_text,
            answer_file_id=new_answer.answer_file_id,
            created_at=new_answer.created_at,
            updated_at=new_answer.updated_at
        )


@router.get("/{application_id}/answers", response_model=List[CustomQuestionAnswerResponse])
async def get_custom_answers(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all custom question answers for an application

    **Permissions**: Users can view answers for their own applications
    """
    # Get application
    app_result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission
    if application.user_id != current_user.user_id:
        user_roles = get_user_roles(current_user)
        if "SUPER_ADMIN" not in user_roles and "PROJECT_MANAGER" not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )

    # Get answers
    result = await db.execute(
        select(CustomQuestionAnswer)
        .where(CustomQuestionAnswer.application_id == application_id)
        .order_by(CustomQuestionAnswer.question_id)
    )
    answers = result.scalars().all()

    return [
        CustomQuestionAnswerResponse(
            answer_id=answer.answer_id,
            application_id=answer.application_id,
            question_id=answer.question_id,
            answer_text=answer.answer_text,
            answer_file_id=answer.answer_file_id,
            created_at=answer.created_at,
            updated_at=answer.updated_at
        )
        for answer in answers
    ]


@router.post("/{application_id}/submit", response_model=ApplicationResponse)
async def submit_application(
    application_id: int,
    submit_data: ApplicationSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit an application with motivation, role, and custom answers

    **Permissions**: Users can submit their own applications
    """
    # Debug: Log received data
    print(f"[submit_application] Received application_id={application_id}")
    print(f"[submit_application] application_data count: {len(submit_data.application_data)}")
    for i, item in enumerate(submit_data.application_data):
        print(f"[submit_application] data[{i}]: item_id={item.item_id}, has_value={bool(item.submitted_value)}, value_len={len(item.submitted_value) if item.submitted_value else 0}")

    # Get application
    app_result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission
    if application.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Update motivation and role
    application.motivation = submit_data.motivation
    application.applied_role = submit_data.applied_role
    application.status = "submitted"
    application.submitted_at = datetime.utcnow()

    # Save custom answers (legacy)
    for answer_data in submit_data.custom_answers:
        # Check if answer already exists
        existing_result = await db.execute(
            select(CustomQuestionAnswer).where(
                CustomQuestionAnswer.application_id == application_id,
                CustomQuestionAnswer.question_id == answer_data.question_id
            )
        )
        existing_answer = existing_result.scalar_one_or_none()

        if existing_answer:
            existing_answer.answer_text = answer_data.answer_text
            existing_answer.answer_file_id = answer_data.answer_file_id
        else:
            new_answer = CustomQuestionAnswer(
                application_id=application_id,
                question_id=answer_data.question_id,
                answer_text=answer_data.answer_text,
                answer_file_id=answer_data.answer_file_id
            )
            db.add(new_answer)

    # Save application data (survey item responses)
    for data_item in submit_data.application_data:
        # Check if data already exists for this item
        existing_result = await db.execute(
            select(ApplicationData).where(
                ApplicationData.application_id == application_id,
                ApplicationData.item_id == data_item.item_id
            )
        )
        existing_data = existing_result.scalar_one_or_none()

        if existing_data:
            existing_data.submitted_value = data_item.submitted_value
            existing_data.submitted_file_id = data_item.submitted_file_id
        else:
            new_data = ApplicationData(
                application_id=application_id,
                item_id=data_item.item_id,
                submitted_value=data_item.submitted_value,
                submitted_file_id=data_item.submitted_file_id
            )
            db.add(new_data)

        # ============================================================
        # Auto-sync to CoachCompetency (역량 지갑에 자동 저장)
        # ============================================================
        try:
            value_preview = data_item.submitted_value[:50] if data_item.submitted_value else None
            print(f"[Auto-sync] Processing item_id={data_item.item_id}, value_preview={value_preview}")

            if data_item.submitted_value:  # Only sync if there's a value
                from app.models.competency import CoachCompetency, VerificationStatus

                # Check if user already has this competency
                competency_result = await db.execute(
                    select(CoachCompetency).where(
                        CoachCompetency.user_id == application.user_id,
                        CoachCompetency.item_id == data_item.item_id
                    )
                )
                existing_competency = competency_result.scalar_one_or_none()

                if existing_competency:
                    # Update existing competency if value changed
                    print(f"[Auto-sync] Updating existing competency {existing_competency.competency_id}")
                    if existing_competency.value != data_item.submitted_value:
                        existing_competency.value = data_item.submitted_value
                        if data_item.submitted_file_id:
                            existing_competency.file_id = data_item.submitted_file_id
                        # Reset verification when value changes
                        existing_competency.verification_status = VerificationStatus.PENDING
                else:
                    # Create new competency in the wallet
                    print(f"[Auto-sync] Creating new competency for user={application.user_id}, item={data_item.item_id}")
                    new_competency = CoachCompetency(
                        user_id=application.user_id,
                        item_id=data_item.item_id,
                        value=data_item.submitted_value,
                        file_id=data_item.submitted_file_id,
                        verification_status=VerificationStatus.PENDING
                    )
                    db.add(new_competency)
                    print(f"[Auto-sync] Added new competency to session")
            else:
                print(f"[Auto-sync] Skipping item_id={data_item.item_id} - no submitted_value")
        except Exception as sync_error:
            print(f"[Auto-sync] ERROR syncing item_id={data_item.item_id}: {str(sync_error)}")
            import traceback
            traceback.print_exc()
            # Don't raise - let the commit proceed with ApplicationData at least

    print(f"[Auto-sync] About to commit changes for application {application_id}...")
    await db.commit()
    print(f"[Auto-sync] Commit successful for application {application_id}!")
    await db.refresh(application)

    return ApplicationResponse(
        application_id=application.application_id,
        project_id=application.project_id,
        user_id=application.user_id,
        motivation=application.motivation,
        applied_role=application.applied_role,
        status=application.status.value,
        auto_score=float(application.auto_score) if application.auto_score else None,
        final_score=float(application.final_score) if application.final_score else None,
        score_visibility=application.score_visibility.value,
        can_submit=application.can_submit,
        selection_result=application.selection_result.value,
        submitted_at=application.submitted_at,
        last_updated=application.last_updated
    )


# ============================================================================
# Application Data Endpoints (Survey Item Responses)
# ============================================================================
@router.get("/{application_id}/data", response_model=List[ApplicationDataResponse])
async def get_application_data(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all application data (survey item responses) for an application

    **Permissions**: Users can view data for their own applications, admins can view all
    """
    # Get application
    app_result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission
    if application.user_id != current_user.user_id:
        user_roles = get_user_roles(current_user)
        if "SUPER_ADMIN" not in user_roles and "PROJECT_MANAGER" not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )

    # Get application data with file info and linked competency
    result = await db.execute(
        select(ApplicationData)
        .where(ApplicationData.application_id == application_id)
        .options(
            selectinload(ApplicationData.submitted_file),
            selectinload(ApplicationData.linked_competency).selectinload(CoachCompetency.file)
        )
        .order_by(ApplicationData.item_id)
    )
    data_items = result.scalars().all()

    responses = []
    for item in data_items:
        # Build file info if file exists
        file_info = None
        if item.submitted_file:
            file_info = FileBasicInfo(
                file_id=item.submitted_file.file_id,
                original_filename=item.submitted_file.original_filename,
                file_size=item.submitted_file.file_size,
                mime_type=item.submitted_file.mime_type,
                uploaded_at=item.submitted_file.uploaded_at
            )

        # Build linked competency info (역량 지갑에서 가져온 실시간 데이터)
        linked_value = None
        linked_file_id = None
        linked_file_info = None
        linked_verification_status = None

        if item.linked_competency:
            linked_value = item.linked_competency.value
            linked_file_id = item.linked_competency.file_id
            linked_verification_status = item.linked_competency.verification_status.value if item.linked_competency.verification_status else None

            if item.linked_competency.file:
                linked_file_info = FileBasicInfo(
                    file_id=item.linked_competency.file.file_id,
                    original_filename=item.linked_competency.file.original_filename,
                    file_size=item.linked_competency.file.file_size,
                    mime_type=item.linked_competency.file.mime_type,
                    uploaded_at=item.linked_competency.file.uploaded_at
                )

        responses.append(ApplicationDataResponse(
            data_id=item.data_id,
            application_id=item.application_id,
            item_id=item.item_id,
            competency_id=item.competency_id,
            submitted_value=item.submitted_value,
            submitted_file_id=item.submitted_file_id,
            submitted_file_info=file_info,
            verification_status=item.verification_status,
            item_score=float(item.item_score) if item.item_score else None,
            reviewed_by=item.reviewed_by,
            reviewed_at=item.reviewed_at,
            rejection_reason=item.rejection_reason,
            # Linked competency data
            linked_competency_value=linked_value,
            linked_competency_file_id=linked_file_id,
            linked_competency_file_info=linked_file_info,
            linked_competency_verification_status=linked_verification_status
        ))

    return responses


@router.post("/{application_id}/data", response_model=ApplicationDataResponse, status_code=status.HTTP_201_CREATED)
async def save_application_data(
    application_id: int,
    data_item: ApplicationDataSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save or update a single application data item (survey item response)

    **Permissions**: Users can save data for their own applications
    """
    # Get application
    app_result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission
    if application.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Check if data already exists
    existing_result = await db.execute(
        select(ApplicationData).where(
            ApplicationData.application_id == application_id,
            ApplicationData.item_id == data_item.item_id
        )
    )
    existing_data = existing_result.scalar_one_or_none()

    if existing_data:
        # Update existing data
        existing_data.submitted_value = data_item.submitted_value
        existing_data.submitted_file_id = data_item.submitted_file_id
        await db.commit()
        await db.refresh(existing_data)
        return ApplicationDataResponse(
            data_id=existing_data.data_id,
            application_id=existing_data.application_id,
            item_id=existing_data.item_id,
            competency_id=existing_data.competency_id,
            submitted_value=existing_data.submitted_value,
            submitted_file_id=existing_data.submitted_file_id,
            verification_status=existing_data.verification_status,
            item_score=float(existing_data.item_score) if existing_data.item_score else None,
            reviewed_by=existing_data.reviewed_by,
            reviewed_at=existing_data.reviewed_at,
            rejection_reason=existing_data.rejection_reason
        )
    else:
        # Create new data
        new_data = ApplicationData(
            application_id=application_id,
            item_id=data_item.item_id,
            submitted_value=data_item.submitted_value,
            submitted_file_id=data_item.submitted_file_id
        )
        db.add(new_data)
        await db.commit()
        await db.refresh(new_data)
        return ApplicationDataResponse(
            data_id=new_data.data_id,
            application_id=new_data.application_id,
            item_id=new_data.item_id,
            competency_id=new_data.competency_id,
            submitted_value=new_data.submitted_value,
            submitted_file_id=new_data.submitted_file_id,
            verification_status=new_data.verification_status,
            item_score=float(new_data.item_score) if new_data.item_score else None,
            reviewed_by=new_data.reviewed_by,
            reviewed_at=new_data.reviewed_at,
            rejection_reason=new_data.rejection_reason
        )


# ============================================================================
# Supplement Request/Submit Endpoints
# ============================================================================
@router.put("/{application_id}/data/{data_id}/request-supplement", response_model=ApplicationDataResponse)
async def request_supplement(
    application_id: int,
    data_id: int,
    request: SupplementRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Request supplement for an application data item (Staff/Admin only)

    - Sets verification_status to 'supplement_requested'
    - Sets supplement_deadline based on deadline_days
    - Creates notification for the applicant
    """
    # Check permission (Staff or Admin)
    if not any(role in current_user.roles for role in [UserRole.STAFF, UserRole.SUPER_ADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or Admin permission required"
        )

    # Get application data
    data_result = await db.execute(
        select(ApplicationData).where(
            ApplicationData.data_id == data_id,
            ApplicationData.application_id == application_id
        )
    )
    app_data = data_result.scalar_one_or_none()
    if not app_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application data with id {data_id} not found"
        )

    # Get application for user notification
    app_result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Get project info for notification
    project_result = await db.execute(
        select(Project).where(Project.project_id == application.project_id)
    )
    project = project_result.scalar_one_or_none()

    # Update application data
    now = datetime.now()
    app_data.verification_status = 'supplement_requested'
    app_data.rejection_reason = request.rejection_reason
    app_data.supplement_requested_at = now
    app_data.supplement_deadline = now + timedelta(days=request.deadline_days)
    app_data.reviewed_by = current_user.user_id
    app_data.reviewed_at = now

    # Create notification for applicant
    notification = Notification(
        user_id=application.user_id,
        type=NotificationType.SUPPLEMENT_REQUEST.value,
        title=f"서류 보충 요청 - {project.project_name if project else '과제'}",
        message=f"제출하신 서류에 보충이 필요합니다. 사유: {request.rejection_reason}. 기한: {request.deadline_days}일 이내",
        related_application_id=application_id,
        related_project_id=application.project_id,
        related_data_id=data_id
    )
    db.add(notification)

    await db.commit()
    await db.refresh(app_data)

    return ApplicationDataResponse(
        data_id=app_data.data_id,
        application_id=app_data.application_id,
        item_id=app_data.item_id,
        competency_id=app_data.competency_id,
        submitted_value=app_data.submitted_value,
        submitted_file_id=app_data.submitted_file_id,
        verification_status=app_data.verification_status,
        item_score=float(app_data.item_score) if app_data.item_score else None,
        reviewed_by=app_data.reviewed_by,
        reviewed_at=app_data.reviewed_at,
        rejection_reason=app_data.rejection_reason,
        supplement_deadline=app_data.supplement_deadline,
        supplement_requested_at=app_data.supplement_requested_at
    )


@router.put("/{application_id}/data/{data_id}/submit-supplement", response_model=ApplicationDataResponse)
async def submit_supplement(
    application_id: int,
    data_id: int,
    request: SupplementSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit supplement for an application data item (Applicant only)

    - Updates submitted_value and/or submitted_file_id
    - Sets verification_status to 'supplemented'
    """
    # Get application
    app_result = await db.execute(
        select(Application).where(Application.application_id == application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} not found"
        )

    # Check permission (owner only)
    if application.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit supplements for your own applications"
        )

    # Get application data
    data_result = await db.execute(
        select(ApplicationData).where(
            ApplicationData.data_id == data_id,
            ApplicationData.application_id == application_id
        )
    )
    app_data = data_result.scalar_one_or_none()
    if not app_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application data with id {data_id} not found"
        )

    # Check if supplement was requested
    if app_data.verification_status != 'supplement_requested':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No supplement request for this item"
        )

    # Check deadline
    if app_data.supplement_deadline and datetime.now() > app_data.supplement_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplement deadline has passed"
        )

    # Update application data
    if request.submitted_value is not None:
        app_data.submitted_value = request.submitted_value
    if request.submitted_file_id is not None:
        app_data.submitted_file_id = request.submitted_file_id
    app_data.verification_status = 'supplemented'

    # Auto-sync to CoachCompetency (역량 지갑에 자동 동기화)
    from app.models.competency import CoachCompetency, VerificationStatus
    competency_result = await db.execute(
        select(CoachCompetency).where(
            CoachCompetency.user_id == application.user_id,
            CoachCompetency.item_id == app_data.item_id
        )
    )
    existing_competency = competency_result.scalar_one_or_none()

    if existing_competency:
        # Update existing competency
        if request.submitted_value is not None:
            existing_competency.value = request.submitted_value
        if request.submitted_file_id is not None:
            existing_competency.file_id = request.submitted_file_id
        existing_competency.verification_status = VerificationStatus.PENDING
        existing_competency.is_globally_verified = False
        existing_competency.globally_verified_at = None
        logger.info(f"Auto-synced supplement to CoachCompetency {existing_competency.competency_id}")

    await db.commit()

    # Reload with file info
    result = await db.execute(
        select(ApplicationData)
        .where(ApplicationData.data_id == data_id)
        .options(selectinload(ApplicationData.submitted_file))
    )
    app_data = result.scalar_one()

    # Build file info
    file_info = None
    if app_data.submitted_file:
        file_info = FileBasicInfo(
            file_id=app_data.submitted_file.file_id,
            original_filename=app_data.submitted_file.original_filename,
            file_size=app_data.submitted_file.file_size,
            mime_type=app_data.submitted_file.mime_type,
            uploaded_at=app_data.submitted_file.uploaded_at
        )

    return ApplicationDataResponse(
        data_id=app_data.data_id,
        application_id=app_data.application_id,
        item_id=app_data.item_id,
        competency_id=app_data.competency_id,
        submitted_value=app_data.submitted_value,
        submitted_file_id=app_data.submitted_file_id,
        submitted_file_info=file_info,
        verification_status=app_data.verification_status,
        item_score=float(app_data.item_score) if app_data.item_score else None,
        reviewed_by=app_data.reviewed_by,
        reviewed_at=app_data.reviewed_at,
        rejection_reason=app_data.rejection_reason,
        supplement_deadline=app_data.supplement_deadline,
        supplement_requested_at=app_data.supplement_requested_at
    )


@router.put("/{application_id}/data/{data_id}/verify", response_model=ApplicationDataResponse)
async def verify_application_data(
    application_id: int,
    data_id: int,
    verification_status: str,
    item_score: float = None,
    rejection_reason: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify (approve/reject) an application data item (Staff/Admin only)
    """
    # Check permission
    if not any(role in current_user.roles for role in [UserRole.STAFF, UserRole.SUPER_ADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or Admin permission required"
        )

    # Validate status
    valid_statuses = ['pending', 'approved', 'rejected', 'supplement_requested', 'supplemented']
    if verification_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification status. Must be one of: {valid_statuses}"
        )

    # Get application data
    data_result = await db.execute(
        select(ApplicationData).where(
            ApplicationData.data_id == data_id,
            ApplicationData.application_id == application_id
        )
    )
    app_data = data_result.scalar_one_or_none()
    if not app_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application data with id {data_id} not found"
        )

    # Update
    app_data.verification_status = verification_status
    app_data.reviewed_by = current_user.user_id
    app_data.reviewed_at = datetime.now()
    if item_score is not None:
        app_data.item_score = item_score
    if rejection_reason is not None:
        app_data.rejection_reason = rejection_reason

    await db.commit()
    await db.refresh(app_data)

    return ApplicationDataResponse(
        data_id=app_data.data_id,
        application_id=app_data.application_id,
        item_id=app_data.item_id,
        competency_id=app_data.competency_id,
        submitted_value=app_data.submitted_value,
        submitted_file_id=app_data.submitted_file_id,
        verification_status=app_data.verification_status,
        item_score=float(app_data.item_score) if app_data.item_score else None,
        reviewed_by=app_data.reviewed_by,
        reviewed_at=app_data.reviewed_at,
        rejection_reason=app_data.rejection_reason,
        supplement_deadline=app_data.supplement_deadline,
        supplement_requested_at=app_data.supplement_requested_at
    )

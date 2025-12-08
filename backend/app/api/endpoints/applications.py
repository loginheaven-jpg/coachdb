from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.application import Application, ApplicationData
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

router = APIRouter(prefix="/applications", tags=["applications"])


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

    if project.status != ProjectStatus.RECRUITING:
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
        import json
        user_roles = json.loads(current_user.roles)
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
        import json
        user_roles = json.loads(current_user.roles)
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
        import json
        user_roles = json.loads(current_user.roles)
        if "SUPER_ADMIN" not in user_roles and "PROJECT_MANAGER" not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )

    # Get application data
    result = await db.execute(
        select(ApplicationData)
        .where(ApplicationData.application_id == application_id)
        .order_by(ApplicationData.item_id)
    )
    data_items = result.scalars().all()

    return [
        ApplicationDataResponse(
            data_id=item.data_id,
            application_id=item.application_id,
            item_id=item.item_id,
            competency_id=item.competency_id,
            submitted_value=item.submitted_value,
            submitted_file_id=item.submitted_file_id,
            verification_status=item.verification_status,
            item_score=float(item.item_score) if item.item_score else None,
            reviewed_by=item.reviewed_by,
            reviewed_at=item.reviewed_at,
            rejection_reason=item.rejection_reason
        )
        for item in data_items
    ]


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

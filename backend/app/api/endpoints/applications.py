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
from app.models.competency import CoachCompetency, CompetencyItem
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
    from app.models.competency import CoachCompetency, VerificationStatus

    for data_item in submit_data.application_data:
        # ============================================================
        # First, find or create CoachCompetency (역량 지갑)
        # ============================================================
        competency_id = None
        try:
            value_preview = data_item.submitted_value[:50] if data_item.submitted_value else None
            print(f"[Auto-sync] Processing item_id={data_item.item_id}, value_preview={value_preview}")

            # Check if user already has this competency
            competency_result = await db.execute(
                select(CoachCompetency).where(
                    CoachCompetency.user_id == application.user_id,
                    CoachCompetency.item_id == data_item.item_id
                )
            )
            existing_competency = competency_result.scalar_one_or_none()

            if existing_competency:
                competency_id = existing_competency.competency_id
                # Update existing competency if value changed
                if data_item.submitted_value and existing_competency.value != data_item.submitted_value:
                    print(f"[Auto-sync] Updating existing competency {existing_competency.competency_id}")
                    existing_competency.value = data_item.submitted_value
                    if data_item.submitted_file_id:
                        existing_competency.file_id = data_item.submitted_file_id
                    # Reset verification when value changes
                    existing_competency.verification_status = VerificationStatus.PENDING
                elif data_item.submitted_file_id and existing_competency.file_id != data_item.submitted_file_id:
                    # Update file even if value didn't change
                    existing_competency.file_id = data_item.submitted_file_id
                    existing_competency.verification_status = VerificationStatus.PENDING
            elif data_item.submitted_value:
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
                await db.flush()  # Flush to get the competency_id
                competency_id = new_competency.competency_id
                print(f"[Auto-sync] Created new competency with id={competency_id}")
        except Exception as sync_error:
            print(f"[Auto-sync] ERROR syncing item_id={data_item.item_id}: {str(sync_error)}")
            import traceback
            traceback.print_exc()

        # ============================================================
        # Then, create or update ApplicationData with competency_id link
        # ============================================================
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
            if competency_id:
                existing_data.competency_id = competency_id  # Link to competency
        else:
            new_data = ApplicationData(
                application_id=application_id,
                item_id=data_item.item_id,
                submitted_value=data_item.submitted_value,
                submitted_file_id=data_item.submitted_file_id,
                competency_id=competency_id  # Link to competency
            )
            db.add(new_data)

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

    # ============================================================================
    # 핵심 수정: item_code 기반 매핑으로 competency 조회
    # - 설문 항목(CERT_COACH)과 세부정보 항목(ADDON_CERT_COACH)은 다른 item_id
    # - item_code 패턴으로 매핑: CERT_* → ADDON_CERT_*, EXP_* → ADDON_EXP_*, etc.
    # ============================================================================

    # 1. CompetencyItem 전체 조회하여 item_code 매핑 생성
    items_result = await db.execute(select(CompetencyItem))
    all_items = items_result.scalars().all()
    item_id_to_code = {item.item_id: item.item_code for item in all_items}
    code_to_item_id = {item.item_code: item.item_id for item in all_items}

    # 2. survey item_code → ADDON_* item_code 변환 함수
    def get_addon_item_codes(survey_item_code: str) -> list:
        """설문 item_code에 대응하는 ADDON item_code 목록 반환"""
        if not survey_item_code:
            return []
        addon_codes = []
        # CERT_COACH → ADDON_CERT_COACH
        if survey_item_code.startswith("CERT_"):
            addon_codes.append("ADDON_" + survey_item_code)
        # EXP_* → ADDON_EXP_* (legacy 포함)
        elif survey_item_code.startswith("EXP_"):
            addon_codes.append("ADDON_" + survey_item_code)
        # DEGREE_* → ADDON_DEGREE_* 또는 EDU_*
        elif survey_item_code.startswith("DEGREE_"):
            addon_codes.append("ADDON_" + survey_item_code)
        # COACHING_* → ADDON_COACHING_*
        elif survey_item_code.startswith("COACHING_"):
            addon_codes.append("ADDON_" + survey_item_code)
        # 이미 ADDON_* 인 경우 그대로
        elif survey_item_code.startswith("ADDON_"):
            addon_codes.append(survey_item_code)
        return addon_codes

    # 3. 해당 사용자의 모든 competency를 미리 로드 (N+1 쿼리 방지)
    # 세부정보 API와 동일하게 created_at.desc() 정렬 (최신순)
    competencies_result = await db.execute(
        select(CoachCompetency)
        .where(CoachCompetency.user_id == application.user_id)
        .options(selectinload(CoachCompetency.file))
        .order_by(CoachCompetency.created_at.desc())
    )
    all_user_competencies = competencies_result.scalars().all()
    # item_id를 키로 하는 딕셔너리 생성 (리스트로 - 복수 항목 지원)
    user_competencies_by_id = {}
    for c in all_user_competencies:
        if c.item_id not in user_competencies_by_id:
            user_competencies_by_id[c.item_id] = []
        user_competencies_by_id[c.item_id].append(c)
    # item_code를 키로 하는 딕셔너리도 생성 (리스트로 - 복수 항목 지원)
    user_competencies_by_code = {}
    for c in all_user_competencies:
        item_code = item_id_to_code.get(c.item_id)
        if item_code:
            if item_code not in user_competencies_by_code:
                user_competencies_by_code[item_code] = []
            user_competencies_by_code[item_code].append(c)

    # 2. ApplicationData 조회 (linked_competency 없이 - stale link 방지)
    result = await db.execute(
        select(ApplicationData)
        .where(ApplicationData.application_id == application_id)
        .options(selectinload(ApplicationData.submitted_file))
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

        # 4. item_code 기반 매핑으로 최신 competency 조회 (복수 항목 지원)
        linked_value = None
        linked_file_id = None
        linked_file_info = None
        linked_verification_status = None

        # item_code 기반 매핑으로 competency 리스트 조회
        survey_item_code = item_id_to_code.get(item.item_id)
        competencies_list = []

        # 1차: 직접 item_id 매칭 시도
        competencies_list = user_competencies_by_id.get(item.item_id, [])

        # 2차: ADDON_* 매핑으로 시도 (CERT_COACH → ADDON_CERT_COACH)
        if not competencies_list and survey_item_code:
            addon_codes = get_addon_item_codes(survey_item_code)
            for addon_code in addon_codes:
                if addon_code in user_competencies_by_code:
                    competencies_list = user_competencies_by_code[addon_code]
                    break

        # 복수 항목 처리: 여러 competency를 JSON 배열로 병합
        if competencies_list:
            import json
            if len(competencies_list) == 1:
                # 단일 항목
                c = competencies_list[0]
                linked_value = c.value
                linked_file_id = c.file_id
                linked_verification_status = c.verification_status.value if c.verification_status else None
                if c.file:
                    linked_file_info = FileBasicInfo(
                        file_id=c.file.file_id,
                        original_filename=c.file.original_filename,
                        file_size=c.file.file_size,
                        mime_type=c.file.mime_type,
                        uploaded_at=c.file.uploaded_at
                    )
            else:
                # 복수 항목: JSON 배열로 병합 (각 항목에 파일 정보 포함)
                merged_entries = []
                first_file_id = None
                first_file_info = None
                first_status = None
                for c in competencies_list:
                    # 파일 정보 준비
                    file_info_dict = None
                    if c.file:
                        file_info_dict = {
                            "file_id": c.file.file_id,
                            "original_filename": c.file.original_filename,
                            "file_size": c.file.file_size,
                            "mime_type": c.file.mime_type
                        }
                    # 각 competency의 value를 파싱하여 배열에 추가
                    if c.value:
                        try:
                            parsed = json.loads(c.value)
                            if isinstance(parsed, list):
                                # 리스트인 경우 각 항목에 파일 정보 추가
                                for entry in parsed:
                                    if isinstance(entry, dict):
                                        entry["_file_info"] = file_info_dict
                                        merged_entries.append(entry)
                                    else:
                                        merged_entries.append({"cert_name": str(entry), "_file_id": c.file_id, "_file_info": file_info_dict})
                            elif isinstance(parsed, dict):
                                parsed["_file_info"] = file_info_dict
                                merged_entries.append(parsed)
                            else:
                                # 단순 문자열인 경우 cert_name으로 감싸기
                                merged_entries.append({"cert_name": c.value, "_file_id": c.file_id, "_file_info": file_info_dict})
                        except json.JSONDecodeError:
                            # JSON이 아닌 경우 cert_name으로 감싸기
                            merged_entries.append({"cert_name": c.value, "_file_id": c.file_id, "_file_info": file_info_dict})
                    # 첫 번째 파일 정보 저장
                    if first_file_id is None and c.file_id:
                        first_file_id = c.file_id
                        if c.file:
                            first_file_info = FileBasicInfo(
                                file_id=c.file.file_id,
                                original_filename=c.file.original_filename,
                                file_size=c.file.file_size,
                                mime_type=c.file.mime_type,
                                uploaded_at=c.file.uploaded_at
                            )
                    if first_status is None and c.verification_status:
                        first_status = c.verification_status.value

                linked_value = json.dumps(merged_entries, ensure_ascii=False) if merged_entries else None
                linked_file_id = first_file_id
                linked_file_info = first_file_info
                linked_verification_status = first_status

        # 하이브리드 구조: is_frozen 상태에 따라 표시할 값 결정
        # - is_frozen=True: submitted_value (스냅샷)
        # - is_frozen=False: linked_competency_value 우선, 없으면 submitted_value
        if application.is_frozen:
            value_to_display = item.submitted_value
            file_id_to_display = item.submitted_file_id
            file_info_to_display = file_info
        else:
            value_to_display = linked_value if linked_value is not None else item.submitted_value
            file_id_to_display = linked_file_id if linked_file_id is not None else item.submitted_file_id
            file_info_to_display = linked_file_info if linked_file_info is not None else file_info

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
            linked_competency_verification_status=linked_verification_status,
            # 하이브리드 구조: 표시용 필드
            value_to_display=value_to_display,
            file_id_to_display=file_id_to_display,
            file_info_to_display=file_info_to_display
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
        saved_data = existing_data
    else:
        # Create new data
        saved_data = ApplicationData(
            application_id=application_id,
            item_id=data_item.item_id,
            submitted_value=data_item.submitted_value,
            submitted_file_id=data_item.submitted_file_id
        )
        db.add(saved_data)

    # ============================================================================
    # 설문항목 → 세부정보 동기화 (CoachCompetency)
    # ============================================================================
    from app.models.competency import VerificationStatus

    # item_code 기반 매핑: 설문 item_id → ADDON item_id
    items_result = await db.execute(select(CompetencyItem))
    all_items = items_result.scalars().all()
    item_id_to_code = {item.item_id: item.item_code for item in all_items}
    code_to_item_id = {item.item_code: item.item_id for item in all_items}

    survey_item_code = item_id_to_code.get(data_item.item_id)
    addon_item_id = None

    # ADDON_* item_id 찾기
    if survey_item_code:
        if survey_item_code.startswith("CERT_"):
            addon_code = "ADDON_" + survey_item_code
            addon_item_id = code_to_item_id.get(addon_code)
        elif survey_item_code.startswith("EXP_"):
            addon_code = "ADDON_" + survey_item_code
            addon_item_id = code_to_item_id.get(addon_code)
        elif survey_item_code.startswith("DEGREE_"):
            addon_code = "ADDON_" + survey_item_code
            addon_item_id = code_to_item_id.get(addon_code)
        elif survey_item_code.startswith("COACHING_"):
            addon_code = "ADDON_" + survey_item_code
            addon_item_id = code_to_item_id.get(addon_code)
        elif survey_item_code.startswith("ADDON_"):
            addon_item_id = data_item.item_id  # 이미 ADDON인 경우

    # 동기화 대상 item_id 결정 (ADDON이 있으면 ADDON, 없으면 원본)
    target_item_id = addon_item_id if addon_item_id else data_item.item_id

    if data_item.submitted_value:
        # 기존 CoachCompetency 조회 (복수 항목 지원: first() 사용)
        comp_result = await db.execute(
            select(CoachCompetency).where(
                CoachCompetency.user_id == application.user_id,
                CoachCompetency.item_id == target_item_id
            ).order_by(CoachCompetency.competency_id)
        )
        existing_comps = comp_result.scalars().all()

        if existing_comps:
            # 기존 역량 업데이트 (첫 번째 레코드 사용)
            existing_comp = existing_comps[0]
            existing_comp.value = data_item.submitted_value
            if data_item.submitted_file_id:
                existing_comp.file_id = data_item.submitted_file_id
            existing_comp.verification_status = VerificationStatus.PENDING
            existing_comp.is_globally_verified = False
            existing_comp.globally_verified_at = None
            saved_data.competency_id = existing_comp.competency_id
            logger.info(f"[save_application_data] Synced to existing CoachCompetency {existing_comp.competency_id}")
        else:
            # 새 역량 생성
            new_comp = CoachCompetency(
                user_id=application.user_id,
                item_id=target_item_id,
                value=data_item.submitted_value,
                file_id=data_item.submitted_file_id,
                verification_status=VerificationStatus.PENDING
            )
            db.add(new_comp)
            await db.flush()  # competency_id 생성을 위해 flush
            saved_data.competency_id = new_comp.competency_id
            logger.info(f"[save_application_data] Created new CoachCompetency {new_comp.competency_id}")

    await db.commit()
    await db.refresh(saved_data)

    return ApplicationDataResponse(
        data_id=saved_data.data_id,
        application_id=saved_data.application_id,
        item_id=saved_data.item_id,
        competency_id=saved_data.competency_id,
        submitted_value=saved_data.submitted_value,
        submitted_file_id=saved_data.submitted_file_id,
        verification_status=saved_data.verification_status,
        item_score=float(saved_data.item_score) if saved_data.item_score else None,
        reviewed_by=saved_data.reviewed_by,
        reviewed_at=saved_data.reviewed_at,
        rejection_reason=saved_data.rejection_reason
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

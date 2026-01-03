"""
Scoring and Selection API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.project import Project
from app.models.application import Application, ApplicationStatus, SelectionResult
from app.models.reviewer_evaluation import ReviewerEvaluation, Recommendation
from app.services.scoring_service import (
    calculate_project_all_scores,
    finalize_project_scores,
    calculate_qualitative_score_average
)
from app.services.notification_service import send_selection_result_notification
from app.schemas.reviewer_evaluation import (
    ReviewerEvaluationCreate,
    ReviewerEvaluationUpdate,
    ReviewerEvaluationResponse,
    ReviewerEvaluationListResponse,
    ReviewerInfo,
    ScoreCalculationResult,
    FinalScoreResult,
    SelectionRecommendation,
    SelectionRecommendationResponse,
    SelectionDecision,
    BulkSelectionRequest,
    BulkSelectionResponse,
    ProjectWeightsUpdate,
)

router = APIRouter(prefix="/scoring", tags=["scoring"])


# ============================================================================
# Score Calculation
# ============================================================================

@router.post("/projects/{project_id}/calculate-scores", response_model=ScoreCalculationResult)
async def calculate_project_scores(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Calculate auto_score for all submitted applications in a project

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Check project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await calculate_project_all_scores(db, project_id)
    return ScoreCalculationResult(**result)


@router.post("/projects/{project_id}/finalize-scores", response_model=FinalScoreResult)
async def finalize_scores(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Calculate final scores (quantitative + qualitative weighted) for all applications

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    result = await finalize_project_scores(db, project_id)
    return FinalScoreResult(**result)


@router.put("/projects/{project_id}/weights")
async def update_project_weights(
    project_id: int,
    weights: ProjectWeightsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Update project evaluation weights

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.quantitative_weight = weights.quantitative_weight
    project.qualitative_weight = weights.qualitative_weight
    await db.commit()

    return {
        "message": "Weights updated successfully",
        "quantitative_weight": project.quantitative_weight,
        "qualitative_weight": project.qualitative_weight
    }


# ============================================================================
# Reviewer Evaluations
# ============================================================================

@router.get("/applications/{application_id}/evaluations", response_model=ReviewerEvaluationListResponse)
async def get_application_evaluations(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "REVIEWER"]))
):
    """
    Get all reviewer evaluations for an application

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, REVIEWER
    """
    result = await db.execute(
        select(ReviewerEvaluation)
        .options(selectinload(ReviewerEvaluation.reviewer))
        .where(ReviewerEvaluation.application_id == application_id)
        .order_by(ReviewerEvaluation.evaluated_at.desc())
    )
    evaluations = result.scalars().all()

    # Calculate average
    avg_result = await db.execute(
        select(func.avg(ReviewerEvaluation.total_score))
        .where(ReviewerEvaluation.application_id == application_id)
    )
    avg_score = avg_result.scalar_one_or_none()

    eval_responses = []
    for ev in evaluations:
        reviewer_info = None
        if ev.reviewer:
            reviewer_info = ReviewerInfo(
                user_id=ev.reviewer.user_id,
                name=ev.reviewer.name or "",
                email=ev.reviewer.email
            )
        eval_responses.append(ReviewerEvaluationResponse(
            evaluation_id=ev.evaluation_id,
            application_id=ev.application_id,
            reviewer_id=ev.reviewer_id,
            reviewer=reviewer_info,
            motivation_score=ev.motivation_score,
            expertise_score=ev.expertise_score,
            role_fit_score=ev.role_fit_score,
            total_score=ev.total_score,
            comment=ev.comment,
            recommendation=ev.recommendation.value if ev.recommendation else None,
            evaluated_at=ev.evaluated_at,
            updated_at=ev.updated_at
        ))

    return ReviewerEvaluationListResponse(
        evaluations=eval_responses,
        average_score=Decimal(str(avg_score)) if avg_score else None,
        evaluation_count=len(evaluations)
    )


@router.get("/applications/{application_id}/evaluations/my", response_model=ReviewerEvaluationResponse)
async def get_my_evaluation(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "REVIEWER"]))
):
    """
    Get my evaluation for an application

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, REVIEWER
    """
    result = await db.execute(
        select(ReviewerEvaluation)
        .options(selectinload(ReviewerEvaluation.reviewer))
        .where(ReviewerEvaluation.application_id == application_id)
        .where(ReviewerEvaluation.reviewer_id == current_user.user_id)
    )
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    reviewer_info = None
    if evaluation.reviewer:
        reviewer_info = ReviewerInfo(
            user_id=evaluation.reviewer.user_id,
            name=evaluation.reviewer.name or "",
            email=evaluation.reviewer.email
        )

    return ReviewerEvaluationResponse(
        evaluation_id=evaluation.evaluation_id,
        application_id=evaluation.application_id,
        reviewer_id=evaluation.reviewer_id,
        reviewer=reviewer_info,
        motivation_score=evaluation.motivation_score,
        expertise_score=evaluation.expertise_score,
        role_fit_score=evaluation.role_fit_score,
        total_score=evaluation.total_score,
        comment=evaluation.comment,
        recommendation=evaluation.recommendation.value if evaluation.recommendation else None,
        evaluated_at=evaluation.evaluated_at,
        updated_at=evaluation.updated_at
    )


@router.post("/applications/{application_id}/evaluations", response_model=ReviewerEvaluationResponse, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    application_id: int,
    evaluation_data: ReviewerEvaluationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "REVIEWER"]))
):
    """
    Create a reviewer evaluation for an application

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, REVIEWER
    """
    # Check application exists
    application = await db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check if already evaluated by this user
    existing = await db.execute(
        select(ReviewerEvaluation)
        .where(ReviewerEvaluation.application_id == application_id)
        .where(ReviewerEvaluation.reviewer_id == current_user.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already evaluated this application")

    # Calculate total score
    total_score = evaluation_data.motivation_score + evaluation_data.expertise_score + evaluation_data.role_fit_score

    # Create evaluation
    try:
        recommendation = None
        if evaluation_data.recommendation:
            recommendation = Recommendation(evaluation_data.recommendation)

        evaluation = ReviewerEvaluation(
            application_id=application_id,
            reviewer_id=current_user.user_id,
            motivation_score=evaluation_data.motivation_score,
            expertise_score=evaluation_data.expertise_score,
            role_fit_score=evaluation_data.role_fit_score,
            total_score=total_score,
            comment=evaluation_data.comment,
            recommendation=recommendation
        )

        db.add(evaluation)
        await db.commit()
        await db.refresh(evaluation)
    except Exception as e:
        await db.rollback()
        import traceback
        error_detail = f"Failed to create evaluation: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    reviewer_info = ReviewerInfo(
        user_id=current_user.user_id,
        name=current_user.name or "",
        email=current_user.email
    )

    return ReviewerEvaluationResponse(
        evaluation_id=evaluation.evaluation_id,
        application_id=evaluation.application_id,
        reviewer_id=evaluation.reviewer_id,
        reviewer=reviewer_info,
        motivation_score=evaluation.motivation_score,
        expertise_score=evaluation.expertise_score,
        role_fit_score=evaluation.role_fit_score,
        total_score=evaluation.total_score,
        comment=evaluation.comment,
        recommendation=evaluation.recommendation.value if evaluation.recommendation else None,
        evaluated_at=evaluation.evaluated_at,
        updated_at=evaluation.updated_at
    )


@router.put("/applications/{application_id}/evaluations/{evaluation_id}", response_model=ReviewerEvaluationResponse)
async def update_evaluation(
    application_id: int,
    evaluation_id: int,
    evaluation_data: ReviewerEvaluationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "REVIEWER"]))
):
    """
    Update a reviewer evaluation

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, REVIEWER (own evaluation only)
    """
    result = await db.execute(
        select(ReviewerEvaluation)
        .where(ReviewerEvaluation.evaluation_id == evaluation_id)
        .where(ReviewerEvaluation.application_id == application_id)
    )
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Only owner or admin can update
    from app.core.utils import has_any_role
    if evaluation.reviewer_id != current_user.user_id and not has_any_role(current_user, ["SUPER_ADMIN", "PROJECT_MANAGER"]):
        raise HTTPException(status_code=403, detail="Cannot update other user's evaluation")

    # Update fields
    if evaluation_data.motivation_score is not None:
        evaluation.motivation_score = evaluation_data.motivation_score
    if evaluation_data.expertise_score is not None:
        evaluation.expertise_score = evaluation_data.expertise_score
    if evaluation_data.role_fit_score is not None:
        evaluation.role_fit_score = evaluation_data.role_fit_score
    if evaluation_data.comment is not None:
        evaluation.comment = evaluation_data.comment
    if evaluation_data.recommendation is not None:
        evaluation.recommendation = Recommendation(evaluation_data.recommendation)

    # Recalculate total
    evaluation.total_score = evaluation.motivation_score + evaluation.expertise_score + evaluation.role_fit_score

    await db.commit()
    await db.refresh(evaluation)

    reviewer_info = ReviewerInfo(
        user_id=current_user.user_id,
        name=current_user.name or "",
        email=current_user.email
    )

    return ReviewerEvaluationResponse(
        evaluation_id=evaluation.evaluation_id,
        application_id=evaluation.application_id,
        reviewer_id=evaluation.reviewer_id,
        reviewer=reviewer_info,
        motivation_score=evaluation.motivation_score,
        expertise_score=evaluation.expertise_score,
        role_fit_score=evaluation.role_fit_score,
        total_score=evaluation.total_score,
        comment=evaluation.comment,
        recommendation=evaluation.recommendation.value if evaluation.recommendation else None,
        evaluated_at=evaluation.evaluated_at,
        updated_at=evaluation.updated_at
    )


@router.delete("/applications/{application_id}/evaluations/{evaluation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evaluation(
    application_id: int,
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Delete a reviewer evaluation

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    result = await db.execute(
        select(ReviewerEvaluation)
        .where(ReviewerEvaluation.evaluation_id == evaluation_id)
        .where(ReviewerEvaluation.application_id == application_id)
    )
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    await db.delete(evaluation)
    await db.commit()


# ============================================================================
# Selection
# ============================================================================

@router.post("/projects/{project_id}/recommend-selection", response_model=SelectionRecommendationResponse)
async def recommend_selection(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Get selection recommendations based on scores

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Get project
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all submitted applications with scores, ordered by final_score
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.user))
        .where(Application.project_id == project_id)
        .where(Application.status.in_(['submitted', 'reviewing', 'completed']))
        .order_by(Application.final_score.desc().nullslast())
    )
    applications = result.scalars().all()

    recommendations = []
    cutoff_score = None

    for idx, app in enumerate(applications):
        # Get evaluation count
        eval_result = await db.execute(
            select(func.count(ReviewerEvaluation.evaluation_id))
            .where(ReviewerEvaluation.application_id == app.application_id)
        )
        eval_count = eval_result.scalar_one()

        # Get qualitative average
        qual_avg = await calculate_qualitative_score_average(db, app.application_id)

        recommended = idx < project.max_participants and app.final_score is not None
        if recommended and cutoff_score is None and idx == project.max_participants - 1:
            cutoff_score = app.final_score

        recommendations.append(SelectionRecommendation(
            application_id=app.application_id,
            user_id=app.user_id,
            applicant_name=app.user.name or "",
            applicant_email=app.user.email,
            applied_role=app.applied_role.value if app.applied_role else None,
            auto_score=app.auto_score,
            qualitative_score=qual_avg,
            final_score=app.final_score,
            evaluation_count=eval_count,
            current_selection_result=app.selection_result.value,
            recommended=recommended
        ))

    return SelectionRecommendationResponse(
        project_id=project_id,
        max_participants=project.max_participants,
        total_applications=len(applications),
        recommendations=recommendations,
        cutoff_score=cutoff_score
    )


@router.put("/applications/{application_id}/selection")
async def set_selection_result(
    application_id: int,
    decision: SelectionDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Set selection result for an individual application

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    application = await db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.selection_result = SelectionResult(decision.selection_result)
    await db.commit()

    return {
        "message": "Selection result updated",
        "application_id": application_id,
        "selection_result": application.selection_result.value
    }


@router.post("/projects/{project_id}/confirm-selection", response_model=BulkSelectionResponse)
async def confirm_bulk_selection(
    project_id: int,
    request: BulkSelectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Confirm selection for multiple applications

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER

    This also:
    - Updates application status to COMPLETED
    - Sends notification to all applicants about their selection result
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    selected_count = 0
    rejected_count = 0
    errors = []
    selected_apps = []
    rejected_apps = []

    # Set selected for specified applications
    for app_id in request.application_ids:
        result = await db.execute(
            select(Application)
            .where(Application.application_id == app_id)
            .where(Application.project_id == project_id)
        )
        app = result.scalar_one_or_none()
        if app:
            app.selection_result = SelectionResult.SELECTED
            app.status = ApplicationStatus.COMPLETED
            selected_count += 1
            selected_apps.append(app)
        else:
            errors.append({"application_id": app_id, "error": "Not found or wrong project"})

    # Set rejected for all other submitted applications
    result = await db.execute(
        select(Application)
        .where(Application.project_id == project_id)
        .where(Application.status.in_(['submitted', 'reviewing', 'completed']))
        .where(Application.selection_result == SelectionResult.PENDING)
        .where(Application.application_id.notin_(request.application_ids))
    )
    remaining = result.scalars().all()
    for app in remaining:
        app.selection_result = SelectionResult.REJECTED
        app.status = ApplicationStatus.COMPLETED
        rejected_count += 1
        rejected_apps.append(app)

    await db.commit()

    # Send notifications to all applicants
    for app in selected_apps:
        try:
            await send_selection_result_notification(
                db=db,
                user_id=app.user_id,
                application_id=app.application_id,
                project_id=project_id,
                project_name=project.project_name,
                is_selected=True,
                message=f"축하합니다! '{project.project_name}' 과제에 선발되었습니다."
            )
        except Exception as e:
            print(f"[SELECTION] Failed to send notification to user {app.user_id}: {e}")

    for app in rejected_apps:
        try:
            await send_selection_result_notification(
                db=db,
                user_id=app.user_id,
                application_id=app.application_id,
                project_id=project_id,
                project_name=project.project_name,
                is_selected=False,
                message=f"'{project.project_name}' 과제 선발 결과를 안내드립니다. 아쉽게도 이번에는 선발되지 않았습니다."
            )
        except Exception as e:
            print(f"[SELECTION] Failed to send notification to user {app.user_id}: {e}")

    await db.commit()

    return BulkSelectionResponse(
        project_id=project_id,
        selected_count=selected_count,
        rejected_count=rejected_count,
        errors=errors
    )


# ============================================================================
# Dashboard
# ============================================================================

@router.get("/projects/{project_id}/weights")
async def get_project_weights(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "REVIEWER"]))
):
    """
    Get project evaluation weights

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, REVIEWER
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "project_id": project_id,
        "quantitative_weight": float(project.quantitative_weight) if project.quantitative_weight else 70,
        "qualitative_weight": float(project.qualitative_weight) if project.qualitative_weight else 30
    }


@router.get("/projects/{project_id}/dashboard-stats")
async def get_dashboard_stats(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "REVIEWER"]))
):
    """
    Get review dashboard statistics for a project

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, REVIEWER
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get application counts by status
    result = await db.execute(
        select(Application)
        .where(Application.project_id == project_id)
        .where(Application.status.in_(['submitted', 'reviewing', 'completed']))
    )
    applications = result.scalars().all()

    total = len(applications)
    submitted = len([a for a in applications if a.status == ApplicationStatus.SUBMITTED])

    # Selection counts
    selected = len([a for a in applications if a.selection_result == SelectionResult.SELECTED])
    rejected = len([a for a in applications if a.selection_result == SelectionResult.REJECTED])
    pending = len([a for a in applications if a.selection_result == SelectionResult.PENDING])

    # Get evaluation counts
    eval_result = await db.execute(
        select(ReviewerEvaluation.application_id)
        .where(ReviewerEvaluation.application_id.in_([a.application_id for a in applications]))
        .distinct()
    )
    evaluated_app_ids = set(eval_result.scalars().all())
    evaluations_complete = len(evaluated_app_ids)
    evaluations_pending = total - evaluations_complete

    # Calculate averages
    auto_scores = [float(a.auto_score) for a in applications if a.auto_score is not None]
    final_scores = [float(a.final_score) for a in applications if a.final_score is not None]

    avg_auto = sum(auto_scores) / len(auto_scores) if auto_scores else None
    avg_final = sum(final_scores) / len(final_scores) if final_scores else None

    return {
        "total_applications": total,
        "submitted_count": submitted,
        "evaluations_complete": evaluations_complete,
        "evaluations_pending": evaluations_pending,
        "selected_count": selected,
        "rejected_count": rejected,
        "pending_count": pending,
        "average_auto_score": round(avg_auto, 2) if avg_auto else None,
        "average_final_score": round(avg_final, 2) if avg_final else None
    }


@router.get("/projects/{project_id}/applications-with-scores")
async def get_applications_with_scores(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "REVIEWER"]))
):
    """
    Get all applications with scores for review dashboard

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, REVIEWER
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all applications with user info
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.user))
        .where(Application.project_id == project_id)
        .where(Application.status.in_(['submitted', 'reviewing', 'completed']))
        .order_by(Application.final_score.desc().nullslast(), Application.auto_score.desc().nullslast())
    )
    applications = result.scalars().all()

    response = []
    for rank, app in enumerate(applications, 1):
        # Get evaluation count and average
        eval_result = await db.execute(
            select(func.count(ReviewerEvaluation.evaluation_id), func.avg(ReviewerEvaluation.total_score))
            .where(ReviewerEvaluation.application_id == app.application_id)
        )
        eval_row = eval_result.one()
        eval_count = eval_row[0] or 0
        qual_avg = float(eval_row[1]) if eval_row[1] else None

        response.append({
            "application_id": app.application_id,
            "user_id": app.user_id,
            "user_name": app.user.name if app.user else "",
            "user_email": app.user.email if app.user else "",
            "applied_role": app.applied_role.value if app.applied_role else None,
            "status": app.status.value,
            "auto_score": float(app.auto_score) if app.auto_score else None,
            "qualitative_avg": round(qual_avg, 2) if qual_avg else None,
            "final_score": float(app.final_score) if app.final_score else None,
            "selection_result": app.selection_result.value,
            "selection_reason": app.selection_reason if hasattr(app, 'selection_reason') else None,
            "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
            "evaluation_count": eval_count,
            "rank": rank if app.final_score is not None else None
        })

    return response

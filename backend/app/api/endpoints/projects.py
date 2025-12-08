from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.project import Project, ProjectStatus
from app.models.application import Application
from app.models.custom_question import CustomQuestion, CustomQuestionAnswer
from app.models.evaluation import CoachEvaluation
from app.models.competency import ProjectItem, ScoringCriteria, CompetencyItem
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
    ProjectListResponse,
    UserBasicInfo,
    CustomQuestionCreate,
    CustomQuestionUpdate,
    CustomQuestionResponse,
    CustomQuestionAnswerCreate,
    CustomQuestionAnswerUpdate,
    CustomQuestionAnswerResponse,
    CoachEvaluationCreate,
    CoachEvaluationUpdate,
    CoachEvaluationResponse,
)
from app.schemas.competency import (
    ProjectItemCreate,
    ProjectItemResponse,
    ScoringCriteriaCreate,
    CompetencyItemResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])


# ============================================================================
# Helper Functions
# ============================================================================
async def get_project_or_404(project_id: int, db: AsyncSession) -> Project:
    """Get project by ID or raise 404"""
    result = await db.execute(select(Project).where(Project.project_id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    return project


def check_project_manager_permission(project: Project, current_user: User):
    """Check if user is project manager or super admin"""
    import json
    user_roles = json.loads(current_user.roles)

    # Super admin can access all projects
    if "SUPER_ADMIN" in user_roles:
        return

    # Project manager can access their own projects
    if "PROJECT_MANAGER" in user_roles:
        if project.project_manager_id == current_user.user_id or project.created_by == current_user.user_id:
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not enough permissions to access this project"
    )


# ============================================================================
# Project CRUD Endpoints
# ============================================================================
@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Create a new project

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER

    **Note**: If project_manager_id is not provided, it will default to the current user's ID.
    """
    # Prepare project data
    project_dict = project_data.model_dump()

    # Auto-set project_manager_id to current user if not provided
    if project_dict.get('project_manager_id') is None:
        project_dict['project_manager_id'] = current_user.user_id

    # Create new project
    new_project = Project(
        **project_dict,
        created_by=current_user.user_id
    )

    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    return new_project


@router.get("", response_model=List[ProjectListResponse])
async def list_projects(
    status: Optional[ProjectStatus] = Query(None, description="Filter by project status"),
    manager_id: Optional[int] = Query(None, description="Filter by project manager ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of projects with optional filters

    **Permissions**:
    - SUPER_ADMIN: Can see all projects
    - PROJECT_MANAGER: Can see projects they manage or created
    - Others: Can see all projects (for application purposes)
    """
    import json
    user_roles = json.loads(current_user.roles)

    # Build query
    query = select(Project)

    # Apply filters based on user role
    if "SUPER_ADMIN" not in user_roles:
        # Non-admins can only see recruiting, reviewing, and completed projects
        # Or projects they manage
        if "PROJECT_MANAGER" in user_roles:
            query = query.where(
                or_(
                    Project.status.in_([ProjectStatus.RECRUITING, ProjectStatus.REVIEWING, ProjectStatus.COMPLETED]),
                    Project.project_manager_id == current_user.user_id,
                    Project.created_by == current_user.user_id
                )
            )
        else:
            query = query.where(
                Project.status.in_([ProjectStatus.RECRUITING, ProjectStatus.REVIEWING, ProjectStatus.COMPLETED])
            )

    # Apply additional filters
    if status:
        query = query.where(Project.status == status)
    if manager_id:
        query = query.where(Project.project_manager_id == manager_id)

    # Apply pagination
    query = query.order_by(Project.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    projects = result.scalars().all()

    # Build response with application counts
    response_list = []
    for project in projects:
        # Count applications
        count_result = await db.execute(
            select(func.count(Application.application_id)).where(
                Application.project_id == project.project_id
            )
        )
        application_count = count_result.scalar()

        response_item = ProjectListResponse(
            project_id=project.project_id,
            project_name=project.project_name,
            recruitment_start_date=project.recruitment_start_date,
            recruitment_end_date=project.recruitment_end_date,
            project_start_date=project.project_start_date,
            project_end_date=project.project_end_date,
            status=project.status,
            max_participants=project.max_participants,
            application_count=application_count,
            created_at=project.created_at
        )
        response_list.append(response_item)

    return response_list


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed project information

    **Permissions**: All authenticated users can view projects
    """
    project = await get_project_or_404(project_id, db)

    # Get creator info
    creator_result = await db.execute(
        select(User).where(User.user_id == project.created_by)
    )
    creator = creator_result.scalar_one_or_none()

    # Get project manager info
    project_manager = None
    if project.project_manager_id:
        pm_result = await db.execute(
            select(User).where(User.user_id == project.project_manager_id)
        )
        project_manager = pm_result.scalar_one_or_none()

    # Get application counts
    app_count_result = await db.execute(
        select(func.count(Application.application_id)).where(
            Application.project_id == project_id
        )
    )
    application_count = app_count_result.scalar()

    selected_count_result = await db.execute(
        select(func.count(Application.application_id)).where(
            Application.project_id == project_id,
            Application.selection_result == "selected"
        )
    )
    selected_count = selected_count_result.scalar()

    # Build response
    response = ProjectDetailResponse(
        project_id=project.project_id,
        project_name=project.project_name,
        description=project.description,
        recruitment_start_date=project.recruitment_start_date,
        recruitment_end_date=project.recruitment_end_date,
        project_start_date=project.project_start_date,
        project_end_date=project.project_end_date,
        actual_start_date=project.actual_start_date,
        actual_end_date=project.actual_end_date,
        overall_feedback=project.overall_feedback,
        status=project.status,
        max_participants=project.max_participants,
        project_manager_id=project.project_manager_id,
        created_by=project.created_by,
        created_at=project.created_at,
        updated_at=project.updated_at,
        creator=UserBasicInfo(
            user_id=creator.user_id,
            username=creator.email,
            full_name=creator.name
        ) if creator else None,
        project_manager=UserBasicInfo(
            user_id=project_manager.user_id,
            username=project_manager.email,
            full_name=project_manager.name
        ) if project_manager else None,
        application_count=application_count,
        selected_count=selected_count
    )

    return response


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Update project information

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER (only for their own projects)
    """
    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Update fields
    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Delete a project

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER (only for their own projects)
    """
    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    await db.delete(project)
    await db.commit()


# ============================================================================
# Custom Question Endpoints
# ============================================================================
@router.post("/questions", response_model=CustomQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_question(
    question_data: CustomQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Create a custom question for a project

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Verify project exists and user has permission
    project = await get_project_or_404(question_data.project_id, db)
    check_project_manager_permission(project, current_user)

    # Create question
    new_question = CustomQuestion(**question_data.model_dump())
    db.add(new_question)
    await db.commit()
    await db.refresh(new_question)

    return new_question


@router.get("/{project_id}/questions", response_model=List[CustomQuestionResponse])
async def get_project_questions(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all custom questions for a project

    **Permissions**: All authenticated users can view questions
    """
    # Verify project exists
    await get_project_or_404(project_id, db)

    # Get questions
    result = await db.execute(
        select(CustomQuestion)
        .where(CustomQuestion.project_id == project_id)
        .order_by(CustomQuestion.display_order, CustomQuestion.question_id)
    )
    questions = result.scalars().all()

    return questions


@router.put("/questions/{question_id}", response_model=CustomQuestionResponse)
async def update_custom_question(
    question_id: int,
    question_data: CustomQuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Update a custom question

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Get question
    result = await db.execute(
        select(CustomQuestion).where(CustomQuestion.question_id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question with id {question_id} not found"
        )

    # Check permission
    project = await get_project_or_404(question.project_id, db)
    check_project_manager_permission(project, current_user)

    # Update fields
    update_data = question_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)

    await db.commit()
    await db.refresh(question)

    return question


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Delete a custom question

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Get question
    result = await db.execute(
        select(CustomQuestion).where(CustomQuestion.question_id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question with id {question_id} not found"
        )

    # Check permission
    project = await get_project_or_404(question.project_id, db)
    check_project_manager_permission(project, current_user)

    await db.delete(question)
    await db.commit()


# ============================================================================
# Coach Evaluation Endpoints
# ============================================================================
@router.post("/{project_id}/evaluations", response_model=CoachEvaluationResponse, status_code=status.HTTP_201_CREATED)
async def create_coach_evaluation(
    project_id: int,
    evaluation_data: CoachEvaluationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Create coach evaluation for a project

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER

    **Evaluation Scale**:
    - 4: 매우 적극적 참여 (Very active participation)
    - 3: 원만한 참여 (Satisfactory participation)
    - 2: 적극적 참여 곤란 (Difficult to participate actively)
    - 1: 중도 이탈 (Dropped out)
    """
    # Verify project exists and user has permission
    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Verify project_id matches
    if evaluation_data.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project ID mismatch"
        )

    # Check if evaluation already exists
    existing_result = await db.execute(
        select(CoachEvaluation).where(
            CoachEvaluation.project_id == project_id,
            CoachEvaluation.coach_user_id == evaluation_data.coach_user_id
        )
    )
    existing_evaluation = existing_result.scalar_one_or_none()
    if existing_evaluation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evaluation already exists for this coach in this project"
        )

    # Create evaluation
    new_evaluation = CoachEvaluation(
        **evaluation_data.model_dump(),
        evaluated_by=current_user.user_id
    )
    db.add(new_evaluation)
    await db.commit()
    await db.refresh(new_evaluation)

    # Load relationships
    coach_result = await db.execute(
        select(User).where(User.user_id == new_evaluation.coach_user_id)
    )
    coach = coach_result.scalar_one_or_none()

    # Build response
    response = CoachEvaluationResponse(
        evaluation_id=new_evaluation.evaluation_id,
        project_id=new_evaluation.project_id,
        coach_user_id=new_evaluation.coach_user_id,
        evaluated_by=new_evaluation.evaluated_by,
        participation_score=new_evaluation.participation_score,
        feedback_text=new_evaluation.feedback_text,
        special_notes=new_evaluation.special_notes,
        evaluated_at=new_evaluation.evaluated_at,
        updated_at=new_evaluation.updated_at,
        coach=UserBasicInfo(
            user_id=coach.user_id,
            username=coach.email,
            full_name=coach.name
        ) if coach else None,
        evaluator=UserBasicInfo(
            user_id=current_user.user_id,
            username=current_user.email,
            full_name=current_user.name
        )
    )

    return response


@router.get("/{project_id}/evaluations", response_model=List[CoachEvaluationResponse])
async def get_project_evaluations(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Get all coach evaluations for a project

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Verify project exists and user has permission
    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Get evaluations
    result = await db.execute(
        select(CoachEvaluation)
        .where(CoachEvaluation.project_id == project_id)
        .order_by(CoachEvaluation.evaluated_at.desc())
    )
    evaluations = result.scalars().all()

    # Build response with user details
    response_list = []
    for evaluation in evaluations:
        # Get coach info
        coach_result = await db.execute(
            select(User).where(User.user_id == evaluation.coach_user_id)
        )
        coach = coach_result.scalar_one_or_none()

        # Get evaluator info
        evaluator_result = await db.execute(
            select(User).where(User.user_id == evaluation.evaluated_by)
        )
        evaluator = evaluator_result.scalar_one_or_none()

        response_item = CoachEvaluationResponse(
            evaluation_id=evaluation.evaluation_id,
            project_id=evaluation.project_id,
            coach_user_id=evaluation.coach_user_id,
            evaluated_by=evaluation.evaluated_by,
            participation_score=evaluation.participation_score,
            feedback_text=evaluation.feedback_text,
            special_notes=evaluation.special_notes,
            evaluated_at=evaluation.evaluated_at,
            updated_at=evaluation.updated_at,
            coach=UserBasicInfo(
                user_id=coach.user_id,
                username=coach.email,
                full_name=coach.name
            ) if coach else None,
            evaluator=UserBasicInfo(
                user_id=evaluator.user_id,
                username=evaluator.email,
                full_name=evaluator.name
            ) if evaluator else None
        )
        response_list.append(response_item)

    return response_list


@router.put("/evaluations/{evaluation_id}", response_model=CoachEvaluationResponse)
async def update_coach_evaluation(
    evaluation_id: int,
    evaluation_data: CoachEvaluationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Update coach evaluation

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Get evaluation
    result = await db.execute(
        select(CoachEvaluation).where(CoachEvaluation.evaluation_id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation with id {evaluation_id} not found"
        )

    # Check permission
    project = await get_project_or_404(evaluation.project_id, db)
    check_project_manager_permission(project, current_user)

    # Update fields
    update_data = evaluation_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(evaluation, field, value)

    await db.commit()
    await db.refresh(evaluation)

    # Load relationships for response
    coach_result = await db.execute(
        select(User).where(User.user_id == evaluation.coach_user_id)
    )
    coach = coach_result.scalar_one_or_none()

    evaluator_result = await db.execute(
        select(User).where(User.user_id == evaluation.evaluated_by)
    )
    evaluator = evaluator_result.scalar_one_or_none()

    response = CoachEvaluationResponse(
        evaluation_id=evaluation.evaluation_id,
        project_id=evaluation.project_id,
        coach_user_id=evaluation.coach_user_id,
        evaluated_by=evaluation.evaluated_by,
        participation_score=evaluation.participation_score,
        feedback_text=evaluation.feedback_text,
        special_notes=evaluation.special_notes,
        evaluated_at=evaluation.evaluated_at,
        updated_at=evaluation.updated_at,
        coach=UserBasicInfo(
            user_id=coach.user_id,
            username=coach.email,
            full_name=coach.name
        ) if coach else None,
        evaluator=UserBasicInfo(
            user_id=evaluator.user_id,
            username=evaluator.email,
            full_name=evaluator.name
        ) if evaluator else None
    )

    return response


@router.delete("/evaluations/{evaluation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coach_evaluation(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Delete coach evaluation

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Get evaluation
    result = await db.execute(
        select(CoachEvaluation).where(CoachEvaluation.evaluation_id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation with id {evaluation_id} not found"
        )

    # Check permission
    project = await get_project_or_404(evaluation.project_id, db)
    check_project_manager_permission(project, current_user)

    await db.delete(evaluation)
    await db.commit()


# ============================================================================
# Project Items (설문항목) Endpoints
# ============================================================================
@router.get("/{project_id}/items", response_model=List[ProjectItemResponse])
async def get_project_items(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all items (설문항목) for a project

    Returns both information items and evaluation items with their scoring criteria.
    """
    # Check if project exists
    project = await get_project_or_404(project_id, db)

    # Get project items with relationships
    result = await db.execute(
        select(ProjectItem)
        .where(ProjectItem.project_id == project_id)
        .order_by(ProjectItem.display_order)
    )
    project_items = result.scalars().all()

    # Load relationships
    from sqlalchemy.orm import selectinload
    response_items = []
    for item in project_items:
        # Load competency item with fields
        competency_result = await db.execute(
            select(CompetencyItem)
            .where(CompetencyItem.item_id == item.item_id)
            .options(selectinload(CompetencyItem.fields))
        )
        competency_item = competency_result.scalar_one_or_none()

        # Skip items with deleted competency items
        if competency_item is None:
            # Delete orphaned project item
            await db.delete(item)
            continue

        # Load scoring criteria
        criteria_result = await db.execute(
            select(ScoringCriteria).where(ScoringCriteria.project_item_id == item.project_item_id)
        )
        scoring_criteria = criteria_result.scalars().all()

        # Build response
        item_dict = {
            "project_item_id": item.project_item_id,
            "project_id": item.project_id,
            "item_id": item.item_id,
            "is_required": item.is_required,
            "proof_required_level": item.proof_required_level,
            "max_score": item.max_score,
            "display_order": item.display_order,
            "competency_item": competency_item,
            "scoring_criteria": scoring_criteria
        }
        response_items.append(item_dict)

    # Commit any deletions of orphaned items
    await db.commit()

    return response_items


@router.post("/{project_id}/items", response_model=ProjectItemResponse, status_code=status.HTTP_201_CREATED)
async def add_project_item(
    project_id: int,
    item_data: ProjectItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Add a competency item to project (설문항목 추가)

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Check project and permission
    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Check if competency item exists
    competency_result = await db.execute(
        select(CompetencyItem).where(CompetencyItem.item_id == item_data.item_id)
    )
    competency_item = competency_result.scalar_one_or_none()
    if not competency_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Competency item with id {item_data.item_id} not found"
        )

    # Check if item already added to project
    existing_result = await db.execute(
        select(ProjectItem).where(
            ProjectItem.project_id == project_id,
            ProjectItem.item_id == item_data.item_id
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This item is already added to the project"
        )

    # Create project item
    new_item = ProjectItem(
        project_id=project_id,
        item_id=item_data.item_id,
        is_required=item_data.is_required,
        proof_required_level=item_data.proof_required_level,
        max_score=item_data.max_score,
        display_order=item_data.display_order
    )
    db.add(new_item)
    await db.flush()

    # Add scoring criteria
    for criteria_data in item_data.scoring_criteria:
        criteria = ScoringCriteria(
            project_item_id=new_item.project_item_id,
            matching_type=criteria_data.matching_type,
            expected_value=criteria_data.expected_value,
            score=criteria_data.score
        )
        db.add(criteria)

    await db.commit()
    await db.refresh(new_item)

    # Load relationships for response (with fields for CompetencyItem)
    from sqlalchemy.orm import selectinload
    competency_result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == new_item.item_id)
        .options(selectinload(CompetencyItem.fields))
    )
    competency_item = competency_result.scalar_one_or_none()

    criteria_result = await db.execute(
        select(ScoringCriteria).where(ScoringCriteria.project_item_id == new_item.project_item_id)
    )
    scoring_criteria = criteria_result.scalars().all()

    return ProjectItemResponse(
        project_item_id=new_item.project_item_id,
        project_id=new_item.project_id,
        item_id=new_item.item_id,
        is_required=new_item.is_required,
        proof_required_level=new_item.proof_required_level,
        max_score=new_item.max_score,
        display_order=new_item.display_order,
        competency_item=competency_item,
        scoring_criteria=scoring_criteria
    )


@router.put("/{project_id}/items/{project_item_id}", response_model=ProjectItemResponse)
async def update_project_item(
    project_id: int,
    project_item_id: int,
    item_data: ProjectItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Update a project item (설문항목 수정)

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Check project and permission
    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Get project item
    result = await db.execute(
        select(ProjectItem).where(
            ProjectItem.project_item_id == project_item_id,
            ProjectItem.project_id == project_id
        )
    )
    project_item = result.scalar_one_or_none()
    if not project_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project item with id {project_item_id} not found"
        )

    # Update fields
    project_item.is_required = item_data.is_required
    project_item.proof_required_level = item_data.proof_required_level
    project_item.max_score = item_data.max_score
    project_item.display_order = item_data.display_order

    # Delete existing scoring criteria
    await db.execute(
        select(ScoringCriteria).where(ScoringCriteria.project_item_id == project_item_id)
    )
    existing_criteria = await db.execute(
        select(ScoringCriteria).where(ScoringCriteria.project_item_id == project_item_id)
    )
    for criteria in existing_criteria.scalars():
        await db.delete(criteria)

    # Add new scoring criteria
    for criteria_data in item_data.scoring_criteria:
        criteria = ScoringCriteria(
            project_item_id=project_item.project_item_id,
            matching_type=criteria_data.matching_type,
            expected_value=criteria_data.expected_value,
            score=criteria_data.score
        )
        db.add(criteria)

    await db.commit()
    await db.refresh(project_item)

    # Load relationships for response (with fields for CompetencyItem)
    from sqlalchemy.orm import selectinload
    competency_result = await db.execute(
        select(CompetencyItem)
        .where(CompetencyItem.item_id == project_item.item_id)
        .options(selectinload(CompetencyItem.fields))
    )
    competency_item = competency_result.scalar_one_or_none()

    criteria_result = await db.execute(
        select(ScoringCriteria).where(ScoringCriteria.project_item_id == project_item.project_item_id)
    )
    scoring_criteria = criteria_result.scalars().all()

    return ProjectItemResponse(
        project_item_id=project_item.project_item_id,
        project_id=project_item.project_id,
        item_id=project_item.item_id,
        is_required=project_item.is_required,
        proof_required_level=project_item.proof_required_level,
        max_score=project_item.max_score,
        display_order=project_item.display_order,
        competency_item=competency_item,
        scoring_criteria=scoring_criteria
    )


@router.delete("/{project_id}/items/{project_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_item(
    project_id: int,
    project_item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Delete a project item (설문항목 삭제)

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    # Check project and permission
    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Get project item
    result = await db.execute(
        select(ProjectItem).where(
            ProjectItem.project_item_id == project_item_id,
            ProjectItem.project_id == project_id
        )
    )
    project_item = result.scalar_one_or_none()
    if not project_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project item with id {project_item_id} not found"
        )

    await db.delete(project_item)
    await db.commit()


from pydantic import BaseModel
from decimal import Decimal

class ScoreValidationResponse(BaseModel):
    """Score validation response"""
    is_valid: bool
    total_score: Decimal
    missing_score: Decimal
    message: str


@router.post("/{project_id}/validate-score", response_model=ScoreValidationResponse)
async def validate_project_score(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validate that total evaluation score equals 100 points

    Checks both ProjectItems and CustomQuestions that are evaluation items.
    """
    # Check if project exists
    project = await get_project_or_404(project_id, db)

    # Get all project items with scores
    project_items_result = await db.execute(
        select(ProjectItem)
        .where(
            ProjectItem.project_id == project_id,
            ProjectItem.max_score.isnot(None)
        )
    )
    project_items = project_items_result.scalars().all()

    # Get all custom questions that are evaluation items
    custom_questions_result = await db.execute(
        select(CustomQuestion)
        .where(
            CustomQuestion.project_id == project_id,
            CustomQuestion.is_evaluation_item == True,
            CustomQuestion.max_score.isnot(None)
        )
    )
    custom_questions = custom_questions_result.scalars().all()

    # Calculate total score
    total_score = Decimal(0)
    for item in project_items:
        if item.max_score:
            total_score += item.max_score

    for question in custom_questions:
        if question.max_score:
            total_score += question.max_score

    # Validate
    target_score = Decimal(100)
    is_valid = total_score == target_score
    missing_score = target_score - total_score

    if is_valid:
        message = "평가 점수 합산이 정확히 100점입니다."
    elif total_score > target_score:
        message = f"평가 점수 합산이 100점을 {abs(missing_score)}점 초과했습니다."
    else:
        message = f"평가 점수 합산이 100점에 {abs(missing_score)}점 부족합니다."

    return ScoreValidationResponse(
        is_valid=is_valid,
        total_score=total_score,
        missing_score=missing_score,
        message=message
    )

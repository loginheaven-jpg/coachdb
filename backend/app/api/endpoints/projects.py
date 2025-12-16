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
# Test Project Creation
# ============================================================================
@router.post("/create-test", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_test_project(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))  # SUPER_ADMIN만 허용
):
    """
    Create a test project with realistic content and survey items

    **Required roles**: SUPER_ADMIN only

    Creates a project with:
    - 2-week recruitment period starting from today
    - Realistic project name and description
    - Default survey items (100 points total)
    - Status set to 'ready' (정식저장 완료)
    """
    import traceback
    from datetime import datetime, timedelta
    from decimal import Decimal
    from app.schemas.project import calculate_display_status
    from app.models.competency import ProofRequiredLevel
    import random

    try:
        # Test project templates with realistic content
        test_projects = [
            {
                "name": "2025년 상반기 청년 취업 지원 코칭 프로그램",
                "description": "본 프로그램은 취업 준비 중인 청년들의 역량 강화와 성공적인 취업을 지원하기 위한 전문 코칭 사업입니다. KAC 이상 코칭 자격 보유 및 취업/진로 코칭 경험 1년 이상인 코치를 모집합니다.",
                "max_participants": 30
            },
            {
                "name": "리더십 역량 강화 그룹 코칭 프로젝트",
                "description": "조직 내 중간관리자의 리더십 역량 개발을 위한 그룹 코칭 프로그램입니다. KPC 또는 PCC 이상 자격 보유자, 기업 코칭 경험 3년 이상, 그룹 코칭 퍼실리테이션 경험 필수입니다.",
                "max_participants": 15
            },
            {
                "name": "경력 단절 여성 재취업 지원 코칭",
                "description": "출산, 육아 등으로 경력이 단절된 여성들의 성공적인 재취업을 돕는 맞춤형 코칭 프로그램입니다. 진로/취업 코칭 전문성 보유 및 공감 능력이 뛰어난 코치를 모집합니다.",
                "max_participants": 25
            },
            {
                "name": "스타트업 대표 성장 코칭 프로그램",
                "description": "초기 스타트업 대표들의 비즈니스 성장과 리더십 개발을 지원하는 1:1 전문 코칭입니다. 비즈니스 코칭 경력 5년 이상, 경영/창업 관련 실무 경험 보유자를 모집합니다.",
                "max_participants": 10
            },
            {
                "name": "청소년 진로탐색 그룹 코칭",
                "description": "중고등학생들의 자기 이해와 미래 진로 탐색을 돕는 그룹 코칭 프로그램입니다. 청소년 코칭 경험 보유 및 아동청소년 상담 관련 자격 우대합니다.",
                "max_participants": 20
            }
        ]

        # Select random template
        template = random.choice(test_projects)

        # Set dates
        today = datetime.now().date()
        recruitment_end = today + timedelta(days=14)
        project_start = recruitment_end + timedelta(days=7)
        project_end = project_start + timedelta(days=90)

        # Create project with READY status (정식저장 완료)
        new_project = Project(
            project_name=template["name"],
            description=template["description"],
            recruitment_start_date=today,
            recruitment_end_date=recruitment_end,
            project_start_date=project_start,
            project_end_date=project_end,
            max_participants=template["max_participants"],
            status=ProjectStatus.READY,  # 정식저장 완료 상태
            project_manager_id=current_user.user_id,
            created_by=current_user.user_id
        )

        db.add(new_project)
        await db.commit()
        await db.refresh(new_project)

        # Add default survey items (인적사항 + 평가항목 100점)
        # DB에 존재하는 item_code를 동적으로 조회
        # 먼저 사용 가능한 평가 항목들을 조회
        result = await db.execute(
            select(CompetencyItem).where(
                CompetencyItem.is_active == True,
                CompetencyItem.category.in_(['EDUCATION', 'ADDON', 'DETAIL'])
            ).limit(4)
        )
        available_items = result.scalars().all()

        print(f"[CREATE-TEST] Found {len(available_items)} competency items")

        if available_items:
            # 점수 배분: 항목 수에 따라 100점 분배
            item_count = len(available_items)
            base_score = Decimal("100") / item_count
            remainder = Decimal("100") - (base_score * item_count)

            display_order = 1
            for i, comp_item in enumerate(available_items):
                # 마지막 항목에 나머지 점수 추가
                score = base_score + (remainder if i == item_count - 1 else Decimal("0"))
                project_item = ProjectItem(
                    project_id=new_project.project_id,
                    item_id=comp_item.item_id,
                    is_required=True,
                    proof_required_level=ProofRequiredLevel.OPTIONAL,
                    max_score=score.quantize(Decimal("0.01")),
                    display_order=display_order
                )
                db.add(project_item)
                print(f"[CREATE-TEST] Added item: {comp_item.item_code} with score {score}")
                display_order += 1

            await db.commit()
        else:
            print("[CREATE-TEST] No competency items found in database")

        await db.refresh(new_project)

        # display_status 계산
        display_status = calculate_display_status(
            new_project.status,
            new_project.recruitment_start_date,
            new_project.recruitment_end_date
        )

        return ProjectResponse(
            project_id=new_project.project_id,
            project_name=new_project.project_name,
            description=new_project.description,
            support_program_name=new_project.support_program_name,
            recruitment_start_date=new_project.recruitment_start_date,
            recruitment_end_date=new_project.recruitment_end_date,
            project_start_date=new_project.project_start_date,
            project_end_date=new_project.project_end_date,
            max_participants=new_project.max_participants,
            project_manager_id=new_project.project_manager_id,
            status=new_project.status,
            display_status=display_status,
            actual_start_date=new_project.actual_start_date,
            actual_end_date=new_project.actual_end_date,
            overall_feedback=new_project.overall_feedback,
            created_by=new_project.created_by,
            created_at=new_project.created_at,
            updated_at=new_project.updated_at
        )
    except Exception as e:
        print(f"[CREATE-TEST ERROR] user_id={current_user.user_id}")
        print(f"[CREATE-TEST ERROR] Exception: {type(e).__name__}: {str(e)}")
        print(f"[CREATE-TEST ERROR] Traceback:\n{traceback.format_exc()}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create test project: {str(e)}"
        )


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
    from app.core.utils import get_user_roles
    user_roles = get_user_roles(current_user)

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

    **Notes**:
    - 새 과제는 항상 DRAFT(초안) 상태로 생성됩니다.
    - READY 상태로 전환하려면 /finalize 엔드포인트를 사용하세요. (100점 검증 필요)
    - project_manager_id가 제공되지 않으면 현재 사용자 ID로 설정됩니다.
    """
    from app.schemas.project import calculate_display_status

    # Prepare project data
    project_dict = project_data.model_dump()

    # Auto-set project_manager_id to current user if not provided
    if project_dict.get('project_manager_id') is None:
        project_dict['project_manager_id'] = current_user.user_id

    # 항상 DRAFT 상태로 생성 (status 필드 무시)
    project_dict['status'] = ProjectStatus.DRAFT

    # Create new project
    new_project = Project(
        **project_dict,
        created_by=current_user.user_id
    )

    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    # display_status 계산
    display_status = calculate_display_status(
        new_project.status,
        new_project.recruitment_start_date,
        new_project.recruitment_end_date
    )

    return ProjectResponse(
        project_id=new_project.project_id,
        project_name=new_project.project_name,
        description=new_project.description,
        support_program_name=new_project.support_program_name,
        recruitment_start_date=new_project.recruitment_start_date,
        recruitment_end_date=new_project.recruitment_end_date,
        project_start_date=new_project.project_start_date,
        project_end_date=new_project.project_end_date,
        max_participants=new_project.max_participants,
        project_manager_id=new_project.project_manager_id,
        status=new_project.status,
        display_status=display_status,
        actual_start_date=new_project.actual_start_date,
        actual_end_date=new_project.actual_end_date,
        overall_feedback=new_project.overall_feedback,
        created_by=new_project.created_by,
        created_at=new_project.created_at,
        updated_at=new_project.updated_at
    )


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
    import traceback
    from app.core.utils import get_user_roles
    from app.schemas.project import calculate_display_status

    try:
        user_roles = get_user_roles(current_user)
        print(f"[LIST PROJECTS] user_id={current_user.user_id}, roles={user_roles}")

        # Build query
        query = select(Project)

        # Apply filters based on user role
        from datetime import date
        today = date.today()

        if "SUPER_ADMIN" not in user_roles:
            if "PROJECT_MANAGER" in user_roles:
                # Project managers can see:
                # 1. Their own projects (any status) - for management
                # 2. Recruiting projects - for reference
                query = query.where(
                    or_(
                        # Own projects (any status)
                        Project.project_manager_id == current_user.user_id,
                        Project.created_by == current_user.user_id,
                        # Currently recruiting projects (READY or legacy RECRUITING status)
                        (
                            (Project.status == ProjectStatus.READY) &
                            (Project.recruitment_start_date <= today) &
                            (Project.recruitment_end_date >= today)
                        ),
                        # Legacy: RECRUITING status (backward compatibility)
                        Project.status == ProjectStatus.RECRUITING
                    )
                )
            else:
                # Regular coaches only see currently recruiting projects
                query = query.where(
                    or_(
                        # READY status + within recruitment dates = display_status "recruiting"
                        (
                            (Project.status == ProjectStatus.READY) &
                            (Project.recruitment_start_date <= today) &
                            (Project.recruitment_end_date >= today)
                        ),
                        # Legacy: RECRUITING status (backward compatibility)
                        Project.status == ProjectStatus.RECRUITING
                    )
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
        print(f"[LIST PROJECTS] Found {len(projects)} projects")

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

            # display_status 계산
            display_status = calculate_display_status(
                project.status,
                project.recruitment_start_date,
                project.recruitment_end_date
            )

            # Count confirmed participants (selected applications)
            confirmed_result = await db.execute(
                select(func.count(Application.application_id)).where(
                    Application.project_id == project.project_id,
                    Application.selection_result == "selected"
                )
            )
            current_participants = confirmed_result.scalar() or 0

            response_item = ProjectListResponse(
                project_id=project.project_id,
                project_name=project.project_name,
                recruitment_start_date=project.recruitment_start_date,
                recruitment_end_date=project.recruitment_end_date,
                project_start_date=project.project_start_date,
                project_end_date=project.project_end_date,
                status=project.status,
                display_status=display_status,
                max_participants=project.max_participants,
                application_count=application_count,
                current_participants=current_participants,
                created_by=project.created_by,
                project_manager_id=project.project_manager_id,
                created_at=project.created_at
            )
            response_list.append(response_item)

        return response_list
    except Exception as e:
        print(f"[LIST PROJECTS ERROR] user_id={current_user.user_id}")
        print(f"[LIST PROJECTS ERROR] Exception: {type(e).__name__}: {str(e)}")
        print(f"[LIST PROJECTS ERROR] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list projects: {str(e)}"
        )


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
    from app.schemas.project import calculate_display_status

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

    # Calculate display_status
    display_status = calculate_display_status(
        project.status,
        project.recruitment_start_date,
        project.recruitment_end_date
    )

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
        display_status=display_status,
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

    **Note**: 상태(status) 변경은 이 엔드포인트로 할 수 없습니다.
    - DRAFT → READY: POST /projects/{id}/finalize 사용
    - READY → DRAFT: POST /projects/{id}/unpublish 사용
    """
    from app.schemas.project import calculate_display_status

    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Update fields
    update_data = project_data.model_dump(exclude_unset=True)

    # status 변경 시도 차단 (finalize/unpublish 엔드포인트 사용 필요)
    if 'status' in update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="상태 변경은 이 엔드포인트로 할 수 없습니다. DRAFT→READY: /finalize, READY→DRAFT: /unpublish 사용"
        )

    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    # Calculate display_status
    display_status = calculate_display_status(
        project.status,
        project.recruitment_start_date,
        project.recruitment_end_date
    )

    return ProjectResponse(
        project_id=project.project_id,
        project_name=project.project_name,
        description=project.description,
        support_program_name=project.support_program_name,
        recruitment_start_date=project.recruitment_start_date,
        recruitment_end_date=project.recruitment_end_date,
        project_start_date=project.project_start_date,
        project_end_date=project.project_end_date,
        max_participants=project.max_participants,
        project_manager_id=project.project_manager_id,
        status=project.status,
        display_status=display_status,
        actual_start_date=project.actual_start_date,
        actual_end_date=project.actual_end_date,
        overall_feedback=project.overall_feedback,
        created_by=project.created_by,
        created_at=project.created_at,
        updated_at=project.updated_at
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Delete a project and all related data

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER (only for their own projects)
    """
    import traceback
    from sqlalchemy import delete, text

    try:
        project = await get_project_or_404(project_id, db)
        check_project_manager_permission(project, current_user)

        print(f"[DELETE PROJECT] Deleting project_id={project_id} by user_id={current_user.user_id}")

        # 명시적으로 관련 데이터 삭제 (CASCADE가 DB에서 동작하지 않을 경우 대비)
        # 순서: 가장 깊은 중첩부터 삭제

        # 1. ApplicationData 삭제 (Application의 자식)
        await db.execute(text("""
            DELETE FROM application_data
            WHERE application_id IN (
                SELECT application_id FROM applications WHERE project_id = :project_id
            )
        """), {"project_id": project_id})

        # 2. CustomQuestionAnswer 삭제 (Application의 자식)
        await db.execute(text("""
            DELETE FROM custom_question_answers
            WHERE application_id IN (
                SELECT application_id FROM applications WHERE project_id = :project_id
            )
        """), {"project_id": project_id})

        # 3. ReviewLock 삭제 (Application의 자식)
        await db.execute(text("""
            DELETE FROM review_locks
            WHERE application_id IN (
                SELECT application_id FROM applications WHERE project_id = :project_id
            )
        """), {"project_id": project_id})

        # 4. Applications 삭제
        await db.execute(text("""
            DELETE FROM applications WHERE project_id = :project_id
        """), {"project_id": project_id})

        # 5. ScoringCriteria 삭제 (ProjectItem의 자식)
        await db.execute(text("""
            DELETE FROM scoring_criteria
            WHERE project_item_id IN (
                SELECT project_item_id FROM project_items WHERE project_id = :project_id
            )
        """), {"project_id": project_id})

        # 6. ProjectItems 삭제
        await db.execute(text("""
            DELETE FROM project_items WHERE project_id = :project_id
        """), {"project_id": project_id})

        # 7. CustomQuestions 삭제
        await db.execute(text("""
            DELETE FROM custom_questions WHERE project_id = :project_id
        """), {"project_id": project_id})

        # 8. CoachEvaluations 삭제
        await db.execute(text("""
            DELETE FROM coach_evaluations WHERE project_id = :project_id
        """), {"project_id": project_id})

        # 9. ProjectStaff 삭제
        await db.execute(text("""
            DELETE FROM project_staff WHERE project_id = :project_id
        """), {"project_id": project_id})

        # 10. Notification의 related_project_id를 NULL로 설정
        await db.execute(text("""
            UPDATE notifications SET related_project_id = NULL WHERE related_project_id = :project_id
        """), {"project_id": project_id})

        # 11. 마지막으로 Project 삭제
        await db.execute(text("""
            DELETE FROM projects WHERE project_id = :project_id
        """), {"project_id": project_id})

        await db.commit()
        print(f"[DELETE PROJECT] Successfully deleted project_id={project_id}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[DELETE PROJECT ERROR] project_id={project_id}, user_id={current_user.user_id}")
        print(f"[DELETE PROJECT ERROR] Exception: {type(e).__name__}: {str(e)}")
        print(f"[DELETE PROJECT ERROR] Traceback:\n{traceback.format_exc()}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        )


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


@router.post("/{project_id}/finalize", response_model=ProjectResponse)
async def finalize_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    정식저장 - 모든 조건 검증 후 ready 상태로 전환

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER (only for their own projects)

    조건:
    1. 과제 기간 입력 완료 (project_start_date, project_end_date)
    2. 설문 점수 100점
    """
    from app.schemas.project import calculate_display_status

    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # 1. 과제 기간 검증
    if not project.project_start_date or not project.project_end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="과제 기간을 입력해주세요. (시작일, 종료일 모두 필요)"
        )

    # 1-1. 모집 기간 검증
    if not project.recruitment_start_date or not project.recruitment_end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="모집 기간을 입력해주세요. (모집시작일, 모집종료일 모두 필요)"
        )

    # 2. 점수 검증
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

    if total_score != Decimal(100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"설문 점수가 100점이 아닙니다. 현재: {total_score}점"
        )

    # 3. 상태를 ready로 변경
    project.status = ProjectStatus.READY
    await db.commit()
    await db.refresh(project)

    # display_status 계산
    display_status = calculate_display_status(
        project.status,
        project.recruitment_start_date,
        project.recruitment_end_date
    )

    return ProjectResponse(
        project_id=project.project_id,
        project_name=project.project_name,
        description=project.description,
        support_program_name=project.support_program_name,
        recruitment_start_date=project.recruitment_start_date,
        recruitment_end_date=project.recruitment_end_date,
        project_start_date=project.project_start_date,
        project_end_date=project.project_end_date,
        max_participants=project.max_participants,
        project_manager_id=project.project_manager_id,
        status=project.status,
        display_status=display_status,
        actual_start_date=project.actual_start_date,
        actual_end_date=project.actual_end_date,
        overall_feedback=project.overall_feedback,
        created_by=project.created_by,
        created_at=project.created_at,
        updated_at=project.updated_at
    )


@router.post("/{project_id}/unpublish", response_model=ProjectResponse)
async def unpublish_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    초안으로 되돌리기 - READY 상태를 DRAFT로 변경

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER (only for their own projects)

    모집중인 과제도 수정이 필요할 때 일시적으로 초안으로 되돌릴 수 있습니다.
    초안 상태에서는 코치들에게 보이지 않습니다.
    """
    from app.schemas.project import calculate_display_status

    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Only READY status can be reverted to DRAFT
    if project.status != ProjectStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"READY 상태의 과제만 초안으로 되돌릴 수 있습니다. 현재 상태: {project.status.value}"
        )

    # Revert to DRAFT status
    project.status = ProjectStatus.DRAFT
    await db.commit()
    await db.refresh(project)

    # display_status 계산
    display_status = calculate_display_status(
        project.status,
        project.recruitment_start_date,
        project.recruitment_end_date
    )

    return ProjectResponse(
        project_id=project.project_id,
        project_name=project.project_name,
        description=project.description,
        support_program_name=project.support_program_name,
        recruitment_start_date=project.recruitment_start_date,
        recruitment_end_date=project.recruitment_end_date,
        project_start_date=project.project_start_date,
        project_end_date=project.project_end_date,
        max_participants=project.max_participants,
        project_manager_id=project.project_manager_id,
        status=project.status,
        display_status=display_status,
        actual_start_date=project.actual_start_date,
        actual_end_date=project.actual_end_date,
        overall_feedback=project.overall_feedback,
        created_by=project.created_by,
        created_at=project.created_at,
        updated_at=project.updated_at
    )

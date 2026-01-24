from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional
import logging

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.utils import get_user_roles
from app.models.user import User, UserStatus
from app.models.project import Project, ProjectStatus, ProjectStaff
from app.models.application import Application, ApplicationData, ApplicationStatus, DocumentStatus, SelectionResult
from datetime import datetime
from app.models.custom_question import CustomQuestion, CustomQuestionAnswer
from app.models.evaluation import CoachEvaluation
from app.models.competency import ProjectItem, ScoringCriteria, CompetencyItem, CoachCompetency, ProofRequiredLevel
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
    ProjectStaffCreate,
    ProjectStaffResponse,
    ProjectStaffListResponse,
    ProjectCopyRequest,
    ProjectCopyResponse,
)
from app.schemas.competency import (
    ProjectItemCreate,
    ProjectItemResponse,
    ScoringCriteriaCreate,
    CompetencyItemResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])

# Logger for project creation tracking
logger = logging.getLogger(__name__)

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
    from app.models.competency import ProofRequiredLevel, CompetencyCategory
    import random

    print(f"[CREATE-TEST] === Starting test project creation for user_id={current_user.user_id} ===")

    try:
        # Step 1: Prepare template
        print("[CREATE-TEST] Step 1: Preparing template...")
        test_projects = [
            {
                "name": "2025년 상반기 청년 취업 지원 코칭 프로그램",
                "description": "본 프로그램은 취업 준비 중인 청년들의 역량 강화와 성공적인 취업을 지원하기 위한 전문 코칭 사업입니다.",
                "max_participants": 30
            },
            {
                "name": "리더십 역량 강화 그룹 코칭 프로젝트",
                "description": "조직 내 중간관리자의 리더십 역량 개발을 위한 그룹 코칭 프로그램입니다.",
                "max_participants": 15
            },
            {
                "name": "경력 단절 여성 재취업 지원 코칭",
                "description": "경력이 단절된 여성들의 성공적인 재취업을 돕는 맞춤형 코칭 프로그램입니다.",
                "max_participants": 25
            },
        ]
        template = random.choice(test_projects)
        print(f"[CREATE-TEST] Selected template: {template['name']}")

        # Step 2: Set dates
        print("[CREATE-TEST] Step 2: Setting dates...")
        today = datetime.now().date()
        recruitment_end = today + timedelta(days=14)
        project_start = recruitment_end + timedelta(days=7)
        project_end = project_start + timedelta(days=90)
        print(f"[CREATE-TEST] Dates: today={today}, recruitment_end={recruitment_end}")

        # Step 3: Create project object
        print("[CREATE-TEST] Step 3: Creating project object...")
        new_project = Project(
            project_name=template["name"],
            description=template["description"],
            recruitment_start_date=today,
            recruitment_end_date=recruitment_end,
            project_start_date=project_start,
            project_end_date=project_end,
            max_participants=template["max_participants"],
            status=ProjectStatus.READY,
            project_manager_id=current_user.user_id,
            created_by=current_user.user_id
        )
        print(f"[CREATE-TEST] Project object created with status={new_project.status}")

        # Step 4: Save project to DB
        print("[CREATE-TEST] Step 4: Saving project to database...")
        db.add(new_project)
        await db.commit()
        await db.refresh(new_project)
        print(f"[CREATE-TEST] Project saved with id={new_project.project_id}")

        # Step 5: Query competency items (use enum values for comparison)
        print("[CREATE-TEST] Step 5: Querying competency items...")
        try:
            # 먼저 전체 항목 수 확인
            count_result = await db.execute(select(func.count(CompetencyItem.item_id)))
            total_count = count_result.scalar()
            print(f"[CREATE-TEST] Total competency items in DB: {total_count}")

            # Enum 값으로 비교
            result = await db.execute(
                select(CompetencyItem).where(
                    CompetencyItem.is_active == True
                ).limit(4)
            )
            available_items = result.scalars().all()
            print(f"[CREATE-TEST] Found {len(available_items)} active competency items")

            for item in available_items:
                print(f"[CREATE-TEST]   - {item.item_code} (category={item.category})")

        except Exception as query_err:
            print(f"[CREATE-TEST] Error querying competency items: {query_err}")
            available_items = []

        # Step 6: Add project items
        print("[CREATE-TEST] Step 6: Adding project items...")
        if available_items:
            item_count = len(available_items)
            base_score = Decimal("100") / item_count
            remainder = Decimal("100") - (base_score * item_count)

            display_order = 1
            for i, comp_item in enumerate(available_items):
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
            print("[CREATE-TEST] Project items committed")
        else:
            print("[CREATE-TEST] WARNING: No competency items found, project will have 0 survey items")

        # Step 7: Refresh and prepare response
        print("[CREATE-TEST] Step 7: Preparing response...")
        await db.refresh(new_project)

        display_status = calculate_display_status(
            new_project.status,
            new_project.recruitment_start_date,
            new_project.recruitment_end_date
        )
        print(f"[CREATE-TEST] display_status={display_status}")

        # Log project creation for tracking
        logger.info(f"[PROJECT_CREATE] name='{new_project.project_name}', id={new_project.project_id}, creator={current_user.email}, status={new_project.status}, endpoint='/projects/create-test'")

        response = ProjectResponse(
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

        print(f"[CREATE-TEST] === SUCCESS: Created project {new_project.project_id} ===")
        return response

    except Exception as e:
        print(f"[CREATE-TEST ERROR] ==========================================")
        print(f"[CREATE-TEST ERROR] user_id={current_user.user_id}")
        print(f"[CREATE-TEST ERROR] Exception type: {type(e).__name__}")
        print(f"[CREATE-TEST ERROR] Exception message: {str(e)}")
        print(f"[CREATE-TEST ERROR] Traceback:\n{traceback.format_exc()}")
        print(f"[CREATE-TEST ERROR] ==========================================")
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create test project: {type(e).__name__}: {str(e)}"
        )


# ============================================================================
# Test Project with Applications
# ============================================================================
@router.post("/create-test-with-applications", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_test_project_with_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    Create a test project with 1 submitted application for verification and review testing

    **Required roles**: SUPER_ADMIN only

    Creates:
    - Test project in 'reviewing' status
    - 1 test user (test_user_1@test.com) with 1 competency item
    - Application with verification_status='pending' (검토미완료)
    - viproject@naver.com as the reviewer
    """
    import traceback
    from datetime import datetime, timedelta
    from decimal import Decimal
    from app.schemas.project import calculate_display_status
    from app.models.competency import ProofRequiredLevel
    from app.core.security import get_password_hash
    from app.models.application import CoachRole
    import random
    import json

    print(f"[CREATE-TEST-APPS] === Starting test project with applications for user_id={current_user.user_id} ===")

    try:
        # Step 1: Create project
        print("[CREATE-TEST-APPS] Step 1: Creating project...")
        today = datetime.now().date()
        recruitment_end = today - timedelta(days=1)  # Already ended
        recruitment_start = recruitment_end - timedelta(days=14)
        project_start = today + timedelta(days=7)
        project_end = project_start + timedelta(days=90)

        new_project = Project(
            project_name=f"[테스트] 검토/심사 테스트 - 응모자 1명",
            description="검토 및 심사개시 기능 테스트용 과제입니다. 1명의 응모자가 검토미완료 상태로 제출되어 있습니다.",
            recruitment_start_date=recruitment_start,
            recruitment_end_date=recruitment_end,
            project_start_date=project_start,
            project_end_date=project_end,
            max_participants=5,
            status=ProjectStatus.REVIEWING,
            project_manager_id=current_user.user_id,
            created_by=current_user.user_id
        )
        db.add(new_project)
        await db.commit()
        await db.refresh(new_project)
        print(f"[CREATE-TEST-APPS] Project created: id={new_project.project_id}")

        # Step 2: Add survey items with GRADE scoring criteria
        print("[CREATE-TEST-APPS] Step 2: Adding survey items with GRADE scoring...")
        from app.models.competency import CompetencyItem, MatchingType, ValueSourceType

        # 특정 항목들을 선택 (현재 항목 구조에 맞게 업데이트)
        priority_codes = ['CERT_COACH', 'EDU_COACHING', 'EXP_COACHING_TRAINING', 'EXP_COACHING_HOURS']
        result = await db.execute(
            select(CompetencyItem)
            .where(CompetencyItem.is_active == True)
            .where(CompetencyItem.item_code.in_(priority_codes))
        )
        selected_items = result.scalars().all()

        # 부족하면 추가 항목 선택
        if len(selected_items) < 4:
            result = await db.execute(
                select(CompetencyItem)
                .where(CompetencyItem.is_active == True)
                .where(CompetencyItem.item_code.notin_(priority_codes))
                .limit(4 - len(selected_items))
            )
            selected_items.extend(result.scalars().all())

        available_items = selected_items[:1] if len(selected_items) >= 1 else selected_items

        project_items = []
        grade_criteria_map = {}  # item_code -> grade_config

        if available_items:
            item_count = len(available_items)
            base_score = Decimal("100") / item_count

            for i, comp_item in enumerate(available_items):
                score = base_score + (Decimal("100") - base_score * item_count if i == item_count - 1 else Decimal("0"))
                project_item = ProjectItem(
                    project_id=new_project.project_id,
                    item_id=comp_item.item_id,
                    is_required=True,
                    proof_required_level=ProofRequiredLevel.OPTIONAL,
                    max_score=score.quantize(Decimal("0.01")),
                    display_order=i + 1
                )
                db.add(project_item)
                await db.flush()  # project_item_id 생성
                project_items.append(project_item)

                # GRADE 채점 기준 추가 (항목 유형별)
                if comp_item.item_code == 'CERT_COACH':
                    # 코칭 관련 자격증 등급 (cert_name 필드에서 자격증 명칭 추출)
                    grade_config = json.dumps({
                        "type": "string",
                        "matchMode": "contains",
                        "grades": [
                            {"value": "KSC", "score": float(score)},
                            {"value": "KPC", "score": float(score * Decimal("0.7"))},
                            {"value": "KAC", "score": float(score * Decimal("0.4"))},
                            {"value": "ACC", "score": float(score * Decimal("0.3"))},
                            {"value": "PCC", "score": float(score * Decimal("0.8"))},
                            {"value": "MCC", "score": float(score)}
                        ]
                    })
                    criteria = ScoringCriteria(
                        project_item_id=project_item.project_item_id,
                        matching_type=MatchingType.GRADE,
                        expected_value=grade_config,
                        score=Decimal("0"),
                        value_source=ValueSourceType.JSON_FIELD,
                        source_field="cert_name"
                    )
                    db.add(criteria)
                    grade_criteria_map[comp_item.item_code] = {"max": float(score), "type": "cert"}

                elif comp_item.item_code == 'EDU_COACHING' or comp_item.template == 'degree':
                    # 학위별 등급
                    grade_config = json.dumps({
                        "type": "string",
                        "grades": [
                            {"value": "박사", "score": float(score)},
                            {"value": "석사", "score": float(score * Decimal("0.7"))},
                            {"value": "학사", "score": float(score * Decimal("0.4"))},
                            {"value": "전문학사", "score": float(score * Decimal("0.2"))}
                        ]
                    })
                    criteria = ScoringCriteria(
                        project_item_id=project_item.project_item_id,
                        matching_type=MatchingType.GRADE,
                        expected_value=grade_config,
                        score=Decimal("0"),
                        value_source=ValueSourceType.JSON_FIELD,
                        source_field="degree_level"
                    )
                    db.add(criteria)
                    grade_criteria_map[comp_item.item_code] = {"max": float(score), "type": "degree"}

                else:
                    # 기타 항목: 숫자 범위 기반
                    grade_config = json.dumps({
                        "type": "numeric",
                        "grades": [
                            {"min": 1000, "score": float(score)},
                            {"min": 500, "max": 999, "score": float(score * Decimal("0.7"))},
                            {"min": 100, "max": 499, "score": float(score * Decimal("0.4"))},
                            {"max": 99, "score": float(score * Decimal("0.2"))}
                        ]
                    })
                    criteria = ScoringCriteria(
                        project_item_id=project_item.project_item_id,
                        matching_type=MatchingType.GRADE,
                        expected_value=grade_config,
                        score=Decimal("0"),
                        value_source=ValueSourceType.SUBMITTED
                    )
                    db.add(criteria)
                    grade_criteria_map[comp_item.item_code] = {"max": float(score), "type": "numeric"}

            await db.commit()
            print(f"[CREATE-TEST-APPS] Added {len(project_items)} survey items with GRADE scoring")

        # Step 3: Create 1 test user and application with verification pending status
        print("[CREATE-TEST-APPS] Step 3: Creating test user and application...")
        from app.services.scoring_service import calculate_application_auto_score

        coach_roles = [CoachRole.LEADER, CoachRole.PARTICIPANT, CoachRole.SUPERVISOR]
        korean_names = ["김철수", "이영희", "박민수", "최지현", "정우진", "강서연", "조현우", "윤미래", "임동현", "한소희"]

        # 인증등급 분포: KSC 2명, KPC 4명, KAC 4명
        cert_levels = ["KSC", "KSC", "KPC", "KPC", "KPC", "KPC", "KAC", "KAC", "KAC", "KAC"]
        degree_levels = ["박사", "석사", "석사", "학사", "학사", "학사", "전문학사", "전문학사", "학사", "석사"]
        numeric_values = [1500, 1200, 800, 600, 400, 300, 150, 100, 50, 20]

        random.shuffle(cert_levels)  # 섞어서 다양성 부여

        application_ids = []

        for i in range(1, 2):  # 1명의 사용자만 생성
            # Get or create test user with certification number
            email = f"test_user_{i}@test.com"
            result = await db.execute(select(User).where(User.email == email))
            test_user = result.scalar_one_or_none()

            cert_number = f"{cert_levels[i-1]}-2024-TEST{str(i).zfill(4)}"

            if not test_user:
                test_user = User(
                    name=korean_names[i-1] if i <= len(korean_names) else f"테스트유저{i}",
                    email=email,
                    hashed_password=get_password_hash("test1234"),
                    phone=f"010-1234-{str(i).zfill(4)}",
                    address="서울시 테스트구",
                    roles=json.dumps(["COACH"]),
                    coach_certification_number=cert_number  # 인증번호 설정
                )
                db.add(test_user)
                await db.flush()
                print(f"[CREATE-TEST-APPS] Created user: {email} with cert: {cert_number}")
            else:
                # 기존 사용자도 인증번호 업데이트
                test_user.coach_certification_number = cert_number
                await db.flush()

            # Create application (auto_score는 나중에 계산)
            application = Application(
                project_id=new_project.project_id,
                user_id=test_user.user_id,
                motivation=f"테스트 지원동기 {i}번 - 본 과제에 참여하여 전문성을 발휘하고 싶습니다.",
                applied_role=random.choice(coach_roles),
                status=ApplicationStatus.SUBMITTED,
                auto_score=Decimal("0"),  # 나중에 계산
                submitted_at=datetime.now()
            )
            db.add(application)
            await db.flush()
            application_ids.append(application.application_id)

            # Create application data for each survey item (with grade-matchable values)
            for project_item in project_items:
                # 항목에 연결된 competency_item 가져오기
                comp_result = await db.execute(
                    select(CompetencyItem).where(CompetencyItem.item_id == project_item.item_id)
                )
                comp_item = comp_result.scalar_one_or_none()

                # 항목 유형별로 적절한 값 설정 (현재 항목 구조에 맞게 업데이트)
                if comp_item and comp_item.item_code == 'CERT_COACH':
                    # 코칭 관련 자격증 (TEXT_FILE 템플릿, cert_name 필드 포함)
                    submitted_value = json.dumps({
                        "cert_name": cert_levels[i-1],  # KSC/KPC/KAC
                        "cert_year": 2023 - (i % 5),
                        "cert_file": None
                    })
                elif comp_item and (comp_item.item_code == 'EDU_COACHING' or comp_item.template == 'degree'):
                    # 학력 정보 (DEGREE 템플릿)
                    submitted_value = json.dumps({
                        "degree_level": degree_levels[i-1],
                        "school": "테스트대학교",
                        "major": "코칭학",
                        "proof": None
                    })
                elif comp_item and comp_item.item_code == 'EXP_COACHING_TRAINING':
                    # 코칭연수 (COACHING_TIME 템플릿, 복수입력)
                    training_count = (i % 3) + 1  # 1~3개 연수
                    trainings = []
                    for t in range(training_count):
                        trainings.append({
                            "description": f"코칭연수{t+1}",
                            "year": 2023 - t,
                            "hours": 20 + (t * 10),
                            "proof": None
                        })
                    submitted_value = json.dumps(trainings)
                else:
                    # 숫자값 (코칭 시간 등)
                    submitted_value = str(numeric_values[i-1])

                app_data = ApplicationData(
                    application_id=application.application_id,
                    item_id=project_item.item_id,
                    submitted_value=submitted_value,
                    item_score=Decimal("0")  # 나중에 scoring service에서 계산
                )
                db.add(app_data)

            print(f"[CREATE-TEST-APPS] Created application for {email}")

        await db.commit()

        # Step 3.5: Calculate scores using scoring service
        print("[CREATE-TEST-APPS] Step 3.5: Calculating GRADE-based scores...")
        for app_id in application_ids:
            try:
                calculated_score = await calculate_application_auto_score(db, app_id)
                print(f"[CREATE-TEST-APPS] Application {app_id}: auto_score = {calculated_score}")
            except Exception as e:
                print(f"[CREATE-TEST-APPS] Score calculation error for {app_id}: {e}")

        await db.commit()
        print("[CREATE-TEST-APPS] All applications scored")

        # Step 4: Assign reviewer (viproject@naver.com only)
        print("[CREATE-TEST-APPS] Step 4: Assigning reviewer...")
        reviewer_email = "viproject@naver.com"

        result = await db.execute(select(User).where(User.email == reviewer_email))
        reviewer = result.scalar_one_or_none()
        if reviewer:
            staff = ProjectStaff(
                project_id=new_project.project_id,
                staff_user_id=reviewer.user_id
            )
            db.add(staff)
            print(f"[CREATE-TEST-APPS] Added reviewer: {reviewer_email}")
        else:
            print(f"[CREATE-TEST-APPS] WARNING: Reviewer {reviewer_email} not found")

        await db.commit()
        print("[CREATE-TEST-APPS] Reviewers assigned")

        # Step 5: Prepare response
        await db.refresh(new_project)
        display_status = calculate_display_status(
            new_project.status,
            new_project.recruitment_start_date,
            new_project.recruitment_end_date
        )

        response = ProjectResponse(
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

        print(f"[CREATE-TEST-APPS] === SUCCESS: Created project {new_project.project_id} with 1 application (verification pending) ===")

        # Log project creation for tracking
        logger.info(f"[PROJECT_CREATE] name='{new_project.project_name}', id={new_project.project_id}, creator={current_user.email}, status={new_project.status}, endpoint='/projects/create-test-with-applications'")

        return response

    except Exception as e:
        print(f"[CREATE-TEST-APPS ERROR] {type(e).__name__}: {str(e)}")
        print(f"[CREATE-TEST-APPS ERROR] Traceback:\n{traceback.format_exc()}")
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create test project with applications: {type(e).__name__}: {str(e)}"
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
    """Check if user has permission to manage this project"""
    from app.core.utils import get_user_roles
    user_roles = get_user_roles(current_user)

    # Super admin can access all projects
    if "SUPER_ADMIN" in user_roles:
        return

    # Anyone can access their own created projects
    if project.created_by == current_user.user_id:
        return

    # Project manager can access projects they manage
    if project.project_manager_id == current_user.user_id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="본인이 생성한 과제만 관리할 수 있습니다."
    )


# ============================================================================
# Project CRUD Endpoints
# ============================================================================
@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project

    **Required roles**: 모든 인증된 사용자

    **Notes**:
    - 새 과제는 항상 DRAFT(초안) 상태로 생성됩니다.
    - 승인요청을 위해서는 /finalize 엔드포인트를 사용하세요. (100점 검증 필요)
    - SUPER_ADMIN 승인 후 모집시작일에 공개됩니다.
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

    # Log project creation for tracking
    logger.info(f"[PROJECT_CREATE] name='{new_project.project_name}', id={new_project.project_id}, creator={current_user.email}, status={new_project.status}, endpoint='/projects'")

    return ProjectResponse(
        project_id=new_project.project_id,
        project_name=new_project.project_name,
        project_type=new_project.project_type,
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
    mode: Optional[str] = Query(None, description="Mode: 'participate' (recruiting only) or 'manage' (own projects)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of projects with optional filters

    **Modes**:
    - mode=participate: Show only recruiting projects (for application)
    - mode=manage: Show own projects only (SUPER_ADMIN sees all)
    - mode=review: Show projects where user is assigned as reviewer (SUPER_ADMIN sees all)
    - mode=None (default): Legacy behavior (mixed list)

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

        # Apply filters based on user role and mode
        from datetime import date
        today = date.today()

        if mode == "participate":
            # 과제참여 모드: 모집중인 과제만 (모든 사용자 동일)
            query = query.where(
                or_(
                    # READY 상태 + 모집기간 내
                    (
                        (Project.status == ProjectStatus.READY) &
                        (Project.recruitment_start_date <= today) &
                        (Project.recruitment_end_date >= today)
                    ),
                    # Legacy: RECRUITING status
                    Project.status == ProjectStatus.RECRUITING
                )
            )
        elif mode == "manage":
            # 과제관리 모드: 본인 과제만 (수퍼어드민은 전체)
            if "SUPER_ADMIN" not in user_roles:
                query = query.where(
                    or_(
                        Project.created_by == current_user.user_id,
                        Project.project_manager_id == current_user.user_id
                    )
                )
            # SUPER_ADMIN은 필터 없이 전체 조회
        elif mode == "review":
            # 과제심사 모드: 심사개시된 과제 + 심사자로 할당된 과제만
            # 심사개시(review_started_at)가 설정된 과제만 표시 (심사 대상 필터링)
            query = query.where(Project.review_started_at.isnot(None))

            if "SUPER_ADMIN" not in user_roles:
                # ProjectStaff 테이블에서 현재 사용자가 할당된 과제만 조회
                staff_subquery = select(ProjectStaff.project_id).where(
                    ProjectStaff.staff_user_id == current_user.user_id
                )
                query = query.where(Project.project_id.in_(staff_subquery))
            # SUPER_ADMIN도 심사개시된 과제만 표시
        else:
            # 기본 모드 (Legacy): 기존 동작 유지
            if "SUPER_ADMIN" not in user_roles:
                # All users can see:
                # 1. Their own projects (any status) - for management
                # 2. Approved & recruiting projects - for application
                query = query.where(
                    or_(
                        # Own projects (any status)
                        Project.created_by == current_user.user_id,
                        Project.project_manager_id == current_user.user_id,
                        # Approved (READY) + within recruitment dates = public
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

        # Batch fetch project manager names
        manager_ids = [p.project_manager_id for p in projects if p.project_manager_id]
        manager_names = {}
        if manager_ids:
            manager_result = await db.execute(
                select(User.user_id, User.name).where(User.user_id.in_(manager_ids))
            )
            for user_id, name in manager_result.all():
                manager_names[user_id] = name

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
                project_manager_name=manager_names.get(project.project_manager_id) if project.project_manager_id else None,
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


# ============================================================================
# Test Project Management (MUST be before /{project_id} routes)
# ============================================================================
@router.get("/test-projects", response_model=List[ProjectListResponse])
async def get_test_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    Get all test projects (projects starting with '[테스트]')

    **Required roles**: SUPER_ADMIN only
    """
    from app.schemas.project import calculate_display_status

    # 과제명이 '[테스트]'로 시작하는 과제만 조회
    result = await db.execute(
        select(Project)
        .where(Project.project_name.like('[테스트]%'))
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()

    # 각 프로젝트에 대해 application_count와 current_participants 계산
    response_list = []
    for project in projects:
        # 전체 응모 수
        app_count_result = await db.execute(
            select(func.count(Application.application_id))
            .where(Application.project_id == project.project_id)
        )
        application_count = app_count_result.scalar() or 0

        # 선발된 참여자 수
        selected_count_result = await db.execute(
            select(func.count(Application.application_id))
            .where(
                Application.project_id == project.project_id,
                Application.selection_result == 'selected'
            )
        )
        current_participants = selected_count_result.scalar() or 0

        display_status = calculate_display_status(project)

        response_list.append(ProjectListResponse(
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
        ))

    return response_list


@router.delete("/bulk-delete")
async def bulk_delete_projects(
    project_ids: List[int] = Body(..., embed=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    Bulk delete multiple projects and all related data

    **Required roles**: SUPER_ADMIN only

    Deletes projects and cascades to:
    - Applications, ApplicationData
    - Evaluations, ReviewerEvaluations
    - ProjectItems, ScoringCriteria
    - CustomQuestions, CustomQuestionAnswers
    - ProjectStaff
    - etc.
    """
    import traceback
    from sqlalchemy import text

    if not project_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_ids cannot be empty"
        )

    print(f"[BULK DELETE] Starting bulk delete for project_ids={project_ids} by user_id={current_user.user_id}")

    deleted_count = 0

    try:
        for project_id in project_ids:
            # 과제 존재 확인
            project = await db.get(Project, project_id)
            if not project:
                print(f"[BULK DELETE] Skipping non-existent project_id={project_id}")
                continue

            print(f"[BULK DELETE] Deleting project: {project.project_name}")

            # 관련 데이터 삭제 (delete_project 로직 재사용)
            # 1. ApplicationData 삭제
            await db.execute(text("""
                DELETE FROM application_data
                WHERE application_id IN (SELECT application_id FROM applications WHERE project_id = :project_id)
            """), {"project_id": project_id})

            # 2. ReviewerEvaluations 삭제
            await db.execute(text("""
                DELETE FROM reviewer_evaluations
                WHERE application_id IN (SELECT application_id FROM applications WHERE project_id = :project_id)
            """), {"project_id": project_id})

            # 3-1. ReviewLocks 삭제
            await db.execute(text("""
                DELETE FROM review_locks
                WHERE application_id IN (SELECT application_id FROM applications WHERE project_id = :project_id)
            """), {"project_id": project_id})

            # 3-2. Notifications의 related_application_id를 NULL로 설정 (applications 삭제 전에 수행)
            await db.execute(text("""
                UPDATE notifications SET related_application_id = NULL
                WHERE related_application_id IN (SELECT application_id FROM applications WHERE project_id = :project_id)
            """), {"project_id": project_id})

            # 4. Applications 삭제
            await db.execute(text("""
                DELETE FROM applications WHERE project_id = :project_id
            """), {"project_id": project_id})

            # 5. CustomQuestionAnswers 삭제
            await db.execute(text("""
                DELETE FROM custom_question_answers
                WHERE question_id IN (SELECT question_id FROM custom_questions WHERE project_id = :project_id)
            """), {"project_id": project_id})

            # 6. CustomQuestions 삭제
            await db.execute(text("""
                DELETE FROM custom_questions WHERE project_id = :project_id
            """), {"project_id": project_id})

            # 7. ScoringCriteria 삭제
            await db.execute(text("""
                DELETE FROM scoring_criteria
                WHERE project_item_id IN (SELECT project_item_id FROM project_items WHERE project_id = :project_id)
            """), {"project_id": project_id})

            # 8. ProjectItems 삭제
            await db.execute(text("""
                DELETE FROM project_items WHERE project_id = :project_id
            """), {"project_id": project_id})

            # 9. CoachEvaluations 삭제
            await db.execute(text("""
                DELETE FROM coach_evaluations WHERE project_id = :project_id
            """), {"project_id": project_id})

            # 10. ProjectStaff 삭제
            await db.execute(text("""
                DELETE FROM project_staff WHERE project_id = :project_id
            """), {"project_id": project_id})

            # 11. Notification의 related_project_id를 NULL로 설정
            await db.execute(text("""
                UPDATE notifications SET related_project_id = NULL WHERE related_project_id = :project_id
            """), {"project_id": project_id})

            # 12. Project 삭제
            await db.execute(text("""
                DELETE FROM projects WHERE project_id = :project_id
            """), {"project_id": project_id})

            deleted_count += 1

        await db.commit()
        print(f"[BULK DELETE] Successfully deleted {deleted_count} projects")

        return {"deleted_count": deleted_count}

    except Exception as e:
        print(f"[BULK DELETE ERROR] Exception: {type(e).__name__}: {str(e)}")
        print(f"[BULK DELETE ERROR] Traceback:\n{traceback.format_exc()}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete projects: {str(e)}"
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
    current_user: User = Depends(get_current_user)
):
    """
    Update project information

    **Required roles**: 인증된 사용자 (본인 과제만 수정 가능)

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
        project_type=project.project_type,
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
    current_user: User = Depends(get_current_user)
):
    """
    Delete a project and all related data

    **Required roles**: 인증된 사용자 (본인 과제만 삭제 가능)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
# User Project History (응모자 이력) Endpoint
# ============================================================================
@router.get("/users/{user_id}/history")
async def get_user_project_history(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user's project participation history with evaluations.

    Returns:
    - All projects the user has applied to
    - Selection results
    - Final scores
    - Coach evaluations for completed projects

    **Required roles**: Any authenticated user (for reviewing applicants)
    """
    from app.schemas.project import (
        UserProjectHistoryItem,
        UserProjectHistoryResponse,
        CoachEvaluationResponse,
        UserBasicInfo
    )

    # Get user info
    user_result = await db.execute(
        select(User).where(User.user_id == user_id)
    )
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # Get all applications for this user
    apps_result = await db.execute(
        select(Application, Project)
        .join(Project, Application.project_id == Project.project_id)
        .where(Application.user_id == user_id)
        .order_by(Project.created_at.desc())
    )
    applications = apps_result.all()

    # Get all evaluations for this user
    evals_result = await db.execute(
        select(CoachEvaluation)
        .where(CoachEvaluation.coach_user_id == user_id)
    )
    evaluations = {e.project_id: e for e in evals_result.scalars().all()}

    # Build history items
    history = []
    total_score = 0
    score_count = 0
    total_eval_score = 0
    eval_count = 0
    selected_count = 0

    for app, project in applications:
        # Get evaluation for this project if exists
        evaluation = evaluations.get(project.project_id)
        eval_response = None
        if evaluation:
            eval_response = CoachEvaluationResponse(
                evaluation_id=evaluation.evaluation_id,
                project_id=evaluation.project_id,
                coach_user_id=evaluation.coach_user_id,
                evaluated_by=evaluation.evaluated_by,
                participation_score=evaluation.participation_score,
                feedback_text=evaluation.feedback_text,
                special_notes=evaluation.special_notes,
                evaluated_at=evaluation.evaluated_at,
                updated_at=evaluation.updated_at
            )
            total_eval_score += evaluation.participation_score
            eval_count += 1

        history_item = UserProjectHistoryItem(
            project_id=project.project_id,
            application_id=app.application_id,
            project_name=project.project_name,
            project_type=project.project_type.value if project.project_type else None,
            role=app.applied_role,
            selection_result=app.selection_result,
            final_score=float(app.final_score) if app.final_score else None,
            project_start_date=project.project_start_date,
            project_end_date=project.project_end_date,
            status=project.status.value,
            evaluation=eval_response
        )
        history.append(history_item)

        if app.selection_result == 'selected':
            selected_count += 1
        if app.final_score:
            total_score += float(app.final_score)
            score_count += 1

    return UserProjectHistoryResponse(
        user_id=target_user.user_id,
        user_name=target_user.name,
        user_email=target_user.email,
        total_projects=len(history),
        selected_count=selected_count,
        avg_score=total_score / score_count if score_count > 0 else None,
        avg_evaluation_score=total_eval_score / eval_count if eval_count > 0 else None,
        history=history
    )


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
    current_user: User = Depends(get_current_user)
):
    """
    Add a competency item to project (설문항목 추가)

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    import traceback

    try:
        print(f"[ADD-ITEM] Step 1: Checking project {project_id}")
        # Check project and permission
        project = await get_project_or_404(project_id, db)
        check_project_manager_permission(project, current_user)
        print(f"[ADD-ITEM] Step 1 OK: Project found, permission checked")

        print(f"[ADD-ITEM] Step 2: Checking competency item {item_data.item_id}")
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
        print(f"[ADD-ITEM] Step 2 OK: Competency item exists")

        print(f"[ADD-ITEM] Step 3: Checking for duplicate")
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
        print(f"[ADD-ITEM] Step 3 OK: No duplicate found")

        print(f"[ADD-ITEM] Step 4: Creating ProjectItem")
        print(f"[ADD-ITEM] Data: is_required={item_data.is_required}, proof_required_level={item_data.proof_required_level}, max_score={item_data.max_score}, display_order={item_data.display_order}")
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
        print(f"[ADD-ITEM] Step 4 OK: ProjectItem created with id {new_item.project_item_id}")

        print(f"[ADD-ITEM] Step 5: Adding {len(item_data.scoring_criteria)} scoring criteria")
        # Add scoring criteria
        for i, criteria_data in enumerate(item_data.scoring_criteria):
            print(f"[ADD-ITEM] Adding criteria {i+1}: type={criteria_data.matching_type}, value={criteria_data.expected_value}, score={criteria_data.score}")

            criteria = ScoringCriteria(
                project_item_id=new_item.project_item_id,
                matching_type=criteria_data.matching_type,
                expected_value=criteria_data.expected_value,
                score=criteria_data.score,
                # GRADE 타입용 필드 추가
                value_source=criteria_data.value_source,
                source_field=criteria_data.source_field,
                extract_pattern=criteria_data.extract_pattern
                # aggregation_mode는 nullable이므로 생략 (DB 컬럼 생성 전까지)
            )
            db.add(criteria)
        print(f"[ADD-ITEM] Step 5 OK: Scoring criteria added")

        print(f"[ADD-ITEM] Step 6: Committing to database")
        await db.commit()
        await db.refresh(new_item)
        print(f"[ADD-ITEM] Step 6 OK: Committed")

        print(f"[ADD-ITEM] Step 7: Building response")
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
        print(f"[ADD-ITEM] Step 7 OK: Response built")

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

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ADD-ITEM ERROR] Exception: {str(e)}")
        print(f"[ADD-ITEM ERROR] Traceback:\n{traceback.format_exc()}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add project item: {str(e)}"
        )


@router.put("/{project_id}/items/{project_item_id}", response_model=ProjectItemResponse)
async def update_project_item(
    project_id: int,
    project_item_id: int,
    item_data: ProjectItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a project item (설문항목 수정)

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER
    """
    import traceback
    from app.models.competency import ValueSourceType

    try:
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
        existing_criteria = await db.execute(
            select(ScoringCriteria).where(ScoringCriteria.project_item_id == project_item_id)
        )
        for criteria in existing_criteria.scalars():
            await db.delete(criteria)

        # Add new scoring criteria
        for criteria_data in item_data.scoring_criteria:
            # Ensure value_source is properly handled (handle both enum and string values)
            value_source = criteria_data.value_source
            if value_source is None:
                value_source = ValueSourceType.SUBMITTED
            elif isinstance(value_source, str):
                value_source = ValueSourceType(value_source)

            # aggregation_mode는 DB 컬럼이 준비될 때까지 None으로 저장
            # (start.sh에서 컬럼 생성 후 정상 작동)
            criteria = ScoringCriteria(
                project_item_id=project_item.project_item_id,
                matching_type=criteria_data.matching_type,
                expected_value=criteria_data.expected_value,
                score=criteria_data.score,
                # GRADE 타입용 필드 추가
                value_source=value_source,
                source_field=criteria_data.source_field,
                extract_pattern=criteria_data.extract_pattern
                # aggregation_mode는 nullable이므로 생략 (DB 컬럼 생성 전까지)
            )
            db.add(criteria)

        await db.commit()
        await db.refresh(project_item)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[UPDATE-ITEM ERROR] {type(e).__name__}: {str(e)}")
        print(f"[UPDATE-ITEM ERROR] Traceback:\n{traceback.format_exc()}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
):
    """
    승인요청 - 모든 조건 검증 후 PENDING 상태로 전환 (SUPER_ADMIN 승인 대기)

    **Required roles**: 모든 인증된 사용자 (본인 과제만)

    조건:
    1. 과제 기간 입력 완료 (project_start_date, project_end_date)
    2. 설문 점수 100점

    Note: SUPER_ADMIN은 바로 READY 상태로 전환됩니다.
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

    # 3. 상태 변경 - SUPER_ADMIN은 바로 APPROVED (승인완료), 그 외는 PENDING (승인대기)
    # Update status using ORM (TypeDecorator handles enum conversion)
    from app.core.utils import get_user_roles
    user_roles = get_user_roles(current_user)

    project.status = ProjectStatus.APPROVED if "SUPER_ADMIN" in user_roles else ProjectStatus.PENDING
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
        project_type=project.project_type,
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


# ============================================================================
# Project Approval API (SUPER_ADMIN only)
# ============================================================================

from pydantic import BaseModel as PydanticBaseModel

class ProjectApprovalRequest(PydanticBaseModel):
    """과제 승인/반려 요청"""
    reason: Optional[str] = None  # 반려 사유 (반려 시 필수)


@router.post("/{project_id}/approve", response_model=ProjectResponse)
async def approve_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    과제 승인 - PENDING 상태를 APPROVED로 변경

    **Required roles**: SUPER_ADMIN only

    승인 시 과제 생성자에게 알림이 발송됩니다.
    과제관리자가 모집개시하면 READY 상태로 전환됩니다.
    """
    from app.schemas.project import calculate_display_status
    from app.models.notification import Notification, NotificationType

    try:
        project = await get_project_or_404(project_id, db)

        # Only PENDING status can be approved
        if project.status != ProjectStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"승인대기 상태의 과제만 승인할 수 있습니다. 현재 상태: {project.status.value}"
            )

        # Change status to APPROVED (TypeDecorator handles enum conversion)
        project.status = ProjectStatus.APPROVED
        await db.commit()
        await db.refresh(project)

        # 과제 생성자에게 알림 생성 (created_by가 있는 경우에만)
        if project.created_by:
            notification = Notification(
                user_id=project.created_by,
                type=NotificationType.PROJECT_APPROVED.value if hasattr(NotificationType, 'PROJECT_APPROVED') else "project_approved",
                title="과제가 승인되었습니다",
                message=f"'{project.project_name}' 과제가 승인되었습니다. 과제 수정 화면에서 모집개시 해주세요.",
                related_project_id=project.project_id,
                email_sent=False
            )
            db.add(notification)
            await db.commit()

        # display_status 계산
        display_status = calculate_display_status(
            project.status,
            project.recruitment_start_date,
            project.recruitment_end_date
        )

        return ProjectResponse(
            project_id=project.project_id,
            project_name=project.project_name,
            project_type=project.project_type,
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
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in approve_project: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"과제 승인 실패: {str(e)}"
        )


@router.post("/{project_id}/reject", response_model=ProjectResponse)
async def reject_project(
    project_id: int,
    request: ProjectApprovalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    과제 반려 - PENDING 상태를 REJECTED로 변경

    **Required roles**: SUPER_ADMIN only

    반려 시 과제 생성자에게 알림과 이메일이 발송됩니다.
    생성자는 과제를 수정 후 다시 승인요청할 수 있습니다.
    """
    from app.schemas.project import calculate_display_status
    from app.models.notification import Notification, NotificationType

    project = await get_project_or_404(project_id, db)

    # Only PENDING status can be rejected
    if project.status != ProjectStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"승인대기 상태의 과제만 반려할 수 있습니다. 현재 상태: {project.status.value}"
        )

    # 반려 사유 필수
    if not request.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="반려 사유를 입력해주세요."
        )

    # Change status to REJECTED (TypeDecorator handles enum conversion)
    project.status = ProjectStatus.REJECTED
    await db.commit()
    await db.refresh(project)

    # 과제 생성자에게 알림 생성 (created_by가 있는 경우에만)
    if project.created_by:
        notification = Notification(
            user_id=project.created_by,
            type=NotificationType.PROJECT_REJECTED.value if hasattr(NotificationType, 'PROJECT_REJECTED') else "project_rejected",
            title="과제가 반려되었습니다",
            message=f"'{project.project_name}' 과제가 반려되었습니다. 사유: {request.reason}",
            related_project_id=project.project_id,
            email_sent=False
        )
        db.add(notification)
        await db.commit()

    # display_status 계산
    display_status = calculate_display_status(
        project.status,
        project.recruitment_start_date,
        project.recruitment_end_date
    )

    return ProjectResponse(
        project_id=project.project_id,
        project_name=project.project_name,
        project_type=project.project_type,
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


@router.post("/{project_id}/start-recruitment", response_model=ProjectResponse)
async def start_recruitment(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    모집개시 - APPROVED 상태를 READY로 변경

    **Required roles**: 과제 생성자 또는 과제관리자

    승인완료된 과제를 모집개시 상태로 전환합니다.
    """
    from app.schemas.project import calculate_display_status

    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Only APPROVED status can start recruitment
    if project.status != ProjectStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"승인완료 상태의 과제만 모집개시할 수 있습니다. 현재 상태: {project.status.value}"
        )

    # Change status to READY (TypeDecorator handles enum conversion)
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
        project_type=project.project_type,
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


@router.post("/{project_id}/resubmit", response_model=ProjectResponse)
async def resubmit_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    재상신 - REJECTED 상태를 PENDING으로 변경

    **Required roles**: 과제 생성자만

    반려된 과제를 수정 후 다시 승인요청합니다.
    """
    from app.schemas.project import calculate_display_status

    project = await get_project_or_404(project_id, db)

    # 본인 과제만 재상신 가능
    if project.created_by != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 생성한 과제만 재상신할 수 있습니다."
        )

    # Only REJECTED status can be resubmitted
    if project.status != ProjectStatus.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"반려된 과제만 재상신할 수 있습니다. 현재 상태: {project.status.value}"
        )

    # Change status to PENDING (TypeDecorator handles enum conversion)
    project.status = ProjectStatus.PENDING
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
        project_type=project.project_type,
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
    current_user: User = Depends(get_current_user)
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

    # Revert to DRAFT status using ORM (TypeDecorator handles enum conversion)
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
        project_type=project.project_type,
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


# ============================================================================
# 응모 마감 및 스냅샷 동결 (하이브리드 구조)
# ============================================================================
@router.post("/{project_id}/freeze-applications", status_code=200)
async def freeze_applications(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Freeze all submitted applications for a project.

    This endpoint:
    1. Copies linked CoachCompetency data to ApplicationData.submitted_value (snapshot)
    2. Sets Application.is_frozen = True
    3. Sets Application.frozen_at = now()

    After freezing, applications will use the snapshot data instead of real-time competency data.
    This is typically called when recruitment ends or when admin wants to lock submissions for review.

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER (only for their own projects)
    """
    from sqlalchemy.orm import selectinload

    project = await get_project_or_404(project_id, db)
    check_project_manager_permission(project, current_user)

    # Get all submitted applications for this project
    applications_result = await db.execute(
        select(Application)
        .where(
            Application.project_id == project_id,
            Application.status == ApplicationStatus.SUBMITTED
        )
        .options(selectinload(Application.application_data))
    )
    applications = applications_result.scalars().all()

    if not applications:
        return {
            "message": "제출된 지원서가 없습니다.",
            "frozen_count": 0
        }

    frozen_count = 0
    snapshot_count = 0

    for application in applications:
        if application.is_frozen:
            continue  # Already frozen, skip

        # Process each application data item
        for app_data in application.application_data:
            if app_data.competency_id:
                # Get linked competency data
                competency_result = await db.execute(
                    select(CoachCompetency).where(
                        CoachCompetency.competency_id == app_data.competency_id
                    )
                )
                competency = competency_result.scalar_one_or_none()

                if competency:
                    # Copy competency data to snapshot fields
                    app_data.submitted_value = competency.value
                    app_data.submitted_file_id = competency.file_id
                    snapshot_count += 1

        # Mark application as frozen
        application.is_frozen = True
        application.frozen_at = datetime.now()
        frozen_count += 1

    await db.commit()

    return {
        "message": f"{frozen_count}개 지원서가 동결되었습니다.",
        "frozen_count": frozen_count,
        "snapshot_count": snapshot_count
    }


# ============================================================================
# Project Applications List (응모자 목록)
# ============================================================================
from app.schemas.application import ProjectApplicationListItem, ApplicantInfo


@router.get("/{project_id}/applications", response_model=List[ProjectApplicationListItem])
async def get_project_applications(
    project_id: int,
    status_filter: Optional[str] = Query(None, description="Filter by status: draft, submitted, reviewing, completed"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all applications for a project (응모자 목록)

    **Permissions**: SUPER_ADMIN, PROJECT_MANAGER (their own projects), VERIFIER, REVIEWER

    This endpoint returns a list of all applications for a project,
    including applicant information and document verification status.
    This is used by admins to view applicants and by reviewers for evaluation.
    """
    from app.core.utils import get_user_roles

    # Check project exists
    project = await get_project_or_404(project_id, db)

    # Check permissions
    user_roles = get_user_roles(current_user)
    has_access = False

    if "SUPER_ADMIN" in user_roles:
        has_access = True
    elif "PROJECT_MANAGER" in user_roles:
        if project.project_manager_id == current_user.user_id or project.created_by == current_user.user_id:
            has_access = True
    elif "VERIFIER" in user_roles:
        # VERIFIER는 모든 과제의 지원자 열람 가능
        has_access = True
    elif "REVIEWER" in user_roles:
        # REVIEWER는 할당된 과제만 지원자 열람 가능
        staff_result = await db.execute(
            select(ProjectStaff).where(
                ProjectStaff.project_id == project_id,
                ProjectStaff.staff_user_id == current_user.user_id
            )
        )
        if staff_result.scalar_one_or_none():
            has_access = True

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view applications"
        )

    # Build query
    query = select(Application).where(Application.project_id == project_id)

    # Apply status filter
    if status_filter:
        query = query.where(Application.status == status_filter)

    # Order by submitted_at desc
    query = query.order_by(Application.submitted_at.desc().nullslast(), Application.application_id.desc())

    result = await db.execute(query)
    applications = result.scalars().all()

    # Build response
    response_list = []
    for application in applications:
        # Get applicant info
        user_result = await db.execute(
            select(User).where(User.user_id == application.user_id)
        )
        applicant = user_result.scalar_one_or_none()

        if not applicant:
            continue

        # Get application data for document verification status
        app_data_result = await db.execute(
            select(ApplicationData).where(
                ApplicationData.application_id == application.application_id
            )
        )
        app_data_items = app_data_result.scalars().all()

        # Get project items for proof_required_level check
        project_items_result = await db.execute(
            select(ProjectItem).where(ProjectItem.project_id == project_id)
        )
        project_items = {pi.item_id: pi for pi in project_items_result.scalars().all()}

        # Calculate document verification status (증빙검토 상태)
        # - NOT_REQUIRED 또는 (OPTIONAL + 파일 없음) → 검토 불필요 (approved로 취급)
        # - 파일 첨부된 항목만 실제 검토 상태 확인
        supplement_count = 0
        if not app_data_items:
            doc_verification_status = "approved"  # 항목 없으면 검토 완료로 처리
        else:
            effective_statuses = []
            for item in app_data_items:
                pi = project_items.get(item.item_id)
                proof_level = pi.proof_required_level if pi else None

                # 증빙 불필요 항목은 approved로 취급
                if proof_level == ProofRequiredLevel.NOT_REQUIRED:
                    effective_statuses.append("approved")
                elif proof_level == ProofRequiredLevel.OPTIONAL and item.submitted_file_id is None:
                    effective_statuses.append("approved")
                else:
                    # 실제 검토 상태 사용
                    effective_statuses.append(item.verification_status)
                    if item.verification_status == "supplement_requested":
                        supplement_count += 1

            if supplement_count > 0:
                doc_verification_status = "supplement_requested"
            elif all(s == "approved" for s in effective_statuses):
                doc_verification_status = "approved"
            elif any(s == "rejected" for s in effective_statuses):
                doc_verification_status = "rejected"
            elif any(s == "approved" for s in effective_statuses):
                doc_verification_status = "partial"
            else:
                doc_verification_status = "pending"

        response_item = ProjectApplicationListItem(
            application_id=application.application_id,
            project_id=application.project_id,
            user_id=application.user_id,
            applicant=ApplicantInfo(
                user_id=applicant.user_id,
                name=applicant.name,
                email=applicant.email,
                phone=applicant.phone
            ),
            status=application.status.value,
            auto_score=float(application.auto_score) if application.auto_score else None,
            final_score=float(application.final_score) if application.final_score else None,
            selection_result=application.selection_result.value,
            applied_role=application.applied_role.value if application.applied_role else None,
            submitted_at=application.submitted_at,
            last_updated=application.last_updated,
            is_frozen=application.is_frozen,
            frozen_at=application.frozen_at,
            document_verification_status=doc_verification_status,
            supplement_count=supplement_count
        )
        response_list.append(response_item)

    return response_list


# ============================================================================
# Project Staff (심사자) Management Endpoints
# ============================================================================

@router.get(
    "/{project_id}/staff",
    response_model=ProjectStaffListResponse,
    summary="과제 심사위원 목록 조회"
)
async def get_project_staff(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    과제에 할당된 심사위원 목록을 조회합니다.

    권한: SUPER_ADMIN (모든 과제) 또는 PROJECT_MANAGER (본인 과제)
    """
    try:
        # Check project exists
        project_result = await db.execute(
            select(Project).where(Project.project_id == project_id)
        )
        project = project_result.scalar_one_or_none()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="과제를 찾을 수 없습니다"
            )

        # Check permission: SUPER_ADMIN or project manager or creator
        user_roles = get_user_roles(current_user)
        is_super_admin = "SUPER_ADMIN" in user_roles
        is_project_manager = project.project_manager_id == current_user.user_id
        is_creator = project.created_by == current_user.user_id

        if not (is_super_admin or is_project_manager or is_creator):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="심사위원 관리 권한이 없습니다"
            )

        # Get staff list with user info
        staff_result = await db.execute(
            select(ProjectStaff, User)
            .join(User, ProjectStaff.staff_user_id == User.user_id)
            .where(ProjectStaff.project_id == project_id)
            .order_by(ProjectStaff.assigned_at.desc())
        )
        staff_rows = staff_result.all()

        staff_list = []
        for staff, user in staff_rows:
            staff_response = ProjectStaffResponse(
                project_id=staff.project_id,
                staff_user_id=staff.staff_user_id,
                assigned_at=staff.assigned_at,
                staff_user=UserBasicInfo(
                    user_id=user.user_id,
                    username=user.email,  # User 모델에는 username 대신 email 사용
                    full_name=user.name
                )
            )
            staff_list.append(staff_response)

        return ProjectStaffListResponse(
            staff_list=staff_list,
            total_count=len(staff_list)
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in get_project_staff: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"심사위원 목록 조회 실패: {str(e)}"
        )


@router.post(
    "/{project_id}/staff",
    response_model=ProjectStaffResponse,
    status_code=status.HTTP_201_CREATED,
    summary="과제 심사위원 추가"
)
async def add_project_staff(
    project_id: int,
    staff_data: ProjectStaffCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    과제에 심사위원을 추가합니다.

    권한: SUPER_ADMIN (모든 과제) 또는 PROJECT_MANAGER (본인 과제)
    """
    # Check project exists
    project_result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="과제를 찾을 수 없습니다"
        )

    # Check permission: SUPER_ADMIN or project manager or creator
    user_roles = get_user_roles(current_user)
    is_super_admin = "SUPER_ADMIN" in user_roles
    is_project_manager = project.project_manager_id == current_user.user_id
    is_creator = project.created_by == current_user.user_id

    if not (is_super_admin or is_project_manager or is_creator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="심사위원 관리 권한이 없습니다"
        )

    # Check user exists (REVIEWER 역할 체크 제거 - 과제별 심사위원 지정으로 변경)
    user_result = await db.execute(
        select(User).where(User.user_id == staff_data.staff_user_id)
    )
    staff_user = user_result.scalar_one_or_none()
    if not staff_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # Check if already assigned
    existing_result = await db.execute(
        select(ProjectStaff).where(
            ProjectStaff.project_id == project_id,
            ProjectStaff.staff_user_id == staff_data.staff_user_id
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 해당 과제에 할당된 심사위원입니다"
        )

    # Create new staff assignment
    new_staff = ProjectStaff(
        project_id=project_id,
        staff_user_id=staff_data.staff_user_id
    )
    db.add(new_staff)
    await db.commit()
    await db.refresh(new_staff)

    return ProjectStaffResponse(
        project_id=new_staff.project_id,
        staff_user_id=new_staff.staff_user_id,
        assigned_at=new_staff.assigned_at,
        staff_user=UserBasicInfo(
            user_id=staff_user.user_id,
            username=staff_user.email,  # User 모델에는 username 대신 email 사용
            full_name=staff_user.name
        )
    )


@router.delete(
    "/{project_id}/staff/{staff_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="과제 심사위원 제거"
)
async def remove_project_staff(
    project_id: int,
    staff_user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    과제에서 심사위원을 제거합니다.

    권한: SUPER_ADMIN (모든 과제) 또는 PROJECT_MANAGER (본인 과제)
    """
    # Check project exists
    project_result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="과제를 찾을 수 없습니다"
        )

    # Check permission: SUPER_ADMIN or project manager or creator
    user_roles = get_user_roles(current_user)
    is_super_admin = "SUPER_ADMIN" in user_roles
    is_project_manager = project.project_manager_id == current_user.user_id
    is_creator = project.created_by == current_user.user_id

    if not (is_super_admin or is_project_manager or is_creator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="심사위원 관리 권한이 없습니다"
        )

    # Check staff assignment exists
    staff_result = await db.execute(
        select(ProjectStaff).where(
            ProjectStaff.project_id == project_id,
            ProjectStaff.staff_user_id == staff_user_id
        )
    )
    staff = staff_result.scalar_one_or_none()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 심사위원 할당을 찾을 수 없습니다"
        )

    # Delete staff assignment
    await db.delete(staff)
    await db.commit()

    return None


# ============================================================================
# 심사개시 (Start Review) API
# ============================================================================

@router.get("/{project_id}/preview-start-review")
async def preview_start_review(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    심사개시 미리보기 - 서류검토 미완료 건 목록 조회

    심사개시 버튼 클릭 시 미완료 건 수와 목록을 먼저 보여주기 위한 API

    Returns:
        - total_applications: 전체 제출된 응모 수
        - qualified_count: 서류검토 완료 응모 수 (심사 대상)
        - disqualified_count: 서류검토 미완료 응모 수 (서류탈락 예정)
        - disqualified_list: 미완료 응모 목록 (응모자명, 미완료 항목 수)
    """
    # 프로젝트 조회
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다."
        )

    # 권한 체크
    user_roles = get_user_roles(current_user)
    is_super_admin = "SUPER_ADMIN" in user_roles
    is_project_manager = "PROJECT_MANAGER" in user_roles
    is_creator = project.created_by == current_user.user_id
    is_manager = project.project_manager_id == current_user.user_id

    if not (is_super_admin or is_project_manager or is_creator or is_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="심사개시 권한이 없습니다."
        )

    # 이미 심사 시작됨
    if project.review_started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 심사가 시작된 과제입니다."
        )

    # 제출된 응모 조회
    apps_result = await db.execute(
        select(Application)
        .options()
        .where(
            Application.project_id == project_id,
            Application.status == ApplicationStatus.SUBMITTED
        )
    )
    applications = apps_result.scalars().all()

    # ProjectItem 매핑 조회 (item_id -> proof_required_level)
    project_items_result = await db.execute(
        select(ProjectItem).where(ProjectItem.project_id == project_id)
    )
    project_items = project_items_result.scalars().all()
    proof_levels = {pi.item_id: pi.proof_required_level for pi in project_items}

    qualified_list = []
    disqualified_list = []

    for app in applications:
        # 응모자 정보 조회
        user = await db.get(User, app.user_id)
        user_name = user.name if user else f"User {app.user_id}"

        # ApplicationData 조회
        data_result = await db.execute(
            select(ApplicationData)
            .where(ApplicationData.application_id == app.application_id)
        )
        data_items = data_result.scalars().all()

        # 미완료 항목 수 계산 (자동승인 예정 항목 제외)
        pending_items = []
        for item in data_items:
            if item.verification_status != 'approved':
                proof_level = proof_levels.get(item.item_id)
                # NOT_REQUIRED → 자동 승인 예정이므로 제외
                if proof_level == ProofRequiredLevel.NOT_REQUIRED:
                    continue
                # OPTIONAL + 파일 미첨부 → 자동 승인 예정이므로 제외
                if proof_level == ProofRequiredLevel.OPTIONAL and item.submitted_file_id is None:
                    continue
                # 그 외는 진짜 미완료 항목
                pending_items.append(item)

        user_email = user.email if user else ""

        app_info = {
            "application_id": app.application_id,
            "user_id": app.user_id,
            "user_name": user_name,
            "user_email": user_email,
            "total_items": len(data_items),
            "pending_items_count": len(pending_items),
            "pending_statuses": [
                {
                    "data_id": item.data_id,
                    "item_id": item.item_id,
                    "status": item.verification_status
                }
                for item in pending_items
            ]
        }

        if len(pending_items) == 0 and len(data_items) > 0:
            qualified_list.append(app_info)
        else:
            # 서류탈락 사유 생성
            if len(data_items) == 0:
                reason = "제출된 증빙서류 없음"
            else:
                reason = f"미완료 항목 {len(pending_items)}건"
            app_info["reason"] = reason
            disqualified_list.append(app_info)

    return {
        "project_id": project_id,
        "project_name": project.project_name,
        "total_applications": len(applications),
        "qualified_count": len(qualified_list),
        "disqualified_count": len(disqualified_list),
        "qualified_list": qualified_list,
        "disqualified_list": disqualified_list
    }


@router.post("/{project_id}/start-review")
async def start_review(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    심사 개시 - 이 시점부터:
    1. 모든 응모자의 보완 제출 차단
    2. 서류검토 미완료 건 자동 서류탈락 처리
    3. 서류검토 완료 건만 심사 대상으로 표시

    **Required roles**: SUPER_ADMIN, PROJECT_MANAGER, 또는 과제 생성자/관리자

    Returns:
        - message: 처리 결과 메시지
        - qualified_count: 심사 대상 수
        - disqualified_count: 서류탈락 수
        - review_started_at: 심사개시 시점
    """
    # 프로젝트 조회
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다."
        )

    # 권한 체크
    user_roles = get_user_roles(current_user)
    is_super_admin = "SUPER_ADMIN" in user_roles
    is_project_manager = "PROJECT_MANAGER" in user_roles
    is_creator = project.created_by == current_user.user_id
    is_manager = project.project_manager_id == current_user.user_id

    if not (is_super_admin or is_project_manager or is_creator or is_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="심사개시 권한이 없습니다."
        )

    # 이미 심사 시작됨
    if project.review_started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 심사가 시작된 과제입니다."
        )

    # 프로젝트 상태 확인 (REVIEWING 상태여야 함)
    if project.status != ProjectStatus.REVIEWING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"REVIEWING 상태의 과제만 심사개시 가능합니다. 현재 상태: {project.status.value}"
        )

    # 제출된 응모 조회
    apps_result = await db.execute(
        select(Application)
        .where(
            Application.project_id == project_id,
            Application.status == ApplicationStatus.SUBMITTED
        )
    )
    applications = apps_result.scalars().all()

    disqualified_count = 0
    qualified_count = 0
    now = datetime.utcnow()

    # ProjectItem 매핑 조회 (item_id -> proof_required_level)
    project_items_result = await db.execute(
        select(ProjectItem).where(ProjectItem.project_id == project_id)
    )
    project_items = project_items_result.scalars().all()
    proof_levels = {pi.item_id: pi.proof_required_level for pi in project_items}

    for app in applications:
        # ApplicationData 조회
        data_result = await db.execute(
            select(ApplicationData)
            .where(ApplicationData.application_id == app.application_id)
        )
        data_items = data_result.scalars().all()

        # 증빙 불필요 항목 자동 승인 처리
        for item in data_items:
            if item.verification_status != 'approved':
                proof_level = proof_levels.get(item.item_id)
                # NOT_REQUIRED → 자동 승인
                if proof_level == ProofRequiredLevel.NOT_REQUIRED:
                    item.verification_status = 'approved'
                    logger.info(f"[START_REVIEW] Auto-approved item {item.data_id} (NOT_REQUIRED)")
                # OPTIONAL + 파일 미첨부 → 자동 승인
                elif proof_level == ProofRequiredLevel.OPTIONAL and item.submitted_file_id is None:
                    item.verification_status = 'approved'
                    logger.info(f"[START_REVIEW] Auto-approved item {item.data_id} (OPTIONAL + no file)")

        # 모든 항목이 approved인 경우만 qualified
        all_approved = all(
            item.verification_status == 'approved'
            for item in data_items
        ) if data_items else False

        if all_approved and len(data_items) > 0:
            app.document_status = DocumentStatus.APPROVED
            qualified_count += 1
        else:
            # 미완료 건 서류탈락 처리
            pending_items = [
                item for item in data_items
                if item.verification_status != 'approved'
            ]
            app.document_status = DocumentStatus.DISQUALIFIED
            app.document_disqualification_reason = (
                f"심사개시 시점에 {len(pending_items)}건의 서류가 검토 미완료 상태입니다."
            )
            app.document_disqualified_at = now
            app.selection_result = SelectionResult.REJECTED  # 자동 탈락
            disqualified_count += 1

    # 프로젝트 심사개시 시점 기록
    project.review_started_at = now

    await db.commit()

    logger.info(
        f"[START_REVIEW] project_id={project_id}, "
        f"qualified={qualified_count}, disqualified={disqualified_count}, "
        f"by={current_user.email}"
    )

    return {
        "message": "심사가 개시되었습니다.",
        "project_id": project_id,
        "qualified_count": qualified_count,
        "disqualified_count": disqualified_count,
        "review_started_at": project.review_started_at.isoformat() if project.review_started_at else None
    }


# ============================================================================
# Project Copy
# ============================================================================
@router.post("/{project_id}/copy", response_model=ProjectCopyResponse, status_code=status.HTTP_201_CREATED)
async def copy_project(
    project_id: int,
    copy_data: ProjectCopyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    과제 복사 - 제목 외 모든 설정 복사

    **복사 대상**:
    - Project 기본 정보 (project_type, description, 날짜(선택), max_participants 등)
    - ProjectItem (설문항목 설정)
    - ScoringCriteria (배점 기준)
    - CustomQuestion (커스텀 질문)
    - ProjectStaff (심사위원, 선택)

    **복사하지 않는 항목**:
    - project_name (새 이름 필수)
    - status (항상 DRAFT)
    - Application, ApplicationData (지원서)
    - ReviewerEvaluation, CoachEvaluation (평가)
    - actual_start_date, actual_end_date (실제 시작/종료일)
    - review_started_at (심사개시 시점)

    **권한**: 원본 과제 생성자 또는 SUPER_ADMIN
    """
    from decimal import Decimal

    logger.info(f"[COPY_PROJECT] Start copying project_id={project_id} by user_id={current_user.user_id}")

    # 1. 원본 과제 조회
    source_result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    source_project = source_result.scalar_one_or_none()

    if not source_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="원본 과제를 찾을 수 없습니다."
        )

    # 2. 권한 체크 (원본 과제 생성자 또는 SUPER_ADMIN)
    user_roles = get_user_roles(current_user)
    is_super_admin = "SUPER_ADMIN" in user_roles
    is_owner = source_project.created_by == current_user.user_id

    if not is_super_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="과제를 복사할 권한이 없습니다. 본인이 생성한 과제만 복사할 수 있습니다."
        )

    # 3. 새 과제 생성 (DRAFT)
    new_project = Project(
        project_name=copy_data.new_project_name,
        project_type=source_project.project_type,
        description=source_project.description,
        support_program_name=source_project.support_program_name,
        max_participants=source_project.max_participants,
        # 날짜 복사 (옵션)
        recruitment_start_date=source_project.recruitment_start_date if copy_data.copy_dates else None,
        recruitment_end_date=source_project.recruitment_end_date if copy_data.copy_dates else None,
        project_start_date=source_project.project_start_date if copy_data.copy_dates else None,
        project_end_date=source_project.project_end_date if copy_data.copy_dates else None,
        # 항상 초기화
        actual_start_date=None,
        actual_end_date=None,
        review_started_at=None,
        status=ProjectStatus.DRAFT,
        created_by=current_user.user_id,
        project_manager_id=current_user.user_id,
    )
    db.add(new_project)
    await db.flush()  # new_project.project_id 확보

    logger.info(f"[COPY_PROJECT] Created new project_id={new_project.project_id}")

    # 4. ProjectItem 복사 (item_id 매핑 보존)
    items_result = await db.execute(
        select(ProjectItem).where(ProjectItem.project_id == project_id)
    )
    source_items = items_result.scalars().all()

    # old_project_item_id -> new_project_item_id 매핑 (ScoringCriteria 복사용)
    item_id_mapping = {}

    for source_item in source_items:
        new_item = ProjectItem(
            project_id=new_project.project_id,
            item_id=source_item.item_id,
            is_required=source_item.is_required,
            proof_required_level=source_item.proof_required_level,
            max_score=source_item.max_score,
            display_order=source_item.display_order,
        )
        db.add(new_item)
        await db.flush()  # new_item.project_item_id 확보
        item_id_mapping[source_item.project_item_id] = new_item.project_item_id

    logger.info(f"[COPY_PROJECT] Copied {len(source_items)} ProjectItems")

    # 5. ScoringCriteria 복사 (project_item_id 매핑 사용)
    criteria_count = 0
    for old_item_id, new_item_id in item_id_mapping.items():
        criteria_result = await db.execute(
            select(ScoringCriteria).where(ScoringCriteria.project_item_id == old_item_id)
        )
        source_criteria = criteria_result.scalars().all()

        for sc in source_criteria:
            new_criteria = ScoringCriteria(
                project_item_id=new_item_id,
                matching_type=sc.matching_type,
                expected_value=sc.expected_value,
                expected_value_min=sc.expected_value_min,
                expected_value_max=sc.expected_value_max,
                score=sc.score,
            )
            db.add(new_criteria)
            criteria_count += 1

    logger.info(f"[COPY_PROJECT] Copied {criteria_count} ScoringCriteria")

    # 6. CustomQuestion 복사
    questions_result = await db.execute(
        select(CustomQuestion).where(CustomQuestion.project_id == project_id)
    )
    source_questions = questions_result.scalars().all()

    for sq in source_questions:
        new_question = CustomQuestion(
            project_id=new_project.project_id,
            question_text=sq.question_text,
            question_type=sq.question_type,
            is_required=sq.is_required,
            display_order=sq.display_order,
            options=sq.options,
            allows_text=sq.allows_text,
            allows_file=sq.allows_file,
            file_required=sq.file_required,
            is_evaluation_item=sq.is_evaluation_item,
            max_score=sq.max_score,
            proof_required_level=sq.proof_required_level,
            scoring_rules=sq.scoring_rules,
        )
        db.add(new_question)

    logger.info(f"[COPY_PROJECT] Copied {len(source_questions)} CustomQuestions")

    # 7. ProjectStaff 복사 (옵션)
    staff_count = 0
    if copy_data.copy_staff:
        staff_result = await db.execute(
            select(ProjectStaff).where(ProjectStaff.project_id == project_id)
        )
        source_staff = staff_result.scalars().all()

        for ss in source_staff:
            new_staff = ProjectStaff(
                project_id=new_project.project_id,
                staff_user_id=ss.staff_user_id,
            )
            db.add(new_staff)
            staff_count += 1

        logger.info(f"[COPY_PROJECT] Copied {staff_count} ProjectStaff members")

    await db.commit()

    logger.info(
        f"[COPY_PROJECT] Completed: source_id={project_id} -> new_id={new_project.project_id}, "
        f"items={len(source_items)}, criteria={criteria_count}, questions={len(source_questions)}, staff={staff_count}"
    )

    return ProjectCopyResponse(
        project_id=new_project.project_id,
        project_name=new_project.project_name,
        status=new_project.status.value,
        message=f"과제가 복사되었습니다. (설문항목 {len(source_items)}개, 배점기준 {criteria_count}개, 커스텀질문 {len(source_questions)}개, 심사위원 {staff_count}명)"
    )

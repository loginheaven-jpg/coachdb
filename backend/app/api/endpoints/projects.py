from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserStatus
from app.models.project import Project, ProjectStatus, ProjectStaff
from app.models.application import Application, ApplicationData, ApplicationStatus
from datetime import datetime
from app.models.custom_question import CustomQuestion, CustomQuestionAnswer
from app.models.evaluation import CoachEvaluation
from app.models.competency import ProjectItem, ScoringCriteria, CompetencyItem, CoachCompetency
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
    Create a test project with 10 submitted applications for review testing

    **Required roles**: SUPER_ADMIN only

    Creates:
    - Test project in 'reviewing' status
    - 10 test users (test_user_1@test.com ~ test_user_10@test.com)
    - 10 submitted applications with random auto_score (60-95)
    - No qualitative evaluations (for testing)
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
            project_name=f"[테스트] 심사용 과제 - 응모자 10명",
            description="심사 및 선발 기능 테스트를 위해 자동 생성된 과제입니다. 10명의 응모자가 제출 완료 상태입니다.",
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

        available_items = selected_items[:4] if len(selected_items) >= 4 else selected_items

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

        # Step 3: Create 10 test users and applications with GRADE-based scoring
        print("[CREATE-TEST-APPS] Step 3: Creating test users and applications...")
        from app.services.scoring_service import calculate_application_auto_score

        coach_roles = [CoachRole.LEADER, CoachRole.PARTICIPANT, CoachRole.SUPERVISOR]
        korean_names = ["김철수", "이영희", "박민수", "최지현", "정우진", "강서연", "조현우", "윤미래", "임동현", "한소희"]

        # 인증등급 분포: KSC 2명, KPC 4명, KAC 4명
        cert_levels = ["KSC", "KSC", "KPC", "KPC", "KPC", "KPC", "KAC", "KAC", "KAC", "KAC"]
        degree_levels = ["박사", "석사", "석사", "학사", "학사", "학사", "전문학사", "전문학사", "학사", "석사"]
        numeric_values = [1500, 1200, 800, 600, 400, 300, 150, 100, 50, 20]

        random.shuffle(cert_levels)  # 섞어서 다양성 부여

        application_ids = []

        for i in range(1, 11):
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

        # Step 4: Assign reviewers (required users + random users)
        print("[CREATE-TEST-APPS] Step 4: Assigning reviewers...")
        required_emails = ["viproject@naver.com", "loginheaven@gmail.com"]

        # Get required reviewers
        for email in required_emails:
            result = await db.execute(select(User).where(User.email == email))
            reviewer = result.scalar_one_or_none()
            if reviewer:
                staff = ProjectStaff(
                    project_id=new_project.project_id,
                    staff_user_id=reviewer.user_id
                )
                db.add(staff)
                print(f"[CREATE-TEST-APPS] Added required reviewer: {email}")

        # Get 3 random active users as additional reviewers
        result = await db.execute(
            select(User)
            .where(User.status == UserStatus.ACTIVE)
            .where(User.email.notin_(required_emails))
            .where(User.email.notlike('test_user_%'))
            .limit(50)
        )
        all_users = result.scalars().all()
        random_reviewers = random.sample(all_users, min(3, len(all_users)))

        for reviewer in random_reviewers:
            staff = ProjectStaff(
                project_id=new_project.project_id,
                staff_user_id=reviewer.user_id
            )
            db.add(staff)
            print(f"[CREATE-TEST-APPS] Added random reviewer: {reviewer.email}")

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

        print(f"[CREATE-TEST-APPS] === SUCCESS: Created project {new_project.project_id} with 10 applications ===")
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
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "VERIFIER", "REVIEWER", "COACH"]))
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
            # 과제심사 모드: 심사자로 할당된 과제만 (수퍼어드민은 전체)
            if "SUPER_ADMIN" not in user_roles:
                # ProjectStaff 테이블에서 현재 사용자가 할당된 과제만 조회
                staff_subquery = select(ProjectStaff.project_id).where(
                    ProjectStaff.staff_user_id == current_user.user_id
                )
                query = query.where(Project.project_id.in_(staff_subquery))
            # SUPER_ADMIN은 필터 없이 전체 조회
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
        from app.models.competency import AggregationMode
        for i, criteria_data in enumerate(item_data.scoring_criteria):
            print(f"[ADD-ITEM] Adding criteria {i+1}: type={criteria_data.matching_type}, value={criteria_data.expected_value}, score={criteria_data.score}")

            # aggregation_mode 처리 (복수입력 항목의 집계 방식)
            aggregation_mode = criteria_data.aggregation_mode
            if aggregation_mode is None:
                aggregation_mode = AggregationMode.FIRST
            elif isinstance(aggregation_mode, str):
                aggregation_mode = AggregationMode(aggregation_mode)

            criteria = ScoringCriteria(
                project_item_id=new_item.project_item_id,
                matching_type=criteria_data.matching_type,
                expected_value=criteria_data.expected_value,
                score=criteria_data.score,
                # GRADE 타입용 필드 추가
                value_source=criteria_data.value_source,
                source_field=criteria_data.source_field,
                extract_pattern=criteria_data.extract_pattern,
                aggregation_mode=aggregation_mode
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
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
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

            # aggregation_mode 처리 (복수입력 항목의 집계 방식)
            from app.models.competency import AggregationMode
            aggregation_mode = criteria_data.aggregation_mode
            if aggregation_mode is None:
                aggregation_mode = AggregationMode.FIRST
            elif isinstance(aggregation_mode, str):
                aggregation_mode = AggregationMode(aggregation_mode)

            criteria = ScoringCriteria(
                project_item_id=project_item.project_item_id,
                matching_type=criteria_data.matching_type,
                expected_value=criteria_data.expected_value,
                score=criteria_data.score,
                # GRADE 타입용 필드 추가
                value_source=value_source,
                source_field=criteria_data.source_field,
                extract_pattern=criteria_data.extract_pattern,
                aggregation_mode=aggregation_mode
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
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "VERIFIER", "REVIEWER", "COACH"]))
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

    # 3. 상태 변경 - SUPER_ADMIN은 바로 READY, 그 외는 PENDING
    from app.core.utils import get_user_roles
    user_roles = get_user_roles(current_user)

    if "SUPER_ADMIN" in user_roles:
        project.status = ProjectStatus.READY
    else:
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
    과제 승인 - PENDING 상태를 READY로 변경

    **Required roles**: SUPER_ADMIN only

    승인 시 과제 생성자에게 알림과 이메일이 발송됩니다.
    """
    from app.schemas.project import calculate_display_status
    from app.models.notification import Notification, NotificationType

    project = await get_project_or_404(project_id, db)

    # Only PENDING status can be approved
    if project.status != ProjectStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"승인대기 상태의 과제만 승인할 수 있습니다. 현재 상태: {project.status.value}"
        )

    # Change status to READY
    project.status = ProjectStatus.READY
    await db.commit()
    await db.refresh(project)

    # 과제 생성자에게 알림 생성
    notification = Notification(
        user_id=project.created_by,
        type=NotificationType.PROJECT_APPROVED.value if hasattr(NotificationType, 'PROJECT_APPROVED') else "project_approved",
        title="과제가 승인되었습니다",
        message=f"'{project.project_name}' 과제가 승인되어 모집시작일에 공개됩니다.",
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

    # Change status to REJECTED
    project.status = ProjectStatus.REJECTED
    await db.commit()
    await db.refresh(project)

    # 과제 생성자에게 알림 생성
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
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "VERIFIER", "REVIEWER", "COACH"]))
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

    # Change status to PENDING
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


# ============================================================================
# 응모 마감 및 스냅샷 동결 (하이브리드 구조)
# ============================================================================
@router.post("/{project_id}/freeze-applications", status_code=200)
async def freeze_applications(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
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

        # Calculate document verification status
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

        # Check permission: SUPER_ADMIN or project manager
        user_roles = [r.value if hasattr(r, 'value') else r for r in current_user.roles]
        is_super_admin = "SUPER_ADMIN" in user_roles
        is_project_manager = project.project_manager_id == current_user.user_id

        if not (is_super_admin or is_project_manager):
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

    # Check permission: SUPER_ADMIN or project manager
    user_roles = [r.value if hasattr(r, 'value') else r for r in current_user.roles]
    is_super_admin = "SUPER_ADMIN" in user_roles
    is_project_manager = project.project_manager_id == current_user.user_id

    if not (is_super_admin or is_project_manager):
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

    # Check permission: SUPER_ADMIN or project manager
    user_roles = [r.value if hasattr(r, 'value') else r for r in current_user.roles]
    is_super_admin = "SUPER_ADMIN" in user_roles
    is_project_manager = project.project_manager_id == current_user.user_id

    if not (is_super_admin or is_project_manager):
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

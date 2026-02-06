from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime
import json
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_role, get_password_hash
from app.core.utils import get_user_roles
from app.models.user import User, UserRole, UserStatus
from app.models.project import Project
from app.models.application import Application
from app.models.system_config import SystemConfig, ConfigKeys
from app.models.role_request import RoleRequest, RoleRequestStatus
from app.schemas.admin import (
    SystemConfigResponse,
    SystemConfigUpdate,
    SystemConfigBulkUpdate,
    UserListResponse,
    UserRoleUpdate,
    UserDetailResponse,
    UserFullProfileResponse,
    UserCompetencyItem,
    RoleRequestResponse,
    RoleRequestReject
)
from app.models.competency import CoachCompetency, CompetencyItem

router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================================
# Dashboard Statistics
# ============================================================================
class DashboardStatsResponse(BaseModel):
    """Dashboard statistics"""
    total_projects: int
    total_coaches: int
    total_applications: int
    pending_review_count: int  # 심사 대기 (제출됨 + 선발 대기)


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER", "VERIFIER", "REVIEWER"]))
):
    """
    Get dashboard statistics for admin users

    Returns counts for:
    - Total projects
    - Total registered coaches
    - Total applications
    - Selection completed count
    """
    # Count projects
    projects_result = await db.execute(select(func.count(Project.project_id)))
    total_projects = projects_result.scalar() or 0

    # Count coaches (users with COACH role)
    users_result = await db.execute(
        select(User).where(User.status == UserStatus.ACTIVE)
    )
    all_users = users_result.scalars().all()
    total_coaches = sum(1 for u in all_users if 'COACH' in get_user_roles(u) or 'coach' in get_user_roles(u))

    # Count applications
    applications_result = await db.execute(select(func.count(Application.application_id)))
    total_applications = applications_result.scalar() or 0

    # Count pending review applications (submitted + pending selection)
    pending_review_result = await db.execute(
        select(func.count(Application.application_id)).where(
            Application.status == "submitted",
            Application.selection_result == "pending"
        )
    )
    pending_review_count = pending_review_result.scalar() or 0

    return DashboardStatsResponse(
        total_projects=total_projects,
        total_coaches=total_coaches,
        total_applications=total_applications,
        pending_review_count=pending_review_count
    )


# ============================================================================
# System Config Endpoints
# ============================================================================
@router.get("/config", response_model=List[SystemConfigResponse])
async def get_all_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Get all system configurations (Super Admin only)"""
    result = await db.execute(select(SystemConfig))
    configs = result.scalars().all()
    return configs


@router.get("/config/{key}", response_model=SystemConfigResponse)
async def get_config(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Get a specific configuration (Super Admin only)"""
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Config key '{key}' not found"
        )
    return config


@router.put("/config/{key}", response_model=SystemConfigResponse)
async def update_config(
    key: str,
    update_data: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Update a configuration (Super Admin only)"""
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )
    config = result.scalar_one_or_none()

    if not config:
        # Create new config if not exists
        config = SystemConfig(
            key=key,
            value=update_data.value,
            updated_by=current_user.user_id
        )
        db.add(config)
    else:
        config.value = update_data.value
        config.updated_by = current_user.user_id

    await db.commit()
    await db.refresh(config)
    return config


@router.put("/config", response_model=List[SystemConfigResponse])
async def update_configs_bulk(
    update_data: SystemConfigBulkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Update multiple configurations at once (Super Admin only)"""
    updated_configs = []

    for key, value in update_data.configs.items():
        result = await db.execute(
            select(SystemConfig).where(SystemConfig.key == key)
        )
        config = result.scalar_one_or_none()

        if not config:
            config = SystemConfig(
                key=key,
                value=value,
                updated_by=current_user.user_id
            )
            db.add(config)
        else:
            config.value = value
            config.updated_by = current_user.user_id

        updated_configs.append(config)

    await db.commit()

    # Refresh all configs
    for config in updated_configs:
        await db.refresh(config)

    return updated_configs


# ============================================================================
# User Role Management Endpoints
# ============================================================================
@router.get("/users", response_model=List[UserListResponse])
async def list_users(
    role: str = Query(None, description="Filter by role"),
    search: str = Query(None, description="Search by name or email"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """List all users with their roles (Super Admin only)"""
    query = select(User).order_by(User.user_id)

    result = await db.execute(query)
    users = result.scalars().all()

    # Filter and transform
    response_list = []
    for user in users:
        user_roles = get_user_roles(user)

        # Apply role filter
        if role and role not in user_roles:
            continue

        # Apply search filter
        if search:
            search_lower = search.lower()
            if search_lower not in user.name.lower() and search_lower not in user.email.lower():
                continue

        response_list.append(UserListResponse(
            user_id=user.user_id,
            email=user.email,
            name=user.name,
            roles=user_roles,
            status=user.status.value,
            created_at=user.created_at
        ))

    return response_list


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Get user details (Super Admin only)"""
    result = await db.execute(
        select(User).where(User.user_id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    user_roles = get_user_roles(user)

    return UserDetailResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        roles=user_roles,
        status=user.status.value,
        created_at=user.created_at,
        birth_year=user.birth_year,
        gender=user.gender,
        address=user.address
    )


@router.get("/users/{user_id}/full-profile", response_model=UserFullProfileResponse)
async def get_user_full_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Get user's full profile including basic info and competencies.
    Accessible by SUPER_ADMIN and PROJECT_MANAGER.
    """
    # Get user
    result = await db.execute(
        select(User).where(User.user_id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    user_roles = get_user_roles(user)

    # Get user's competencies with item info
    competencies_result = await db.execute(
        select(CoachCompetency, CompetencyItem)
        .join(CompetencyItem, CoachCompetency.item_id == CompetencyItem.item_id)
        .where(CoachCompetency.user_id == user_id)
        .order_by(CompetencyItem.category, CompetencyItem.display_order)
    )
    competency_rows = competencies_result.all()

    competencies = []
    verified_count = 0
    for comp, item in competency_rows:
        competencies.append(UserCompetencyItem(
            competency_id=comp.competency_id,
            item_id=comp.item_id,
            item_name=item.item_name,
            item_code=item.item_code or "",
            category=item.category.value if item.category else "OTHER",
            value=comp.value,
            verification_status=comp.verification_status.value if comp.verification_status else "pending",
            verified_at=comp.verified_at
        ))
        if comp.verification_status and comp.verification_status.value == "verified":
            verified_count += 1

    return UserFullProfileResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        roles=user_roles,
        status=user.status.value,
        created_at=user.created_at,
        birth_year=user.birth_year,
        gender=user.gender,
        address=user.address,
        competencies=competencies,
        competency_count=len(competencies),
        verified_count=verified_count
    )


@router.put("/users/{user_id}/roles", response_model=UserDetailResponse)
async def update_user_roles(
    user_id: int,
    role_update: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Update user roles (Super Admin only)"""
    # Prevent self-demotion
    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own roles"
        )

    result = await db.execute(
        select(User).where(User.user_id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Validate roles
    valid_roles = [r.value for r in UserRole]
    for role in role_update.roles:
        if role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {role}. Valid roles are: {valid_roles}"
            )

    # Update roles
    user.roles = json.dumps(role_update.roles)

    await db.commit()
    await db.refresh(user)

    return UserDetailResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        roles=role_update.roles,
        status=user.status.value,
        created_at=user.created_at,
        birth_year=user.birth_year,
        gender=user.gender,
        address=user.address
    )


# ============================================================================
# Role Request Management Endpoints
# ============================================================================
@router.get("/role-requests", response_model=List[RoleRequestResponse])
async def list_role_requests(
    status_filter: str = Query(None, description="Filter by status: PENDING, APPROVED, REJECTED"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """List role requests (Super Admin only)"""
    query = select(RoleRequest).order_by(RoleRequest.requested_at.desc())

    if status_filter:
        query = query.where(RoleRequest.status == status_filter)

    result = await db.execute(query)
    requests = result.scalars().all()

    response_list = []
    for req in requests:
        # Get user info
        user_result = await db.execute(
            select(User).where(User.user_id == req.user_id)
        )
        user = user_result.scalar_one_or_none()

        # Get processor info if exists
        processor_name = None
        if req.processed_by:
            processor_result = await db.execute(
                select(User).where(User.user_id == req.processed_by)
            )
            processor = processor_result.scalar_one_or_none()
            processor_name = processor.name if processor else None

        response_list.append(RoleRequestResponse(
            request_id=req.request_id,
            user_id=req.user_id,
            user_name=user.name if user else "Unknown",
            user_email=user.email if user else "Unknown",
            user_phone=user.phone if user else None,
            requested_role=req.requested_role,
            status=req.status,
            requested_at=req.requested_at,
            processed_at=req.processed_at,
            processed_by=req.processed_by,
            processor_name=processor_name,
            rejection_reason=req.rejection_reason
        ))

    return response_list


@router.post("/role-requests/{request_id}/approve", response_model=RoleRequestResponse)
async def approve_role_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Approve a role request (Super Admin only)"""
    # Get the request
    result = await db.execute(
        select(RoleRequest).where(RoleRequest.request_id == request_id)
    )
    role_request = result.scalar_one_or_none()

    if not role_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role request {request_id} not found"
        )

    if role_request.status != RoleRequestStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role request is already {role_request.status}"
        )

    # Get the user
    user_result = await db.execute(
        select(User).where(User.user_id == role_request.user_id)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Add role to user
    current_roles = get_user_roles(user)

    if role_request.requested_role not in current_roles:
        current_roles.append(role_request.requested_role)
        user.roles = json.dumps(current_roles)

    # Update request status
    role_request.status = RoleRequestStatus.APPROVED.value
    role_request.processed_at = datetime.utcnow()
    role_request.processed_by = current_user.user_id

    await db.commit()
    await db.refresh(role_request)

    return RoleRequestResponse(
        request_id=role_request.request_id,
        user_id=role_request.user_id,
        user_name=user.name,
        user_email=user.email,
        user_phone=user.phone,
        requested_role=role_request.requested_role,
        status=role_request.status,
        requested_at=role_request.requested_at,
        processed_at=role_request.processed_at,
        processed_by=role_request.processed_by,
        processor_name=current_user.name,
        rejection_reason=None
    )


@router.post("/role-requests/{request_id}/reject", response_model=RoleRequestResponse)
async def reject_role_request(
    request_id: int,
    reject_data: RoleRequestReject,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Reject a role request with reason (Super Admin only)"""
    # Get the request
    result = await db.execute(
        select(RoleRequest).where(RoleRequest.request_id == request_id)
    )
    role_request = result.scalar_one_or_none()

    if not role_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role request {request_id} not found"
        )

    if role_request.status != RoleRequestStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role request is already {role_request.status}"
        )

    # Get user info
    user_result = await db.execute(
        select(User).where(User.user_id == role_request.user_id)
    )
    user = user_result.scalar_one_or_none()

    # Update request status
    role_request.status = RoleRequestStatus.REJECTED.value
    role_request.processed_at = datetime.utcnow()
    role_request.processed_by = current_user.user_id
    role_request.rejection_reason = reject_data.reason

    await db.commit()
    await db.refresh(role_request)

    return RoleRequestResponse(
        request_id=role_request.request_id,
        user_id=role_request.user_id,
        user_name=user.name if user else "Unknown",
        user_email=user.email if user else "Unknown",
        user_phone=user.phone if user else None,
        requested_role=role_request.requested_role,
        status=role_request.status,
        requested_at=role_request.requested_at,
        processed_at=role_request.processed_at,
        processed_by=role_request.processed_by,
        processor_name=current_user.name,
        rejection_reason=role_request.rejection_reason
    )


@router.get("/role-requests/count")
async def get_pending_role_requests_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """Get count of pending role requests (Super Admin only)"""
    result = await db.execute(
        select(RoleRequest).where(RoleRequest.status == RoleRequestStatus.PENDING.value)
    )
    requests = result.scalars().all()
    return {"pending_count": len(requests)}


# ============================================================================
# Helper: Initialize default configs
# ============================================================================
async def init_default_configs(db: AsyncSession):
    """Initialize default system configurations"""
    defaults = {
        ConfigKeys.REQUIRED_VERIFIER_COUNT: ("2", "증빙 확정에 필요한 Verifier 수")
    }

    for key, (value, description) in defaults.items():
        result = await db.execute(
            select(SystemConfig).where(SystemConfig.key == key)
        )
        if not result.scalar_one_or_none():
            config = SystemConfig(
                key=key,
                value=value,
                description=description
            )
            db.add(config)

    await db.commit()


# ============================================================================
# Clear and Seed Competency Items Endpoint
# ============================================================================
@router.post("/clear-competency-items")
async def clear_competency_items(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """Clear all competency items (requires secret key)

    WARNING: This will also delete all coach_competencies and related data!
    """
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from sqlalchemy import text
    try:
        # PostgreSQL TRUNCATE CASCADE - 모든 FK 제약조건 자동 처리
        # competency_items를 참조하는 모든 테이블도 함께 삭제됨
        await db.execute(text("TRUNCATE TABLE competency_items CASCADE"))
        await db.commit()
        return {"message": "All competency items and related data cleared (CASCADE)"}
    except Exception as e:
        import traceback
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Clear failed: {str(e)}\n{traceback.format_exc()}"
        )


@router.post("/seed-competency-items")
async def seed_competency_items(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """Seed default competency items (requires secret key)"""
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    try:
        from app.models.competency import (
            CompetencyItem, CompetencyItemField,
            CompetencyCategory, InputType, ItemTemplate
        )
        print(f"[SEED] Import successful: CompetencyCategory={CompetencyCategory}, ItemTemplate={ItemTemplate}")
    except Exception as e:
        print(f"[SEED] Import failed: {str(e)}")
        return {"error": f"Import failed: {str(e)}"}

    # 재설계된 역량 항목 구조 (2026-01-15)
    items_data = [
        # ===== 자격증 그룹 (CERTIFICATION) =====
        {
            "item_name": "코칭 관련 자격증",
            "item_code": "CERT_COACH",
            "category": CompetencyCategory.CERTIFICATION,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증 명칭", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "cert_year", "field_label": "취득연도", "field_type": "number", "is_required": True, "display_order": 2},
                {"field_name": "cert_file", "field_label": "증빙서류", "field_type": "file", "is_required": True, "display_order": 3}
            ]
        },
        {
            "item_name": "상담/심리치료 관련 자격",
            "item_code": "CERT_COUNSELING",
            "category": CompetencyCategory.CERTIFICATION,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증 명칭", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "cert_year", "field_label": "취득연도", "field_type": "number", "is_required": True, "display_order": 2},
                {"field_name": "cert_file", "field_label": "증빙서류", "field_type": "file", "is_required": True, "display_order": 3}
            ]
        },
        {
            "item_name": "기타 자격증",
            "item_code": "CERT_OTHER",
            "category": CompetencyCategory.CERTIFICATION,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증 명칭", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "cert_year", "field_label": "취득연도", "field_type": "number", "is_required": True, "display_order": 2},
                {"field_name": "cert_file", "field_label": "증빙서류", "field_type": "file", "is_required": True, "display_order": 3}
            ]
        },
        # ===== 학력 그룹 (EDUCATION) =====
        {
            "item_name": "코칭/상담 관련 최종학력",
            "item_code": "EDU_COACHING",
            "category": CompetencyCategory.EDUCATION,
            "template": ItemTemplate.DEGREE,
            "template_config": json.dumps({"degree_options": ["박사", "석사", "학사", "전문학사", "없음"]}),
            "is_repeatable": False,
            "fields": [
                {"field_name": "degree_level", "field_label": "학위", "field_type": "select",
                 "field_options": json.dumps(["박사", "석사", "학사", "전문학사", "없음"]), "is_required": True, "display_order": 1},
                {"field_name": "school", "field_label": "학교명", "field_type": "text", "is_required": True, "display_order": 2},
                {"field_name": "major", "field_label": "전공", "field_type": "text", "is_required": True, "display_order": 3},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 4}
            ]
        },
        {
            "item_name": "기타 분야 최종학력",
            "item_code": "EDU_OTHER",
            "category": CompetencyCategory.EDUCATION,
            "template": ItemTemplate.DEGREE,
            "template_config": json.dumps({"degree_options": ["박사", "석사", "학사", "전문학사", "없음"]}),
            "is_repeatable": False,
            "fields": [
                {"field_name": "degree_level", "field_label": "학위", "field_type": "select",
                 "field_options": json.dumps(["박사", "석사", "학사", "전문학사", "없음"]), "is_required": True, "display_order": 1},
                {"field_name": "school", "field_label": "학교명", "field_type": "text", "is_required": True, "display_order": 2},
                {"field_name": "major", "field_label": "전공", "field_type": "text", "is_required": True, "display_order": 3},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 4}
            ]
        },
        # ===== 코칭연수 그룹 (EXPERIENCE - 별도 그룹) =====
        {
            "item_name": "코칭관련 연수",
            "item_code": "EXP_COACHING_TRAINING",
            "category": CompetencyCategory.EXPERIENCE,
            "template": ItemTemplate.COACHING_TIME,
            "is_repeatable": True,
            "max_entries": 20,
            "fields": [
                {"field_name": "description", "field_label": "연수명/내용", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "year", "field_label": "이수연도", "field_type": "number", "is_required": True, "display_order": 2},
                {"field_name": "hours", "field_label": "이수시간", "field_type": "number", "is_required": True, "display_order": 3},
                {"field_name": "proof", "field_label": "증빙서류", "field_type": "file", "is_required": False, "display_order": 4}
            ]
        },
        # ===== 코칭경력 그룹 (EXPERIENCE) =====
        {
            "item_name": "누적 코칭 시간",
            "item_code": "EXP_COACHING_HOURS",
            "category": CompetencyCategory.EXPERIENCE,
            "template": ItemTemplate.NUMBER,
            "is_repeatable": False,
            "fields": [
                {"field_name": "hours", "field_label": "시간", "field_type": "number", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "코칭일지", "field_type": "file", "is_required": False, "display_order": 2}
            ]
        },
        # ===== KCA 인증자격 (CERTIFICATION - 특수 항목) =====
        {
            "item_name": "KCA 인증자격",
            "item_code": "CERT_KCA",
            "category": CompetencyCategory.CERTIFICATION,
            "is_repeatable": False,
            "description": "회원가입 시 입력한 코칭자격인증번호에서 자동 판별됩니다. (KSC/KPC/KAC)",
            # Phase 4: 평가 설정
            "data_source": "user_profile",
            "evaluation_method": "standard",
            "grade_type": "string",
            "matching_type": "grade",
            "grade_edit_mode": "fixed",
            # Phase 5: 점수 소스 설정
            "scoring_value_source": "user_field",
            "scoring_source_field": "coach_certification_number",
            "extract_pattern": "^(.{3})",
            # 등급 매핑: KSC→30, KPC→20, KAC→10
            "grade_mappings": json.dumps([
                {"value": "KSC", "score": 30, "label": "한국코칭수퍼바이저"},
                {"value": "KPC", "score": 20, "label": "전문코치"},
                {"value": "KAC", "score": 10, "label": "코치"}
            ]),
            "proof_required": "not_required",
            "help_text": "코칭자격인증번호(예: KPC03669)의 앞 3자리로 등급이 자동 판별됩니다.",
            "fields": []  # 코치가 직접 입력할 필드 없음 - 사용자 프로필에서 자동 읽기
        },
        # 기타 그룹 (OTHER): 기본 항목 없음 - 커스텀 항목만 추가 가능
        # 자기소개: users.introduction으로 이동
        # 전문분야: 삭제
    ]

    created_count = 0
    skipped_count = 0
    print(f"[SEED] Starting seed with {len(items_data)} items")

    try:
        for item_data in items_data:
            item_code = item_data["item_code"]
            print(f"[SEED] Processing item: {item_code}")

            # Check if already exists
            result = await db.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == item_code)
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"[SEED] Item {item_code} already exists, skipping")
                skipped_count += 1
                continue

            fields_data = item_data.get("fields", [])

            item = CompetencyItem(
                item_name=item_data["item_name"],
                item_code=item_data["item_code"],
                category=item_data["category"],
                input_type=InputType.TEXT,  # Deprecated but required
                is_active=True,
                template=item_data.get("template"),
                template_config=item_data.get("template_config"),
                is_repeatable=item_data.get("is_repeatable", False),
                max_entries=item_data.get("max_entries"),
                description=item_data.get("description"),
                is_custom=False,
                # Phase 4: 평가 설정
                data_source=item_data.get("data_source", "form_input"),
                evaluation_method=item_data.get("evaluation_method", "standard"),
                grade_type=item_data.get("grade_type"),
                matching_type=item_data.get("matching_type"),
                grade_edit_mode=item_data.get("grade_edit_mode", "flexible"),
                # Phase 5: 점수 소스 설정
                scoring_value_source=item_data.get("scoring_value_source", "submitted"),
                scoring_source_field=item_data.get("scoring_source_field"),
                extract_pattern=item_data.get("extract_pattern"),
                # 독립 관리 필드
                grade_mappings=item_data.get("grade_mappings"),
                proof_required=item_data.get("proof_required"),
                help_text=item_data.get("help_text")
            )
            db.add(item)
            await db.flush()
            print(f"[SEED] Created item {item_code} with item_id={item.item_id}")

            for field_data in fields_data:
                field = CompetencyItemField(
                    item_id=item.item_id,
                    field_name=field_data["field_name"],
                    field_label=field_data["field_label"],
                    field_type=field_data["field_type"],
                    field_options=field_data.get("field_options"),
                    is_required=field_data.get("is_required", True),
                    display_order=field_data["display_order"],
                    placeholder=field_data.get("placeholder")
                )
                db.add(field)

            created_count += 1
            print(f"[SEED] Item {item_code} created with {len(fields_data)} fields")

        await db.commit()
        print(f"[SEED] Committed. Created={created_count}, Skipped={skipped_count}")
    except Exception as e:
        import traceback
        print(f"[SEED] Error: {str(e)}\n{traceback.format_exc()}")
        return {"error": f"Seed failed: {str(e)}", "traceback": traceback.format_exc()}

    return {
        "message": "Seed completed",
        "created": created_count,
        "skipped": skipped_count
    }


# ============================================================================
# Reset Project Data Endpoint
# ============================================================================
@router.post("/reset-project-data")
async def reset_project_data(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset all project-related data while keeping user accounts.

    Deletes:
    - All projects, applications, and related data
    - All coach competencies and verification records
    - All competency items (master data)
    - All files (database records and R2 storage)
    - All notifications, certifications, education history

    Keeps:
    - User accounts (basic info only)
    - System configurations
    - Role requests

    WARNING: This is a destructive operation and cannot be undone!
    """
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from sqlalchemy import text
    from app.core.config import settings

    deleted_counts = {}
    errors = []

    try:
        # Order matters due to foreign key constraints
        tables_to_delete = [
            # First: tables that reference others
            "verification_records",
            "custom_question_answers",
            "application_data",
            "coach_evaluations",
            "review_locks",
            "competency_reminders",
            # Second: main tables
            "applications",
            "scoring_criteria",
            "project_items",
            "custom_questions",
            "project_staff",
            "projects",
            # Third: coach data
            "coach_competencies",
            "certifications",
            "coach_education_history",
            "coach_profiles",
            # Fourth: files and notifications
            "notifications",
        ]

        for table in tables_to_delete:
            try:
                # Count before delete
                count_result = await db.execute(text(f"SELECT count(*) FROM {table}"))
                count = count_result.scalar() or 0

                # Delete
                await db.execute(text(f"DELETE FROM {table}"))
                deleted_counts[table] = count
            except Exception as e:
                errors.append(f"{table}: {str(e)}")
                await db.rollback()

        # Delete competency items (master data) - fields first due to FK
        try:
            count_result = await db.execute(text("SELECT count(*) FROM competency_item_fields"))
            field_count = count_result.scalar() or 0
            await db.execute(text("DELETE FROM competency_item_fields"))
            deleted_counts["competency_item_fields"] = field_count

            count_result = await db.execute(text("SELECT count(*) FROM competency_items"))
            item_count = count_result.scalar() or 0
            await db.execute(text("DELETE FROM competency_items"))
            deleted_counts["competency_items"] = item_count
        except Exception as e:
            errors.append(f"competency_items: {str(e)}")

        # Handle files separately - also clean R2 storage
        try:
            from app.models.file import File as FileModel

            # Get all files for R2 cleanup
            files_result = await db.execute(select(FileModel))
            all_files = files_result.scalars().all()
            file_count = len(all_files)

            # Clean R2 storage
            if settings.FILE_STORAGE_TYPE == "r2" and all_files:
                try:
                    from app.api.endpoints.files import get_r2_client
                    r2_client = get_r2_client()

                    for db_file in all_files:
                        try:
                            r2_client.remove_object(settings.R2_BUCKET, db_file.file_path)
                        except Exception:
                            pass  # Ignore individual file deletion errors
                except Exception as e:
                    errors.append(f"R2 cleanup error: {str(e)}")

            # Delete file records
            await db.execute(text("DELETE FROM files"))
            deleted_counts["files"] = file_count

        except Exception as e:
            errors.append(f"files: {str(e)}")

        await db.commit()

        return {
            "message": "Project data reset completed",
            "deleted_counts": deleted_counts,
            "errors": errors if errors else None,
            "kept_tables": ["users", "system_configs", "role_requests"]
        }

    except Exception as e:
        import traceback
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Reset failed: {str(e)}\n{traceback.format_exc()}"
        )


# ============================================================================
# Reset Project Only (과제초기화) - Keep user competency data
# ============================================================================
@router.post("/reset-project-only")
async def reset_project_only(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """
    과제초기화: Reset project data only, keeping all user competency data.

    Deletes:
    - All projects, applications, and related data
    - Verification records, project items, scoring criteria
    - Project-related files only

    Keeps:
    - User accounts and profiles
    - Coach competencies (역량정보)
    - Competency items (master data)
    - Files attached to competencies
    - System configurations

    WARNING: This is a destructive operation and cannot be undone!
    """
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from sqlalchemy import text
    from app.core.config import settings

    deleted_counts = {}
    errors = []

    try:
        # Tables to delete - project-related only
        # Note: coach_competencies, certifications, coach_education_history are KEPT
        tables_to_delete = [
            # First: tables that reference projects/applications
            "verification_records",
            "custom_question_answers",
            "application_data",
            "coach_evaluations",
            "review_locks",
            # Second: main project tables
            "applications",
            "scoring_criteria",
            "project_items",
            "custom_questions",
            "project_staff",
            "projects",
            # Notifications (project-related)
            "notifications",
        ]

        for table in tables_to_delete:
            try:
                count_result = await db.execute(text(f"SELECT count(*) FROM {table}"))
                count = count_result.scalar() or 0
                await db.execute(text(f"DELETE FROM {table}"))
                deleted_counts[table] = count
            except Exception as e:
                errors.append(f"{table}: {str(e)}")
                await db.rollback()

        # Handle files - only delete files NOT linked to competencies
        try:
            from app.models.file import File as FileModel
            from app.models.competency import CoachCompetency

            # Get all file IDs that are referenced in coach_competencies
            competency_result = await db.execute(select(CoachCompetency))
            all_competencies = competency_result.scalars().all()

            # Extract file_ids from competency data (stored in JSON)
            competency_file_ids = set()
            for comp in all_competencies:
                if comp.data and isinstance(comp.data, dict):
                    file_id = comp.data.get('file_id')
                    if file_id:
                        competency_file_ids.add(file_id)

            # Get all files
            files_result = await db.execute(select(FileModel))
            all_files = files_result.scalars().all()

            # Separate files to delete vs keep
            files_to_delete = [f for f in all_files if f.id not in competency_file_ids]
            files_to_keep = [f for f in all_files if f.id in competency_file_ids]

            # Clean R2 storage for files to delete
            if settings.FILE_STORAGE_TYPE == "r2" and files_to_delete:
                try:
                    from app.api.endpoints.files import get_r2_client
                    r2_client = get_r2_client()

                    for db_file in files_to_delete:
                        try:
                            r2_client.remove_object(settings.R2_BUCKET, db_file.file_path)
                        except Exception:
                            pass
                except Exception as e:
                    errors.append(f"R2 cleanup error: {str(e)}")

            # Delete only non-competency files from database
            for f in files_to_delete:
                await db.execute(text(f"DELETE FROM files WHERE id = {f.id}"))

            deleted_counts["files"] = len(files_to_delete)
            deleted_counts["files_kept (competency)"] = len(files_to_keep)

        except Exception as e:
            errors.append(f"files: {str(e)}")

        await db.commit()

        return {
            "message": "과제초기화 완료 (Project data reset, competencies kept)",
            "deleted_counts": deleted_counts,
            "errors": errors if errors else None,
            "kept_tables": [
                "users", "coach_competencies", "certifications",
                "coach_education_history", "coach_profiles",
                "competency_items", "competency_item_fields",
                "files (linked to competencies)"
            ]
        }

    except Exception as e:
        import traceback
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Reset failed: {str(e)}\n{traceback.format_exc()}"
        )


# ============================================================================
# Reset Full (기본초기화) - Reset competencies too
# ============================================================================
@router.post("/reset-full")
async def reset_full(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """
    기본초기화: Reset all user-entered data except basic user info.

    Deletes:
    - All projects, applications, and related data
    - All coach competencies (user-entered competency data)
    - All files (database records and R2 storage)
    - All notifications, certifications, education history

    Keeps:
    - User accounts (basic info only)
    - Competency items (master data structure)
    - System configurations
    - Role requests

    WARNING: This is a destructive operation and cannot be undone!
    """
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from sqlalchemy import text
    from app.core.config import settings

    deleted_counts = {}
    errors = []

    try:
        # Order matters due to foreign key constraints
        tables_to_delete = [
            # First: tables that reference others
            "verification_records",
            "custom_question_answers",
            "application_data",
            "coach_evaluations",
            "review_locks",
            "competency_reminders",
            # Second: main tables
            "applications",
            "scoring_criteria",
            "project_items",
            "custom_questions",
            "project_staff",
            "projects",
            # Third: coach data (INCLUDING competencies)
            "coach_competencies",
            "certifications",
            "coach_education_history",
            "coach_profiles",
            # Fourth: files and notifications
            "notifications",
        ]

        for table in tables_to_delete:
            try:
                count_result = await db.execute(text(f"SELECT count(*) FROM {table}"))
                count = count_result.scalar() or 0
                await db.execute(text(f"DELETE FROM {table}"))
                deleted_counts[table] = count
            except Exception as e:
                errors.append(f"{table}: {str(e)}")
                await db.rollback()

        # Handle files - delete ALL and clean R2 storage
        try:
            from app.models.file import File as FileModel

            files_result = await db.execute(select(FileModel))
            all_files = files_result.scalars().all()
            file_count = len(all_files)

            if settings.FILE_STORAGE_TYPE == "r2" and all_files:
                try:
                    from app.api.endpoints.files import get_r2_client
                    r2_client = get_r2_client()

                    for db_file in all_files:
                        try:
                            r2_client.remove_object(settings.R2_BUCKET, db_file.file_path)
                        except Exception:
                            pass
                except Exception as e:
                    errors.append(f"R2 cleanup error: {str(e)}")

            await db.execute(text("DELETE FROM files"))
            deleted_counts["files"] = file_count

        except Exception as e:
            errors.append(f"files: {str(e)}")

        await db.commit()

        return {
            "message": "기본초기화 완료 (Full reset, only basic user info kept)",
            "deleted_counts": deleted_counts,
            "errors": errors if errors else None,
            "kept_tables": [
                "users", "competency_items", "competency_item_fields",
                "system_configs", "role_requests"
            ]
        }

    except Exception as e:
        import traceback
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Reset failed: {str(e)}\n{traceback.format_exc()}"
        )


# ============================================================================
# Database Migration Endpoints
# ============================================================================
@router.get("/migration-status")
async def get_migration_status(
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Get current database migration status

    Returns current revision and pending migrations.
    """
    import subprocess
    import os

    try:
        # Get the backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

        # Run alembic current
        result = subprocess.run(
            ["alembic", "current"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        current_revision = result.stdout.strip() if result.returncode == 0 else f"Error: {result.stderr}"

        # Run alembic history
        result = subprocess.run(
            ["alembic", "history", "--verbose", "-r", "-3:"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        recent_history = result.stdout.strip() if result.returncode == 0 else f"Error: {result.stderr}"

        return {
            "current_revision": current_revision,
            "recent_history": recent_history
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check migration status: {str(e)}"
        )


@router.post("/run-migrations")
async def run_migrations(
    current_user: User = Depends(require_role(["SUPER_ADMIN", "PROJECT_MANAGER"]))
):
    """
    Run pending database migrations (alembic upgrade head)

    Use this to apply pending migrations to the production database.
    """
    import subprocess
    import os

    try:
        # Get the backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

        # Run alembic upgrade head
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            return {
                "success": True,
                "message": "Migrations completed successfully",
                "output": result.stdout
            }
        else:
            return {
                "success": False,
                "message": "Migration failed",
                "error": result.stderr,
                "output": result.stdout
            }
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Migration timed out after 60 seconds"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to run migrations: {str(e)}"
        )


# ============================================================================
# User Bulk Delete
# ============================================================================
@router.delete("/users/bulk-delete")
async def bulk_delete_users(
    user_ids: List[int] = Body(..., embed=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    Bulk delete multiple users and all related data

    **Required roles**: SUPER_ADMIN only

    Deletes users and cascades to:
    - Applications, ApplicationData
    - Evaluations, ReviewerEvaluations
    - Competencies, Certifications, Education
    - RoleRequests
    - Notifications
    - Files (competency_files, education_files, certification_files)
    - etc.

    **Safety**: Cannot delete SUPER_ADMIN users or self
    """
    import traceback
    from sqlalchemy import text

    if not user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_ids cannot be empty"
        )

    print(f"[BULK DELETE USERS] Starting bulk delete for user_ids={user_ids} by user_id={current_user.user_id}")

    deleted_count = 0
    skipped_users = []

    try:
        for user_id in user_ids:
            # 사용자 존재 확인
            user = await db.get(User, user_id)
            if not user:
                print(f"[BULK DELETE USERS] Skipping non-existent user_id={user_id}")
                continue

            # 자기 자신은 삭제 불가
            if user_id == current_user.user_id:
                print(f"[BULK DELETE USERS] Skipping self-delete: user_id={user_id}")
                skipped_users.append({"user_id": user_id, "reason": "자기 자신은 삭제할 수 없습니다"})
                continue

            # SUPER_ADMIN은 삭제 불가
            user_roles = get_user_roles(user)
            if "SUPER_ADMIN" in user_roles:
                print(f"[BULK DELETE USERS] Skipping SUPER_ADMIN: user_id={user_id}")
                skipped_users.append({"user_id": user_id, "reason": "SUPER_ADMIN은 삭제할 수 없습니다"})
                continue

            print(f"[BULK DELETE USERS] Deleting user: {user.name} ({user.email})")

            # 관련 데이터 삭제 (cascade)

            # 0. Coach Evaluations 삭제 (코치 평가 데이터)
            await db.execute(text("""
                DELETE FROM coach_evaluations WHERE coach_user_id = :user_id OR evaluated_by = :user_id
            """), {"user_id": user_id})

            # 0-1. Verification Records 삭제 (검증 기록)
            await db.execute(text("""
                DELETE FROM verification_records WHERE verifier_id = :user_id
            """), {"user_id": user_id})

            # 0-2. Projects FK 업데이트 (project_manager_id, created_by)
            await db.execute(text("""
                UPDATE projects SET project_manager_id = NULL WHERE project_manager_id = :user_id
            """), {"user_id": user_id})

            # created_by는 NOT NULL이므로 현재 관리자에게 재할당
            await db.execute(text("""
                UPDATE projects SET created_by = :admin_id WHERE created_by = :user_id
            """), {"user_id": user_id, "admin_id": current_user.user_id})

            # 0-3. RoleRequests processed_by 업데이트
            await db.execute(text("""
                UPDATE role_requests SET processed_by = NULL WHERE processed_by = :user_id
            """), {"user_id": user_id})

            # 0-4. ApplicationData reviewed_by 업데이트
            await db.execute(text("""
                UPDATE application_data SET reviewed_by = NULL WHERE reviewed_by = :user_id
            """), {"user_id": user_id})

            # 0-5. CompetencyItems created_by 업데이트
            await db.execute(text("""
                UPDATE competency_items SET created_by = NULL WHERE created_by = :user_id
            """), {"user_id": user_id})

            # 0-6. CoachCompetencies verified_by 업데이트
            await db.execute(text("""
                UPDATE coach_competencies SET verified_by = NULL WHERE verified_by = :user_id
            """), {"user_id": user_id})

            # 0-7. SystemConfig updated_by 업데이트
            await db.execute(text("""
                UPDATE system_config SET updated_by = NULL WHERE updated_by = :user_id
            """), {"user_id": user_id})

            # 1. ApplicationData 삭제 (applications FK)
            await db.execute(text("""
                DELETE FROM application_data
                WHERE application_id IN (SELECT application_id FROM applications WHERE user_id = :user_id)
            """), {"user_id": user_id})

            # 2. ReviewerEvaluations 삭제
            await db.execute(text("""
                DELETE FROM reviewer_evaluations
                WHERE application_id IN (SELECT application_id FROM applications WHERE user_id = :user_id)
            """), {"user_id": user_id})

            # 2-1. 본인이 리뷰어로 작성한 평가도 삭제
            await db.execute(text("""
                DELETE FROM reviewer_evaluations WHERE reviewer_id = :user_id
            """), {"user_id": user_id})

            # 3. ReviewLocks 삭제
            await db.execute(text("""
                DELETE FROM review_locks
                WHERE application_id IN (SELECT application_id FROM applications WHERE user_id = :user_id)
            """), {"user_id": user_id})

            await db.execute(text("""
                DELETE FROM review_locks WHERE reviewer_id = :user_id
            """), {"user_id": user_id})

            # 4. Notifications 삭제
            await db.execute(text("""
                DELETE FROM notifications WHERE user_id = :user_id
            """), {"user_id": user_id})

            await db.execute(text("""
                UPDATE notifications SET related_application_id = NULL
                WHERE related_application_id IN (SELECT application_id FROM applications WHERE user_id = :user_id)
            """), {"user_id": user_id})

            # 5. CustomQuestionAnswers 삭제
            await db.execute(text("""
                DELETE FROM custom_question_answers
                WHERE application_id IN (SELECT application_id FROM applications WHERE user_id = :user_id)
            """), {"user_id": user_id})

            # 6. Applications 삭제
            await db.execute(text("""
                DELETE FROM applications WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 7. 파일 참조 테이블 먼저 삭제 (Files FK 참조 순서 중요!)
            # 7-1. Coach Competencies 삭제
            await db.execute(text("""
                DELETE FROM coach_competencies WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 7-2. Coach Education History 삭제 (certificate_file_id FK)
            await db.execute(text("""
                DELETE FROM coach_education_history WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 7-3. Certifications 삭제 (certificate_file_id FK)
            await db.execute(text("""
                DELETE FROM certifications WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 7-4. Files 삭제 (사용자가 업로드한 모든 파일 - FK 참조 해제 후)
            await db.execute(text("""
                DELETE FROM files WHERE uploaded_by = :user_id
            """), {"user_id": user_id})

            # 11. Coach Profile 삭제
            await db.execute(text("""
                DELETE FROM coach_profiles WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 12. Competency Reminders 삭제
            await db.execute(text("""
                DELETE FROM competency_reminders WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 10. RoleRequests 삭제
            await db.execute(text("""
                DELETE FROM role_requests WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 11. ProjectStaff 삭제 (심사위원/검토자 배정)
            await db.execute(text("""
                DELETE FROM project_staff WHERE staff_user_id = :user_id
            """), {"user_id": user_id})

            # 12. User 삭제
            await db.delete(user)
            deleted_count += 1

        await db.commit()
        print(f"[BULK DELETE USERS] Completed: deleted {deleted_count} users")

        return {
            "deleted_count": deleted_count,
            "skipped_users": skipped_users,
            "message": f"{deleted_count}명의 사용자가 삭제되었습니다."
        }

    except Exception as e:
        await db.rollback()
        print(f"[BULK DELETE USERS] Error: {str(e)}")
        print(f"[BULK DELETE USERS] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 삭제 중 오류가 발생했습니다: {str(e)}"
        )


# ============================================================================
# Admin Password Reset
# ============================================================================
class AdminPasswordReset(BaseModel):
    new_password: str


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: int,
    password_data: AdminPasswordReset,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    Force reset a user's password (SUPER_ADMIN only)

    **Required roles**: SUPER_ADMIN only

    Cannot reset:
    - Own password (use profile settings instead)
    - Other SUPER_ADMIN passwords
    """
    # 자기 자신 비밀번호는 여기서 변경 불가
    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자신의 비밀번호는 프로필 설정에서 변경해주세요."
        )

    # 대상 사용자 조회
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"사용자를 찾을 수 없습니다. (ID: {user_id})"
        )

    # 다른 SUPER_ADMIN 비밀번호 변경 불가
    target_roles = get_user_roles(user)
    if "SUPER_ADMIN" in target_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="다른 SUPER_ADMIN의 비밀번호는 변경할 수 없습니다."
        )

    # 비밀번호 최소 길이 검증
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 8자 이상이어야 합니다."
        )

    # 비밀번호 해시 및 저장
    user.hashed_password = get_password_hash(password_data.new_password)
    await db.commit()

    print(f"[ADMIN RESET PASSWORD] User {user.email} password reset by admin {current_user.user_id}")

    return {
        "message": f"{user.name}({user.email})님의 비밀번호가 변경되었습니다.",
        "user_id": user_id
    }


@router.post("/test-email")
async def test_email(
    to_email: str = Body(..., embed=True),
    current_user: User = Depends(require_role(["SUPER_ADMIN"]))
):
    """
    Test email sending (SUPER_ADMIN only)
    """
    from app.core.email import send_email
    from app.core.config import settings

    # Show current SMTP config
    smtp_info = {
        "SMTP_HOST": settings.SMTP_HOST,
        "SMTP_PORT": settings.SMTP_PORT,
        "SMTP_USER": settings.SMTP_USER,
        "SMTP_FROM_EMAIL": settings.SMTP_FROM_EMAIL,
        "SMTP_PASSWORD_SET": bool(settings.SMTP_PASSWORD)
    }
    print(f"[TEST EMAIL] SMTP Config: {smtp_info}")

    # Send test email
    result = await send_email(
        to_email=to_email,
        subject="[CoachDB] 테스트 이메일",
        html_content="<h1>테스트 이메일</h1><p>이메일 발송이 정상적으로 작동합니다.</p>",
        text_content="테스트 이메일입니다. 이메일 발송이 정상적으로 작동합니다."
    )

    return {
        "success": result,
        "to_email": to_email,
        "smtp_config": smtp_info,
        "message": "이메일 발송 성공" if result else "이메일 발송 실패 - Railway 로그 확인"
    }


# ============================================================================
# Delete Users by Email Pattern (Secret Key)
# ============================================================================
@router.delete("/users/by-email-pattern")
async def delete_users_by_email_pattern(
    pattern: str,
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete users whose email starts with the given pattern.

    Requires secret_key for authentication.
    Does NOT delete SUPER_ADMIN users.
    """
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    if not pattern or len(pattern) < 3:
        raise HTTPException(
            status_code=400,
            detail="Pattern must be at least 3 characters"
        )

    from sqlalchemy import text
    import traceback

    try:
        # Find users matching the pattern
        result = await db.execute(
            select(User).where(User.email.like(f"{pattern}%"))
        )
        users_to_delete = result.scalars().all()

        deleted_emails = []
        skipped_emails = []

        for user in users_to_delete:
            # Skip SUPER_ADMIN
            try:
                import json
                roles = json.loads(user.roles) if user.roles else []
                if "SUPER_ADMIN" in roles:
                    skipped_emails.append(f"{user.email} (SUPER_ADMIN)")
                    continue
            except:
                pass

            # Delete related data first
            user_id = user.user_id

            # Delete in order of dependencies
            await db.execute(text("DELETE FROM coach_evaluations WHERE coach_user_id = :uid OR evaluated_by = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM verification_records WHERE verifier_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM custom_question_answers WHERE application_id IN (SELECT application_id FROM applications WHERE user_id = :uid)"), {"uid": user_id})
            await db.execute(text("DELETE FROM application_data WHERE application_id IN (SELECT application_id FROM applications WHERE user_id = :uid)"), {"uid": user_id})
            await db.execute(text("DELETE FROM reviewer_evaluations WHERE reviewer_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM review_locks WHERE reviewer_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM notifications WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM applications WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM coach_competencies WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM coach_education_history WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM certifications WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM files WHERE uploaded_by = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM coach_profiles WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM competency_reminders WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM role_requests WHERE user_id = :uid"), {"uid": user_id})
            await db.execute(text("DELETE FROM project_staff WHERE staff_user_id = :uid"), {"uid": user_id})

            # Delete the user
            await db.delete(user)
            deleted_emails.append(user.email)

        await db.commit()

        return {
            "message": f"Deleted {len(deleted_emails)} users matching pattern '{pattern}%'",
            "deleted_emails": deleted_emails,
            "skipped_emails": skipped_emails,
            "deleted_count": len(deleted_emails)
        }

    except Exception as e:
        await db.rollback()
        print(f"[DELETE BY PATTERN] Error: {str(e)}")
        print(f"[DELETE BY PATTERN] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting users: {str(e)}"
        )


# ============================================================================
# Create Sample Project (Secret Key)
# ============================================================================
@router.post("/create-sample-project")
async def create_sample_project(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a sample project with all competency items set to required with proof required.
    Includes complete scoring criteria with grades.

    Creator: SUPER_ADMIN
    Reviewers: SUPER_ADMIN, viproject@naver.com
    """
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    import json
    import traceback
    from datetime import datetime, timedelta
    from decimal import Decimal
    from app.models.project import Project, ProjectStatus
    from app.models.competency import (
        CompetencyItem, ProjectItem, ScoringCriteria,
        ProofRequiredLevel, MatchingType, ValueSourceType
    )
    from app.models.project import ProjectStaff

    try:
        # 1. Find SUPER_ADMIN user
        result = await db.execute(
            select(User).where(User.roles.like('%SUPER_ADMIN%'))
        )
        super_admin = result.scalars().first()
        if not super_admin:
            raise HTTPException(status_code=404, detail="SUPER_ADMIN user not found")

        # 2. Find viproject@naver.com user
        result = await db.execute(
            select(User).where(User.email == "viproject@naver.com")
        )
        viproject_user = result.scalar_one_or_none()
        if not viproject_user:
            raise HTTPException(status_code=404, detail="viproject@naver.com user not found")

        # 3. Set dates
        today = datetime.now().date()
        recruitment_end = today + timedelta(days=30)
        project_start = recruitment_end + timedelta(days=7)
        project_end = project_start + timedelta(days=180)

        # 4. Create project
        new_project = Project(
            project_name="견본과제",
            description="모든 항목을 필수로 설정한 견본과제입니다. 복사하여 과제에 맞게 수정하여 사용하십시요.",
            recruitment_start_date=today,
            recruitment_end_date=recruitment_end,
            project_start_date=project_start,
            project_end_date=project_end,
            max_participants=50,
            status=ProjectStatus.DRAFT,  # 초안 상태로 생성
            project_manager_id=super_admin.user_id,
            created_by=super_admin.user_id
        )
        db.add(new_project)
        await db.flush()

        # 5. Get all active competency items
        result = await db.execute(
            select(CompetencyItem).where(CompetencyItem.is_active == True).order_by(CompetencyItem.item_id)
        )
        all_items = result.scalars().all()

        if not all_items:
            raise HTTPException(status_code=404, detail="No active competency items found")

        # 6. Calculate score distribution (100 points total, integers only)
        item_count = len(all_items)
        base_score = 100 // item_count  # 정수 나눗셈
        remainder = 100 - (base_score * item_count)  # 남은 점수

        # 7. Add project items with scoring criteria
        project_items_created = []
        for i, comp_item in enumerate(all_items):
            # Distribute score - add remainder to first N items (1 point each)
            if i < remainder:
                score = Decimal(base_score + 1)
            else:
                score = Decimal(base_score)

            # Create project item (all required, proof required)
            project_item = ProjectItem(
                project_id=new_project.project_id,
                item_id=comp_item.item_id,
                is_required=True,
                proof_required_level=ProofRequiredLevel.REQUIRED,
                max_score=score,
                display_order=i + 1
            )
            db.add(project_item)
            await db.flush()
            project_items_created.append({
                "item_code": comp_item.item_code,
                "item_name": comp_item.item_name,
                "max_score": int(score),
                "template": comp_item.template.value if comp_item.template else None
            })

            # Create scoring criteria based on item type
            template = comp_item.template.value if comp_item.template else None

            if comp_item.item_code == 'CERT_COACH' or template == 'text_file':
                # 자격증 등급 (KSC, KPC, KAC 3단계)
                grade_config = json.dumps({
                    "type": "string",
                    "matchMode": "contains",
                    "grades": [
                        {"value": "KSC", "score": int(score)},
                        {"value": "KPC", "score": int(score * Decimal("0.6"))},
                        {"value": "KAC", "score": int(score * Decimal("0.3"))}
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

            elif template == 'degree' or comp_item.item_code in ['EDU_COACHING', 'EDU_GENERAL']:
                # 학위 등급
                grade_config = json.dumps({
                    "type": "string",
                    "grades": [
                        {"value": "박사", "score": int(score)},
                        {"value": "석사", "score": int(score * Decimal("0.7"))},
                        {"value": "학사", "score": int(score * Decimal("0.4"))},
                        {"value": "전문학사", "score": int(score * Decimal("0.2"))}
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

            elif template in ['coaching_time', 'coaching_experience'] or comp_item.item_code in ['EXP_COACHING_HOURS', 'EXP_COACHING_TIME']:
                # 시간 기반 숫자 등급
                grade_config = json.dumps({
                    "type": "numeric",
                    "grades": [
                        {"min": 1500, "score": int(score)},
                        {"min": 1000, "max": 1499, "score": int(score * Decimal("0.8"))},
                        {"min": 500, "max": 999, "score": int(score * Decimal("0.6"))},
                        {"min": 200, "max": 499, "score": int(score * Decimal("0.4"))},
                        {"min": 50, "max": 199, "score": int(score * Decimal("0.2"))},
                        {"max": 49, "score": int(score * Decimal("0.1"))}
                    ]
                })
                criteria = ScoringCriteria(
                    project_item_id=project_item.project_item_id,
                    matching_type=MatchingType.GRADE,
                    expected_value=grade_config,
                    score=Decimal("0"),
                    value_source=ValueSourceType.JSON_FIELD,
                    source_field="hours"
                )
                db.add(criteria)

            elif template == 'coaching_history':
                # 경력 건수 기반
                grade_config = json.dumps({
                    "type": "numeric",
                    "grades": [
                        {"min": 10, "score": int(score)},
                        {"min": 5, "max": 9, "score": int(score * Decimal("0.7"))},
                        {"min": 3, "max": 4, "score": int(score * Decimal("0.4"))},
                        {"min": 1, "max": 2, "score": int(score * Decimal("0.2"))}
                    ]
                })
                criteria = ScoringCriteria(
                    project_item_id=project_item.project_item_id,
                    matching_type=MatchingType.GRADE,
                    expected_value=grade_config,
                    score=Decimal("0"),
                    value_source=ValueSourceType.SUBMITTED,
                    aggregation_mode="count"
                )
                db.add(criteria)

            elif template == 'number':
                # 숫자 범위
                grade_config = json.dumps({
                    "type": "numeric",
                    "grades": [
                        {"min": 100, "score": int(score)},
                        {"min": 50, "max": 99, "score": int(score * Decimal("0.7"))},
                        {"min": 20, "max": 49, "score": int(score * Decimal("0.4"))},
                        {"min": 1, "max": 19, "score": int(score * Decimal("0.2"))}
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

            else:
                # 기본: 입력 여부에 따른 점수 (있으면 만점)
                grade_config = json.dumps({
                    "type": "boolean",
                    "grades": [
                        {"value": "입력됨", "score": int(score)},
                        {"value": "", "score": 0}
                    ]
                })
                criteria = ScoringCriteria(
                    project_item_id=project_item.project_item_id,
                    matching_type=MatchingType.EXACT,
                    expected_value="*",  # 아무 값이나 있으면
                    score=score
                )
                db.add(criteria)

        # 8. Add reviewers (project_staff)
        # SUPER_ADMIN as reviewer
        staff1 = ProjectStaff(
            project_id=new_project.project_id,
            staff_user_id=super_admin.user_id
        )
        db.add(staff1)

        # viproject@naver.com as reviewer
        staff2 = ProjectStaff(
            project_id=new_project.project_id,
            staff_user_id=viproject_user.user_id
        )
        db.add(staff2)

        await db.commit()
        await db.refresh(new_project)

        return {
            "message": "견본과제가 생성되었습니다.",
            "project_id": new_project.project_id,
            "project_name": new_project.project_name,
            "status": new_project.status.value,
            "total_items": len(project_items_created),
            "total_score": 100,
            "items": project_items_created,
            "reviewers": [
                {"email": super_admin.email, "name": super_admin.name},
                {"email": viproject_user.email, "name": viproject_user.name}
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"[CREATE SAMPLE PROJECT] Error: {str(e)}")
        print(f"[CREATE SAMPLE PROJECT] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating sample project: {str(e)}"
        )


# ============================================================================
# Update Degree Options (학력 선택지 업데이트)
# ============================================================================
@router.post("/update-degree-options")
async def update_degree_options(
    secret_key: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    """
    학력 항목의 선택지를 '박사, 박사수료, 석사, 학사'로 업데이트

    Secret key required for authentication.
    """
    from app.models.competency import CompetencyItem, CompetencyItemField
    import json

    if secret_key != "update_degree_2026":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    try:
        new_options = ["박사", "박사수료", "석사", "학사"]
        new_options_json = json.dumps(new_options, ensure_ascii=False)
        new_template_config = json.dumps({"degree_options": new_options}, ensure_ascii=False)

        updated_items = []
        updated_fields = []

        # 학력 항목 업데이트 (EDU_COACHING_FINAL, EDU_OTHER_FINAL)
        result = await db.execute(
            select(CompetencyItem).where(
                CompetencyItem.item_code.in_(["EDU_COACHING_FINAL", "EDU_OTHER_FINAL"])
            )
        )
        items = result.scalars().all()

        for item in items:
            # template_config 업데이트
            item.template_config = new_template_config
            updated_items.append(item.item_code)

            # 해당 항목의 degree_level 필드 업데이트
            fields_result = await db.execute(
                select(CompetencyItemField).where(
                    CompetencyItemField.item_id == item.item_id,
                    CompetencyItemField.field_name == "degree_level"
                )
            )
            field = fields_result.scalar_one_or_none()
            if field:
                field.field_options = new_options_json
                updated_fields.append(f"{item.item_code}.degree_level")

        await db.commit()

        return {
            "message": "학력 선택지가 업데이트되었습니다.",
            "new_options": new_options,
            "updated_items": updated_items,
            "updated_fields": updated_fields
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error updating degree options: {str(e)}"
        )


# ============================================================================
# Seed Input Templates Endpoint
# ============================================================================
@router.post("/seed-input-templates")
async def seed_input_templates(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """Seed default input templates (requires secret key)

    단순화된 구조:
    - 파일 첨부 여부: fields_schema에 file 타입 필드 유무로 자동 판단
    - 파일 필수 여부: file 필드의 required 속성으로 결정
    - 허용 파일 형식: 실행파일만 차단 (백엔드 로직)
    """
    if secret_key != "coachdb2024!":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from app.models.input_template import InputTemplate

    # 입력 템플릿 정의 (12개) - 단순화된 구조
    INPUT_TEMPLATES = [
        {"template_id": "text", "template_name": "텍스트", "description": "단일 텍스트 입력",
         "fields_schema": json.dumps([{"name": "value", "type": "text", "label": "값", "required": True}]),
         "layout_type": "vertical", "is_repeatable": False, "keywords": json.dumps(["텍스트", "문자열", "TEXT"])},
        {"template_id": "number", "template_name": "숫자", "description": "단일 숫자 입력",
         "fields_schema": json.dumps([{"name": "value", "type": "number", "label": "값", "required": True}]),
         "layout_type": "vertical", "is_repeatable": False, "keywords": json.dumps(["숫자", "NUMBER"])},
        {"template_id": "select", "template_name": "단일선택", "description": "옵션 중 하나 선택",
         "fields_schema": json.dumps([{"name": "value", "type": "select", "label": "선택", "required": True, "options": []}]),
         "layout_type": "vertical", "is_repeatable": False, "keywords": json.dumps(["선택", "SELECT"])},
        {"template_id": "multiselect", "template_name": "다중선택", "description": "옵션 중 여러 개 선택",
         "fields_schema": json.dumps([{"name": "values", "type": "multiselect", "label": "선택", "required": True, "options": []}]),
         "layout_type": "vertical", "is_repeatable": False, "keywords": json.dumps(["다중선택", "MULTISELECT"])},
        {"template_id": "file", "template_name": "파일", "description": "파일 업로드",
         "fields_schema": json.dumps([{"name": "file", "type": "file", "label": "파일", "required": True}]),
         "layout_type": "vertical", "is_repeatable": False, "keywords": json.dumps(["파일", "FILE"])},
        {"template_id": "text_file", "template_name": "텍스트+파일", "description": "텍스트 입력과 파일 첨부",
         "fields_schema": json.dumps([{"name": "description", "type": "text", "label": "설명", "required": True},
                                       {"name": "file", "type": "file", "label": "증빙파일", "required": False}]),
         "layout_type": "vertical", "is_repeatable": True, "keywords": json.dumps(["텍스트파일", "TEXT_FILE"])},
        {"template_id": "degree", "template_name": "학위", "description": "학위 정보 입력",
         "fields_schema": json.dumps([{"name": "degree_level", "type": "select", "label": "학위", "required": True, "options": ["학사", "석사", "박사", "박사수료", "기타"]},
                                       {"name": "major", "type": "text", "label": "전공", "required": True},
                                       {"name": "school_name", "type": "text", "label": "학교명", "required": True},
                                       {"name": "graduation_year", "type": "text", "label": "졸업연도", "required": False},
                                       {"name": "file", "type": "file", "label": "증빙서류", "required": False}]),
         "layout_type": "vertical", "is_repeatable": True, "max_entries": "5", "help_text": "최종 학력부터 입력해주세요.",
         "keywords": json.dumps(["학위", "학력", "DEGREE", "EDUCATION"])},
        {"template_id": "coaching_history", "template_name": "코칭이력", "description": "코칭 분야 이력 입력",
         "fields_schema": json.dumps([{"name": "field_name", "type": "text", "label": "코칭 분야", "required": True},
                                       {"name": "period", "type": "text", "label": "기간", "required": False},
                                       {"name": "description", "type": "textarea", "label": "주요 내용", "required": False},
                                       {"name": "file", "type": "file", "label": "증빙자료", "required": False}]),
         "layout_type": "vertical", "is_repeatable": True, "keywords": json.dumps(["코칭이력", "COACHING_HISTORY"])},
        {"template_id": "coaching_time", "template_name": "코칭시간", "description": "코칭 시간 입력",
         "fields_schema": json.dumps([{"name": "content", "type": "text", "label": "내용", "required": True},
                                       {"name": "year", "type": "text", "label": "연도", "required": True},
                                       {"name": "hours", "type": "number", "label": "시간", "required": True},
                                       {"name": "file", "type": "file", "label": "증빙자료", "required": False}]),
         "layout_type": "horizontal", "is_repeatable": True, "help_text": "코칭 시간을 연도별로 입력해주세요.",
         "keywords": json.dumps(["코칭시간", "COACHING_TIME", "시간"])},
        {"template_id": "coaching_experience", "template_name": "코칭경력", "description": "코칭 경력 입력",
         "fields_schema": json.dumps([{"name": "organization", "type": "text", "label": "기관명", "required": True},
                                       {"name": "year", "type": "text", "label": "연도", "required": True},
                                       {"name": "hours", "type": "number", "label": "시간", "required": False},
                                       {"name": "description", "type": "textarea", "label": "내용", "required": False},
                                       {"name": "file", "type": "file", "label": "증빙자료", "required": False}]),
         "layout_type": "vertical", "is_repeatable": True, "help_text": "코칭 경력을 기관별로 입력해주세요.",
         "keywords": json.dumps(["코칭경력", "COACHING_EXPERIENCE", "경력"])},
        {"template_id": "kca_certification", "template_name": "KCA자격증", "description": "코칭 관련 자격증 입력",
         "fields_schema": json.dumps([{"name": "cert_level", "type": "select", "label": "자격증", "required": True, "options": ["KSC", "KAC", "KPC", "ACC", "PCC", "MCC", "기타"]},
                                       {"name": "cert_number", "type": "text", "label": "자격증번호", "required": False},
                                       {"name": "issue_date", "type": "text", "label": "취득일", "required": False},
                                       {"name": "file", "type": "file", "label": "자격증 사본", "required": True}]),
         "layout_type": "vertical", "is_repeatable": True, "max_entries": "10", "help_text": "취득한 코칭 자격증을 모두 입력해주세요.",
         "keywords": json.dumps(["자격증", "KCA", "KSC", "KAC", "KPC", "CERTIFICATION"])},
        {"template_id": "other_certification", "template_name": "기타자격증", "description": "기타 자격증 입력",
         "fields_schema": json.dumps([{"name": "cert_name", "type": "text", "label": "자격증명", "required": True},
                                       {"name": "issuer", "type": "text", "label": "발급기관", "required": False},
                                       {"name": "cert_number", "type": "text", "label": "자격증번호", "required": False},
                                       {"name": "issue_date", "type": "text", "label": "취득일", "required": False},
                                       {"name": "file", "type": "file", "label": "자격증 사본", "required": False}]),
         "layout_type": "vertical", "is_repeatable": True, "keywords": json.dumps(["기타자격증", "OTHER_CERTIFICATION"])},
    ]

    created_count = 0
    skipped_count = 0

    try:
        for template_data in INPUT_TEMPLATES:
            template_id = template_data["template_id"]

            # Check if already exists
            result = await db.execute(
                select(InputTemplate).where(InputTemplate.template_id == template_id)
            )
            existing = result.scalar_one_or_none()
            if existing:
                skipped_count += 1
                continue

            # Create new template (without file-related columns)
            template = InputTemplate(
                template_id=template_data["template_id"],
                template_name=template_data["template_name"],
                description=template_data.get("description"),
                fields_schema=template_data.get("fields_schema", "[]"),
                layout_type=template_data.get("layout_type", "vertical"),
                is_repeatable=template_data.get("is_repeatable", False),
                max_entries=template_data.get("max_entries"),
                help_text=template_data.get("help_text"),
                keywords=template_data.get("keywords"),
                is_active=True
            )
            db.add(template)
            created_count += 1

        await db.commit()

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error seeding input templates: {str(e)}"
        )

    return {
        "message": "Input templates seed completed",
        "created": created_count,
        "skipped": skipped_count
    }


@router.post("/link-scoring-templates")
async def link_scoring_templates(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """역량항목에 기본 평가템플릿을 연결합니다 (requires secret key)

    어드민이 미리 설정한 역량항목에 적합한 평가템플릿을 자동 연결하여,
    과제관리자가 위저드에서 항목 선택 시 기본 설정이 자동 로드되도록 합니다.
    """
    if secret_key != "coachdb-seed-2024":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    # 역량항목 코드 -> 평가템플릿 ID 매핑
    ITEM_TEMPLATE_MAPPING = {
        # 자격증
        "CERT_KCA": "kca_certification",
        "CERT_COUNSELING": "counseling_by_name",
        "CERT_OTHER": "other_by_name",

        # 학력
        "EDU_COACHING_FINAL": "degree",
        "EDU_OTHER_FINAL": "degree",
        "EDU_COACHING": "degree",
        "EDU_GENERAL": "degree",

        # 경력
        "EXP_COACHING_HOURS": "coaching_hours",
        "EXP_COACHING_TIME": "coaching_hours",
        "EXP_COACHING_TRAINING": "coaching_training",
        "EXP_COACHING_EXPERIENCE": "coaching_training",
        "EXP_HOURS": "coaching_hours",
    }

    updated_count = 0
    not_found_items = []
    not_found_templates = []

    try:
        # 모든 역량항목 조회
        result = await db.execute(select(CompetencyItem))
        items = result.scalars().all()

        # 존재하는 템플릿 ID 목록 조회
        from app.models.scoring_template import ScoringTemplate
        template_result = await db.execute(select(ScoringTemplate.template_id))
        existing_templates = {row[0] for row in template_result.fetchall()}

        for item in items:
            template_id = ITEM_TEMPLATE_MAPPING.get(item.item_code)

            if template_id:
                if template_id not in existing_templates:
                    not_found_templates.append(f"{item.item_code} -> {template_id}")
                    continue

                # 이미 설정되어 있으면 건너뜀
                if item.scoring_template_id == template_id:
                    continue

                item.scoring_template_id = template_id
                updated_count += 1
            else:
                if item.item_code not in [
                    # 평가 항목이 아닌 기본 정보 항목은 제외
                    "INFO_NAME", "INFO_EMAIL", "INFO_PHONE", "INFO_ADDRESS",
                    "SPEC_AREA", "SPEC_STRENGTH", "EXP_FIELD", "EXP_ACHIEVEMENT"
                ]:
                    not_found_items.append(item.item_code)

        await db.commit()

        return {
            "message": "Scoring template linking completed",
            "updated": updated_count,
            "not_found_items": not_found_items,
            "not_found_templates": not_found_templates
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error linking scoring templates: {str(e)}"
        )


@router.post("/seed-scoring-templates")
async def seed_scoring_templates(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """평가 템플릿 초기 데이터를 삽입합니다 (requires secret key)

    gradeTemplates.ts의 상수를 DB로 이관합니다.
    """
    if secret_key != "coachdb-seed-2024":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from app.models.scoring_template import ScoringTemplate

    # 평가 템플릿 데이터
    SCORING_TEMPLATES_DATA = [
        {
            "template_id": "degree",
            "template_name": "학위",
            "description": "학위별로 점수를 부여합니다",
            "grade_type": "string",
            "matching_type": "grade",
            "value_source": "submitted",
            "aggregation_mode": "best_match",
            "default_mappings": json.dumps([
                {"value": "박사", "score": 30, "label": "박사"},
                {"value": "박사수료", "score": 25, "label": "박사수료"},
                {"value": "석사", "score": 20, "label": "석사"},
                {"value": "학사", "score": 10, "label": "학사"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "required",
            "keywords": json.dumps(["학위", "학력", "degree"]),
        },
        {
            "template_id": "kca_certification",
            "template_name": "코칭관련자격증 (KCA)",
            "description": "기본정보의 코치인증번호를 자동 조회합니다",
            "grade_type": "string",
            "matching_type": "grade",
            "value_source": "user_field",
            "source_field": "kca_certification_level",
            "aggregation_mode": "best_match",
            "default_mappings": json.dumps([
                {"value": "KSC", "score": 40, "label": "KSC (수석코치)", "fixed": True},
                {"value": "KAC", "score": 30, "label": "KAC (전문코치)", "fixed": True},
                {"value": "KPC", "score": 20, "label": "KPC (전문코치)", "fixed": True},
                {"value": "무자격", "score": 0, "label": "무자격", "fixed": True}
            ]),
            "fixed_grades": True,
            "allow_add_grades": False,
            "proof_required": "optional",
            "keywords": json.dumps(["kca"]),
        },
        {
            "template_id": "coaching_hours",
            "template_name": "코칭 경력 시간",
            "description": "시간 범위별로 점수를 부여합니다",
            "grade_type": "numeric",
            "matching_type": "range",
            "value_source": "submitted",
            "aggregation_mode": "sum",
            "default_mappings": json.dumps([
                {"value": 1000, "score": 30, "label": "1000시간 이상"},
                {"value": 500, "score": 20, "label": "500-999시간"},
                {"value": 100, "score": 10, "label": "100-499시간"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "optional",
            "keywords": json.dumps(["경력", "시간", "hour"]),
        },
        {
            "template_id": "counseling_by_name",
            "template_name": "상담/심리치료관련자격 (이름 기준)",
            "description": "자격증 이름으로 등급을 설정합니다",
            "grade_type": "string",
            "matching_type": "contains",
            "value_source": "submitted",
            "aggregation_mode": "best_match",
            "default_mappings": json.dumps([
                {"value": "임상심리사", "score": 30, "label": "임상심리사 포함"},
                {"value": "상담심리사", "score": 20, "label": "상담심리사 포함"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "required",
            "keywords": json.dumps(["상담", "심리", "치료"]),
        },
        {
            "template_id": "other_by_name",
            "template_name": "기타 자격증 (이름 기준)",
            "description": "자격증 이름으로 등급을 설정합니다",
            "grade_type": "string",
            "matching_type": "contains",
            "value_source": "submitted",
            "aggregation_mode": "best_match",
            "default_mappings": json.dumps([
                {"value": "", "score": 20, "label": "특정 자격증명 입력"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "required",
            "keywords": json.dumps([]),
        },
        {
            "template_id": "coaching_training",
            "template_name": "코칭연수/경험",
            "description": "시간 합산 후 범위별 점수를 부여합니다",
            "grade_type": "numeric",
            "matching_type": "range",
            "value_source": "submitted",
            "aggregation_mode": "sum",
            "default_mappings": json.dumps([
                {"value": 1000, "score": 40, "label": "1000시간 이상"},
                {"value": 500, "score": 30, "label": "500시간 이상"},
                {"value": 100, "score": 20, "label": "100시간 이상"},
                {"value": 0, "score": 10, "label": "100시간 미만"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "required",
            "keywords": json.dumps(["연수", "경험", "training"]),
        },
    ]

    created_count = 0
    updated_count = 0

    try:
        for template_data in SCORING_TEMPLATES_DATA:
            # 기존 템플릿 확인
            result = await db.execute(
                select(ScoringTemplate).where(
                    ScoringTemplate.template_id == template_data["template_id"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                # 업데이트
                for key, value in template_data.items():
                    setattr(existing, key, value)
                updated_count += 1
            else:
                # 생성
                template = ScoringTemplate(
                    template_id=template_data["template_id"],
                    template_name=template_data["template_name"],
                    description=template_data.get("description"),
                    grade_type=template_data["grade_type"],
                    matching_type=template_data["matching_type"],
                    value_source=template_data.get("value_source", "SUBMITTED"),
                    source_field=template_data.get("source_field"),
                    aggregation_mode=template_data.get("aggregation_mode", "first"),
                    default_mappings=template_data["default_mappings"],
                    fixed_grades=template_data.get("fixed_grades", False),
                    allow_add_grades=template_data.get("allow_add_grades", True),
                    proof_required=template_data.get("proof_required", "OPTIONAL"),
                    keywords=template_data.get("keywords"),
                    is_active=True
                )
                db.add(template)
                created_count += 1

        await db.commit()

        return {
            "message": "Scoring templates seed completed",
            "created": created_count,
            "updated": updated_count
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error seeding scoring templates: {str(e)}"
        )


# ============================================================================
# Seed Unified Templates Endpoint
# ============================================================================
@router.post("/seed-unified-templates")
async def seed_unified_templates(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """통합 템플릿 초기 데이터를 삽입합니다 (requires secret key)

    입력 템플릿 + 평가 템플릿을 통합한 데이터입니다.
    """
    if secret_key != "coachdb-seed-2024":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from app.models.unified_template import UnifiedTemplate

    # 통합 템플릿 데이터 (13개)
    UNIFIED_TEMPLATES_DATA = [
        # 1. 기본 입력 템플릿 (평가 없음)
        {
            "template_id": "text",
            "template_name": "텍스트",
            "description": "단일 텍스트 입력",
            "data_source": "form_input",
            "fields_schema": json.dumps([{"name": "value", "type": "text", "label": "값", "required": True}]),
            "layout_type": "vertical",
            "is_repeatable": False,
            "keywords": json.dumps(["텍스트", "문자열"]),
        },
        {
            "template_id": "number",
            "template_name": "숫자",
            "description": "단일 숫자 입력",
            "data_source": "form_input",
            "fields_schema": json.dumps([{"name": "value", "type": "number", "label": "값", "required": True}]),
            "layout_type": "vertical",
            "is_repeatable": False,
            "keywords": json.dumps(["숫자"]),
        },
        {
            "template_id": "select",
            "template_name": "단일선택",
            "description": "옵션 중 하나 선택",
            "data_source": "form_input",
            "fields_schema": json.dumps([{"name": "value", "type": "select", "label": "선택", "required": True, "options": []}]),
            "layout_type": "vertical",
            "is_repeatable": False,
            "keywords": json.dumps(["선택"]),
        },
        {
            "template_id": "file",
            "template_name": "파일",
            "description": "파일 업로드",
            "data_source": "form_input",
            "fields_schema": json.dumps([{"name": "file", "type": "file", "label": "파일", "required": True}]),
            "layout_type": "vertical",
            "is_repeatable": False,
            "keywords": json.dumps(["파일"]),
        },

        # 2. 학위 (입력 + 평가)
        {
            "template_id": "degree",
            "template_name": "학위",
            "description": "학위 정보 입력 및 평가",
            "data_source": "form_input",
            "fields_schema": json.dumps([
                {"name": "degree_level", "type": "select", "label": "학위", "required": True, "options": ["학사", "석사", "박사수료", "박사", "기타"]},
                {"name": "major", "type": "text", "label": "전공", "required": True},
                {"name": "school_name", "type": "text", "label": "학교명", "required": True},
                {"name": "graduation_year", "type": "text", "label": "졸업연도", "required": False},
                {"name": "file", "type": "file", "label": "증빙서류", "required": False}
            ]),
            "layout_type": "vertical",
            "is_repeatable": True,
            "max_entries": "5",
            "help_text": "최종 학력부터 입력해주세요.",
            # 평가 설정
            "evaluation_method": "standard",
            "grade_type": "string",
            "matching_type": "grade",
            "scoring_value_source": "submitted",
            "aggregation_mode": "best_match",
            "default_mappings": json.dumps([
                {"value": "박사", "score": 30, "label": "박사"},
                {"value": "박사수료", "score": 25, "label": "박사수료"},
                {"value": "석사", "score": 20, "label": "석사"},
                {"value": "학사", "score": 10, "label": "학사"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "required",
            "keywords": json.dumps(["학위", "학력", "DEGREE"]),
        },

        # 3. 코칭이력 (정성 평가, 점수 없음)
        {
            "template_id": "coaching_history",
            "template_name": "코칭이력",
            "description": "코칭 분야 이력 입력 (정성 평가)",
            "data_source": "form_input",
            "fields_schema": json.dumps([
                {"name": "field_name", "type": "text", "label": "코칭 분야", "required": True},
                {"name": "period", "type": "text", "label": "기간", "required": False},
                {"name": "description", "type": "textarea", "label": "주요 내용", "required": False},
                {"name": "file", "type": "file", "label": "증빙자료", "required": False}
            ]),
            "layout_type": "vertical",
            "is_repeatable": True,
            "keywords": json.dumps(["코칭이력"]),
        },

        # 4. 코칭시간 (입력 + 평가)
        {
            "template_id": "coaching_time",
            "template_name": "코칭시간",
            "description": "코칭 시간 입력 및 범위별 평가",
            "data_source": "form_input",
            "fields_schema": json.dumps([
                {"name": "content", "type": "text", "label": "내용", "required": True},
                {"name": "year", "type": "text", "label": "연도", "required": True},
                {"name": "hours", "type": "number", "label": "시간", "required": True},
                {"name": "file", "type": "file", "label": "증빙자료", "required": False}
            ]),
            "layout_type": "horizontal",
            "is_repeatable": True,
            "help_text": "코칭 시간을 연도별로 입력해주세요.",
            # 평가 설정
            "evaluation_method": "standard",
            "grade_type": "numeric",
            "matching_type": "range",
            "scoring_value_source": "submitted",
            "aggregation_mode": "sum",
            "default_mappings": json.dumps([
                {"value": 1000, "score": 30, "label": "1000시간 이상"},
                {"value": 500, "score": 20, "label": "500-999시간"},
                {"value": 100, "score": 10, "label": "100-499시간"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "optional",
            "keywords": json.dumps(["코칭시간", "시간"]),
        },

        # 5. 코칭경력 (입력 + 평가)
        {
            "template_id": "coaching_experience",
            "template_name": "코칭경력",
            "description": "코칭 경력 입력 및 평가",
            "data_source": "form_input",
            "fields_schema": json.dumps([
                {"name": "organization", "type": "text", "label": "기관명", "required": True},
                {"name": "year", "type": "text", "label": "연도", "required": True},
                {"name": "hours", "type": "number", "label": "시간", "required": False},
                {"name": "description", "type": "textarea", "label": "내용", "required": False},
                {"name": "file", "type": "file", "label": "증빙자료", "required": False}
            ]),
            "layout_type": "vertical",
            "is_repeatable": True,
            "help_text": "코칭 경력을 기관별로 입력해주세요.",
            # 평가 설정
            "evaluation_method": "standard",
            "grade_type": "numeric",
            "matching_type": "range",
            "scoring_value_source": "submitted",
            "aggregation_mode": "sum",
            "default_mappings": json.dumps([
                {"value": 1000, "score": 40, "label": "1000시간 이상"},
                {"value": 500, "score": 30, "label": "500시간 이상"},
                {"value": 100, "score": 20, "label": "100시간 이상"},
                {"value": 0, "score": 10, "label": "100시간 미만"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "required",
            "keywords": json.dumps(["코칭경력", "경력"]),
        },

        # 6. KCA 자격증 (고정 등급)
        {
            "template_id": "kca_certification",
            "template_name": "KCA자격증",
            "description": "KCA 코칭 자격증 (등급 고정)",
            "data_source": "form_input",
            "fields_schema": json.dumps([
                {"name": "cert_level", "type": "select", "label": "자격증", "required": True, "options": ["KSC", "KAC", "KPC", "ACC", "PCC", "MCC", "기타"]},
                {"name": "cert_number", "type": "text", "label": "자격증번호", "required": False},
                {"name": "issue_date", "type": "text", "label": "취득일", "required": False},
                {"name": "file", "type": "file", "label": "자격증 사본", "required": True}
            ]),
            "layout_type": "vertical",
            "is_repeatable": True,
            "max_entries": "10",
            "help_text": "취득한 코칭 자격증을 모두 입력해주세요.",
            # 평가 설정
            "evaluation_method": "standard",
            "grade_type": "string",
            "matching_type": "grade",
            "scoring_value_source": "user_field",
            "scoring_source_field": "kca_certification_level",
            "aggregation_mode": "best_match",
            "default_mappings": json.dumps([
                {"value": "KSC", "score": 40, "label": "KSC (수석코치)", "fixed": True},
                {"value": "KAC", "score": 30, "label": "KAC (전문코치)", "fixed": True},
                {"value": "KPC", "score": 20, "label": "KPC (전문코치)", "fixed": True},
                {"value": "무자격", "score": 0, "label": "무자격", "fixed": True}
            ]),
            "fixed_grades": True,
            "allow_add_grades": False,
            "proof_required": "optional",
            "keywords": json.dumps(["KCA", "KSC", "KAC", "KPC"]),
        },

        # 7. 일반 자격증 (평가 방법 선택 가능: by_name / by_existence)
        {
            "template_id": "certification",
            "template_name": "자격증",
            "description": "일반 자격증 입력 (이름 또는 유무로 평가 선택 가능)",
            "data_source": "form_input",
            "fields_schema": json.dumps([
                {"name": "cert_name", "type": "text", "label": "자격증명", "required": True},
                {"name": "issuer", "type": "text", "label": "발급기관", "required": False},
                {"name": "cert_number", "type": "text", "label": "자격증번호", "required": False},
                {"name": "issue_date", "type": "text", "label": "취득일", "required": False},
                {"name": "file", "type": "file", "label": "자격증 사본", "required": False}
            ]),
            "layout_type": "vertical",
            "is_repeatable": True,
            # 평가 설정 (기본: 이름으로 평가)
            "evaluation_method": "by_name",  # 역량항목에서 by_existence로 오버라이드 가능
            "grade_type": "string",
            "matching_type": "contains",
            "scoring_value_source": "submitted",
            "aggregation_mode": "best_match",
            "default_mappings": json.dumps([
                {"value": "임상심리사", "score": 30, "label": "임상심리사 포함"},
                {"value": "상담심리사", "score": 20, "label": "상담심리사 포함"}
            ]),
            "fixed_grades": False,
            "allow_add_grades": True,
            "proof_required": "required",
            "keywords": json.dumps(["자격증", "상담", "심리", "기타"]),
        },

        # 8. 텍스트+파일 (범용)
        {
            "template_id": "text_file",
            "template_name": "텍스트+파일",
            "description": "텍스트 설명과 증빙 파일",
            "data_source": "form_input",
            "fields_schema": json.dumps([
                {"name": "description", "type": "text", "label": "설명", "required": True},
                {"name": "file", "type": "file", "label": "증빙파일", "required": False}
            ]),
            "layout_type": "vertical",
            "is_repeatable": True,
            "keywords": json.dumps(["텍스트파일"]),
        },
    ]

    created_count = 0
    updated_count = 0

    try:
        for template_data in UNIFIED_TEMPLATES_DATA:
            # 기존 템플릿 확인
            result = await db.execute(
                select(UnifiedTemplate).where(
                    UnifiedTemplate.template_id == template_data["template_id"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                # 업데이트
                for key, value in template_data.items():
                    setattr(existing, key, value)
                updated_count += 1
            else:
                # 생성
                template = UnifiedTemplate(**template_data, is_active=True)
                db.add(template)
                created_count += 1

        await db.commit()

        return {
            "message": "Unified templates seed completed",
            "created": created_count,
            "updated": updated_count
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error seeding unified templates: {str(e)}"
        )


@router.post("/link-unified-templates")
async def link_unified_templates(
    secret_key: str,
    db: AsyncSession = Depends(get_db)
):
    """역량항목에 통합 템플릿을 연결합니다 (requires secret key)

    역량항목의 unified_template_id를 설정합니다.
    자격증 항목의 경우 evaluation_method_override도 설정합니다.
    """
    if secret_key != "coachdb-seed-2024":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    from app.models.unified_template import UnifiedTemplate

    # 역량항목 코드 -> (통합템플릿 ID, 평가방법 오버라이드)
    ITEM_TEMPLATE_MAPPING = {
        # 자격증
        "CERT_KCA": ("kca_certification", None),
        "CERT_COUNSELING": ("certification", "by_name"),
        "CERT_OTHER": ("certification", "by_existence"),

        # 학력
        "EDU_COACHING_FINAL": ("degree", None),
        "EDU_OTHER_FINAL": ("degree", None),
        "EDU_COACHING": ("degree", None),
        "EDU_GENERAL": ("degree", None),

        # 경력
        "EXP_COACHING_HOURS": ("coaching_time", None),
        "EXP_COACHING_TIME": ("coaching_time", None),
        "EXP_COACHING_TRAINING": ("coaching_experience", None),
        "EXP_COACHING_EXPERIENCE": ("coaching_experience", None),
        "EXP_HOURS": ("coaching_time", None),

        # 코칭 이력 (정성 평가)
        "COACHING_BUSINESS": ("coaching_history", None),
        "COACHING_CAREER": ("coaching_history", None),
        "COACHING_YOUTH": ("coaching_history", None),
        "COACHING_YOUNG_ADULT": ("coaching_history", None),
        "COACHING_FAMILY": ("coaching_history", None),
        "COACHING_LIFE": ("coaching_history", None),
    }

    updated_count = 0
    not_found_items = []
    not_found_templates = []

    try:
        # 모든 역량항목 조회
        result = await db.execute(select(CompetencyItem))
        items = result.scalars().all()

        # 존재하는 템플릿 ID 목록 조회
        template_result = await db.execute(select(UnifiedTemplate.template_id))
        existing_templates = {row[0] for row in template_result.fetchall()}

        for item in items:
            mapping = ITEM_TEMPLATE_MAPPING.get(item.item_code)

            if mapping:
                template_id, eval_method = mapping

                if template_id not in existing_templates:
                    not_found_templates.append(f"{item.item_code} -> {template_id}")
                    continue

                # 이미 설정되어 있으면 건너뜀
                if item.unified_template_id == template_id:
                    continue

                item.unified_template_id = template_id
                item.evaluation_method_override = eval_method
                updated_count += 1
            else:
                # 기본 정보 항목 제외
                if item.item_code not in [
                    "INFO_NAME", "INFO_EMAIL", "INFO_PHONE", "INFO_ADDRESS",
                    "SPEC_AREA", "SPEC_STRENGTH", "EXP_FIELD", "EXP_ACHIEVEMENT",
                    "SPECIALTY", "EXP_MENTORING"
                ]:
                    not_found_items.append(item.item_code)

        await db.commit()

        return {
            "message": "Unified template linking completed",
            "updated": updated_count,
            "not_found_items": not_found_items,
            "not_found_templates": not_found_templates
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error linking unified templates: {str(e)}"
        )

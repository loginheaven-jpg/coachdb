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
    RoleRequestResponse,
    RoleRequestReject
)

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
        # FK 순서대로 삭제 (모든 FK 제약조건 처리):
        # 1. application_data (linked_competency_id → coach_competencies, item_id → competency_items)
        await db.execute(text("UPDATE application_data SET linked_competency_id = NULL"))
        await db.execute(text("DELETE FROM application_data"))
        # 2. verification_records (competency_id → coach_competencies)
        await db.execute(text("DELETE FROM verification_records"))
        # 3. notifications (related_competency_id → coach_competencies)
        await db.execute(text("UPDATE notifications SET related_competency_id = NULL"))
        # 4. review_locks (item_id → competency_items)
        await db.execute(text("DELETE FROM review_locks"))
        # 5. project_items (item_id → competency_items)
        await db.execute(text("DELETE FROM project_items"))
        # 6. coach_competencies (item_id → competency_items)
        await db.execute(text("DELETE FROM coach_competencies"))
        # 7. competency_item_fields (item_id → competency_items)
        await db.execute(text("DELETE FROM competency_item_fields"))
        # 8. competency_items
        await db.execute(text("DELETE FROM competency_items"))
        await db.commit()
        return {"message": "All competency items and related data cleared"}
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
    except Exception as e:
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
        }
        # 기타 그룹 (OTHER): 기본 항목 없음 - 커스텀 항목만 추가 가능
        # 자기소개: users.introduction으로 이동
        # 전문분야: 삭제
    ]

    created_count = 0
    skipped_count = 0

    try:
        for item_data in items_data:
            # Check if already exists
            result = await db.execute(
                select(CompetencyItem).where(CompetencyItem.item_code == item_data["item_code"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                skipped_count += 1
                continue

            fields_data = item_data.pop("fields", [])

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
                is_custom=False
            )
            db.add(item)
            await db.flush()

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

        await db.commit()
    except Exception as e:
        import traceback
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

            # 7. Files 삭제 (사용자가 업로드한 모든 파일)
            await db.execute(text("""
                DELETE FROM files WHERE uploaded_by = :user_id
            """), {"user_id": user_id})

            # 8. Coach Competencies 삭제
            await db.execute(text("""
                DELETE FROM coach_competencies WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 9. Coach Education History 삭제
            await db.execute(text("""
                DELETE FROM coach_education_history WHERE user_id = :user_id
            """), {"user_id": user_id})

            # 10. Certifications 삭제
            await db.execute(text("""
                DELETE FROM certifications WHERE user_id = :user_id
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
                DELETE FROM project_staff WHERE user_id = :user_id
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

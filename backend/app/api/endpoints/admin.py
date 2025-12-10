from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime
import json

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
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
        try:
            user_roles = json.loads(user.roles) if user.roles else []
        except:
            user_roles = []

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

    try:
        user_roles = json.loads(user.roles) if user.roles else []
    except:
        user_roles = []

    return UserDetailResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        roles=user_roles,
        status=user.status.value,
        created_at=user.created_at,
        birth_year=user.birth_year,
        gender=user.gender.value if user.gender else None,
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
        gender=user.gender.value if user.gender else None,
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
    try:
        current_roles = json.loads(user.roles) if user.roles else []
    except:
        current_roles = []

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
# Seed Competency Items Endpoint
# ============================================================================
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

    items_data = [
        # 학력
        {
            "item_name": "코칭/상담/심리 관련 최종학력",
            "item_code": "EDU_COACHING_FINAL",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.DEGREE,
            "template_config": json.dumps({"degree_options": ["박사", "석사", "학사", "없음"]}),
            "is_repeatable": False,
            "fields": [
                {"field_name": "degree_level", "field_label": "학위", "field_type": "select",
                 "field_options": json.dumps(["박사", "석사", "학사", "없음"]), "is_required": True, "display_order": 1},
                {"field_name": "major", "field_label": "전공명", "field_type": "text", "is_required": True, "display_order": 2},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": True, "display_order": 3}
            ]
        },
        {
            "item_name": "기타분야 관련 최종학력",
            "item_code": "EDU_OTHER_FINAL",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.DEGREE,
            "template_config": json.dumps({"degree_options": ["박사", "석사", "학사", "없음"]}),
            "is_repeatable": False,
            "fields": [
                {"field_name": "degree_level", "field_label": "학위", "field_type": "select",
                 "field_options": json.dumps(["박사", "석사", "학사", "없음"]), "is_required": True, "display_order": 1},
                {"field_name": "major", "field_label": "전공명", "field_type": "text", "is_required": True, "display_order": 2},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": True, "display_order": 3}
            ]
        },
        # 자격증
        {
            "item_name": "KCA 코칭관련 자격증",
            "item_code": "CERT_KCA",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증 명칭", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "cert_file", "field_label": "자격증 업로드", "field_type": "file", "is_required": True, "display_order": 2}
            ]
        },
        {
            "item_name": "상담,심리치료관련 자격",
            "item_code": "CERT_COUNSELING",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "fields": [
                {"field_name": "cert_name", "field_label": "자격증 명칭", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "cert_file", "field_label": "자격증 업로드", "field_type": "file", "is_required": True, "display_order": 2}
            ]
        },
        {
            "item_name": "멘토링/수퍼비전 경험",
            "item_code": "EXP_MENTORING",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.TEXT_FILE,
            "is_repeatable": True,
            "fields": [
                {"field_name": "experience", "field_label": "경험 내용", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": True, "display_order": 2}
            ]
        },
        # 경력
        {
            "item_name": "총 코칭 경력",
            "item_code": "EXP_COACHING_YEARS",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.NUMBER,
            "is_repeatable": False,
            "fields": [
                {"field_name": "years", "field_label": "경력 (년)", "field_type": "number", "is_required": True, "display_order": 1}
            ]
        },
        {
            "item_name": "누적 코칭 시간",
            "item_code": "EXP_COACHING_HOURS",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.NUMBER,
            "is_repeatable": False,
            "fields": [
                {"field_name": "hours", "field_label": "시간", "field_type": "number", "is_required": True, "display_order": 1}
            ]
        },
        # 코칭 분야별 이력
        {
            "item_name": "비즈니스코칭 이력",
            "item_code": "COACHING_BUSINESS",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.COACHING_HISTORY,
            "is_repeatable": False,
            "fields": [
                {"field_name": "history", "field_label": "이력", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 2}
            ]
        },
        {
            "item_name": "커리어코칭 이력",
            "item_code": "COACHING_CAREER",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.COACHING_HISTORY,
            "is_repeatable": False,
            "fields": [
                {"field_name": "history", "field_label": "이력", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 2}
            ]
        },
        {
            "item_name": "청소년코칭 이력",
            "item_code": "COACHING_YOUTH",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.COACHING_HISTORY,
            "is_repeatable": False,
            "fields": [
                {"field_name": "history", "field_label": "이력", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 2}
            ]
        },
        {
            "item_name": "청년코칭 이력",
            "item_code": "COACHING_YOUNG_ADULT",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.COACHING_HISTORY,
            "is_repeatable": False,
            "fields": [
                {"field_name": "history", "field_label": "이력", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 2}
            ]
        },
        {
            "item_name": "가족코칭 이력",
            "item_code": "COACHING_FAMILY",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.COACHING_HISTORY,
            "is_repeatable": False,
            "fields": [
                {"field_name": "history", "field_label": "이력", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 2}
            ]
        },
        {
            "item_name": "라이프코칭 이력",
            "item_code": "COACHING_LIFE",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.COACHING_HISTORY,
            "is_repeatable": False,
            "fields": [
                {"field_name": "history", "field_label": "이력", "field_type": "text", "is_required": True, "display_order": 1},
                {"field_name": "proof", "field_label": "증빙 업로드", "field_type": "file", "is_required": False, "display_order": 2}
            ]
        },
        # 기타
        {
            "item_name": "전문 분야",
            "item_code": "SPECIALTY",
            "category": CompetencyCategory.ADDON,
            "template": ItemTemplate.TEXT,
            "is_repeatable": False,
            "fields": [
                {"field_name": "value", "field_label": "전문 분야", "field_type": "text", "is_required": True, "display_order": 1}
            ]
        }
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

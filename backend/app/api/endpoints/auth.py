from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    decode_token
)
from app.models.user import User, UserStatus, UserRole
from app.models.role_request import RoleRequest, RoleRequestStatus
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenRefresh,
    PasswordChangeRequest,
    UserUpdate,
    UserResponse,
    UserWithToken,
    Token
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=UserWithToken, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user.
    - COACH role is granted immediately
    - Other roles (VERIFIER, REVIEWER, PROJECT_MANAGER, SUPER_ADMIN) require admin approval
    """
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)

    # Separate roles that require approval from those that don't
    # COACH is always granted immediately
    roles_requiring_approval = {
        UserRole.VERIFIER.value, UserRole.REVIEWER.value,
        UserRole.PROJECT_MANAGER.value, UserRole.SUPER_ADMIN.value
    }

    requested_roles = user_data.roles or [UserRole.COACH.value]
    immediate_roles = []
    pending_roles = []

    for role in requested_roles:
        role_upper = role.upper()
        if role_upper in roles_requiring_approval:
            pending_roles.append(role_upper)
        else:
            # COACH or any unrecognized role gets added immediately
            immediate_roles.append(role_upper if role_upper == UserRole.COACH.value else role)

    # Ensure at least COACH role is assigned
    if UserRole.COACH.value not in immediate_roles:
        immediate_roles.append(UserRole.COACH.value)

    roles_json = json.dumps(immediate_roles)

    # Convert coaching_fields list to JSON string
    coaching_fields_json = None
    if user_data.coaching_fields:
        coaching_fields_json = json.dumps(user_data.coaching_fields)

    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        name=user_data.name,
        phone=user_data.phone,
        birth_year=user_data.birth_year,
        gender=user_data.gender,
        address=user_data.address,
        in_person_coaching_area=user_data.in_person_coaching_area,
        roles=roles_json,
        status=UserStatus.ACTIVE,
        coach_certification_number=user_data.coach_certification_number,
        coaching_fields=coaching_fields_json
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create role requests for pending roles
    for role in pending_roles:
        role_request = RoleRequest(
            user_id=new_user.user_id,
            requested_role=role,
            status=RoleRequestStatus.PENDING.value
        )
        db.add(role_request)

    if pending_roles:
        await db.commit()

    # Generate tokens - use actual assigned roles
    user_roles = json.loads(new_user.roles)
    token_data = {"sub": str(new_user.user_id), "roles": user_roles}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Check if profile is complete (name is required)
    profile_complete = bool(new_user.name and new_user.name.strip())

    response = UserWithToken(
        user=UserResponse.from_orm(new_user),
        access_token=access_token,
        refresh_token=refresh_token,
        profile_complete=profile_complete
    )

    # Add pending_roles info to response if any
    if pending_roles:
        response.pending_roles = pending_roles

    return response


@router.post("/login", response_model=UserWithToken)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT tokens"""
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()

    # Verify user exists and password is correct
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check user status
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )

    # Generate tokens
    user_roles = json.loads(user.roles)
    token_data = {"sub": str(user.user_id), "roles": user_roles}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Check if profile is complete (name is required)
    profile_complete = bool(user.name and user.name.strip())

    return UserWithToken(
        user=UserResponse.from_orm(user),
        access_token=access_token,
        refresh_token=refresh_token,
        profile_complete=profile_complete
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token"""
    try:
        payload = decode_token(token_data.refresh_token)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )

        user_id_str = payload.get("sub")

        # Convert user_id from string to int
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format"
            )

        # Verify user still exists and is active
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user or user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        # Generate new tokens
        user_roles = json.loads(user.roles)
        new_token_data = {"sub": str(user.user_id), "roles": user_roles}
        access_token = create_access_token(new_token_data)
        new_refresh_token = create_refresh_token(new_token_data)

        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token
        )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return UserResponse.from_orm(current_user)


@router.put("/change-password")
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Change user password.
    Simple version: no current password verification required.
    """
    # Hash the new password
    new_hashed_password = get_password_hash(password_data.new_password)

    # Update user's password
    current_user.hashed_password = new_hashed_password

    await db.commit()
    await db.refresh(current_user)

    return {"message": "Password changed successfully"}


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user's profile information.
    """
    # Update fields if provided
    if profile_data.name is not None:
        current_user.name = profile_data.name
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone
    if profile_data.birth_year is not None:
        current_user.birth_year = profile_data.birth_year
    if profile_data.gender is not None:
        current_user.gender = profile_data.gender
    if profile_data.address is not None:
        current_user.address = profile_data.address
    if profile_data.in_person_coaching_area is not None:
        current_user.in_person_coaching_area = profile_data.in_person_coaching_area
    if profile_data.coach_certification_number is not None:
        current_user.coach_certification_number = profile_data.coach_certification_number
    if profile_data.coaching_fields is not None:
        current_user.coaching_fields = json.dumps(profile_data.coaching_fields)

    await db.commit()
    await db.refresh(current_user)

    return UserResponse.from_orm(current_user)


@router.get("/staff", response_model=list[UserResponse])
async def get_staff_users(db: AsyncSession = Depends(get_db)):
    """
    Get list of staff users (심사위원).
    Used for assigning staff to projects.
    """
    result = await db.execute(
        select(User).where(User.status == UserStatus.ACTIVE)
    )
    all_users = result.scalars().all()

    # Filter users with 'staff' role
    staff_users = []
    for user in all_users:
        try:
            user_roles = json.loads(user.roles)
            if 'staff' in user_roles:
                staff_users.append(user)
        except json.JSONDecodeError:
            continue

    return [UserResponse.from_orm(user) for user in staff_users]


@router.post("/logout")
async def logout():
    """
    Logout user.
    Note: Since we're using stateless JWT, actual logout is handled client-side
    by removing the token. This endpoint is here for consistency.
    """
    return {"message": "Successfully logged out"}

"""
증빙확인(Verification) API 엔드포인트
- Verifier가 코치의 증빙을 컨펌/취소
- 관리자가 증빙 검증 상태 리셋
- 다중 컨펌 시스템 (N명 이상 컨펌 시 전역 확정)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import (
    User, UserRole, CoachCompetency, CompetencyItem,
    VerificationRecord, SystemConfig, ConfigKeys,
    Notification, NotificationType
)
from app.services.notification_service import send_verification_supplement_notification
from app.models.competency import VerificationStatus, ItemTemplate
from app.schemas.verification import (
    VerificationRecordResponse,
    CompetencyVerificationStatus,
    VerificationConfirmRequest,
    VerificationResetRequest,
    VerificationSupplementRequest,
    PendingVerificationItem,
    ActivityRecord
)
from app.schemas.competency import FileBasicInfo

router = APIRouter(prefix="/verifications", tags=["Verifications"])


async def get_required_verifier_count(db: AsyncSession) -> int:
    """시스템 설정에서 필요한 Verifier 수 조회"""
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == ConfigKeys.REQUIRED_VERIFIER_COUNT)
    )
    config = result.scalar_one_or_none()
    if config:
        try:
            return int(config.value)
        except ValueError:
            return 2
    return 2  # 기본값


async def check_and_update_global_verification(
    db: AsyncSession,
    competency_id: int,
    required_count: int
) -> bool:
    """
    유효한 컨펌 수를 확인하고 필요 시 전역 검증 상태 업데이트
    Returns: True if globally verified, False otherwise
    """
    # 유효한 컨펌 수 계산
    count_result = await db.execute(
        select(func.count(VerificationRecord.record_id))
        .where(
            and_(
                VerificationRecord.competency_id == competency_id,
                VerificationRecord.is_valid == True
            )
        )
    )
    valid_count = count_result.scalar() or 0

    # CoachCompetency 조회
    result = await db.execute(
        select(CoachCompetency).where(CoachCompetency.competency_id == competency_id)
    )
    competency = result.scalar_one_or_none()

    if not competency:
        return False

    # 전역 검증 상태 업데이트
    if valid_count >= required_count and not competency.is_globally_verified:
        competency.is_globally_verified = True
        competency.globally_verified_at = datetime.now(timezone.utc)
        await db.commit()
        return True
    elif valid_count < required_count and competency.is_globally_verified:
        # 컨펌 수가 부족해지면 전역 검증 해제
        competency.is_globally_verified = False
        competency.globally_verified_at = None
        await db.commit()
        return False

    return competency.is_globally_verified


@router.get("/pending", response_model=List[PendingVerificationItem])
async def get_pending_verifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.VERIFIER, UserRole.PROJECT_MANAGER, UserRole.SUPER_ADMIN]))
):
    """
    검증 대기 중인 증빙 목록 조회
    - 아직 전역 검증되지 않은 증빙들
    - 현재 사용자의 컨펌 여부 포함
    """
    required_count = await get_required_verifier_count(db)

    # 전역 검증되지 않은 CoachCompetency 조회 (값이나 파일이 있는 것만)
    query = (
        select(CoachCompetency)
        .join(CompetencyItem, CoachCompetency.item_id == CompetencyItem.item_id)
        .join(User, CoachCompetency.user_id == User.user_id)
        .options(
            selectinload(CoachCompetency.competency_item),
            selectinload(CoachCompetency.user),
            selectinload(CoachCompetency.verification_records),
            selectinload(CoachCompetency.file)  # 파일 정보 로드
        )
        .where(
            and_(
                CoachCompetency.is_globally_verified == False,
                # 파일이 첨부된 증빙만 (파일 요구 템플릿에서)
                CoachCompetency.file_id.isnot(None),
                CompetencyItem.template.in_([
                    ItemTemplate.FILE,
                    ItemTemplate.TEXT_FILE,
                    ItemTemplate.DEGREE,
                    ItemTemplate.COACHING_HISTORY
                ])
            )
        )
        .order_by(CoachCompetency.updated_at.desc())
    )

    result = await db.execute(query)
    competencies = result.scalars().all()

    items = []
    for comp in competencies:
        # 유효한 컨펌 수 계산
        valid_records = [r for r in comp.verification_records if r.is_valid]
        verification_count = len(valid_records)

        # 현재 사용자의 컨펌 기록 확인
        my_record = next(
            (r for r in valid_records if r.verifier_id == current_user.user_id),
            None
        )

        my_verification = None
        if my_record:
            # verifier 이름 조회
            verifier_result = await db.execute(
                select(User.name).where(User.user_id == my_record.verifier_id)
            )
            verifier_name = verifier_result.scalar_one_or_none()

            my_verification = VerificationRecordResponse(
                record_id=my_record.record_id,
                competency_id=my_record.competency_id,
                verifier_id=my_record.verifier_id,
                verifier_name=verifier_name,
                verified_at=my_record.verified_at,
                is_valid=my_record.is_valid
            )

        # Build file info if file exists
        file_info = None
        if comp.file:
            file_info = FileBasicInfo(
                file_id=comp.file.file_id,
                original_filename=comp.file.original_filename,
                file_size=comp.file.file_size,
                mime_type=comp.file.mime_type,
                uploaded_at=comp.file.uploaded_at
            )

        items.append(PendingVerificationItem(
            competency_id=comp.competency_id,
            user_id=comp.user_id,
            user_name=comp.user.name if comp.user else "Unknown",
            user_email=comp.user.email if comp.user else "",
            item_id=comp.item_id,
            item_name=comp.competency_item.item_name if comp.competency_item else "Unknown",
            item_code=comp.competency_item.item_code if comp.competency_item else "",
            value=comp.value,
            file_id=comp.file_id,
            file_info=file_info,
            created_at=comp.created_at or datetime.now(timezone.utc),
            verification_count=verification_count,
            required_count=required_count,
            my_verification=my_verification,
            verification_status=comp.verification_status.value if comp.verification_status else "pending",
            rejection_reason=comp.rejection_reason
        ))

    return items


@router.get("/{competency_id}", response_model=CompetencyVerificationStatus)
async def get_verification_status(
    competency_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 증빙의 검증 상태 조회"""
    required_count = await get_required_verifier_count(db)

    # CoachCompetency 조회
    result = await db.execute(
        select(CoachCompetency)
        .options(
            selectinload(CoachCompetency.competency_item),
            selectinload(CoachCompetency.user),
            selectinload(CoachCompetency.verification_records),
            selectinload(CoachCompetency.file)  # 파일 정보 로드
        )
        .where(CoachCompetency.competency_id == competency_id)
    )
    competency = result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증빙을 찾을 수 없습니다"
        )

    # 유효한 검증 기록만 조회 (records 필드용)
    valid_records = [r for r in competency.verification_records if r.is_valid]

    # verifier 이름 조회 및 VerificationRecordResponse 생성
    records_with_names = []
    for record in valid_records:
        verifier_result = await db.execute(
            select(User.name).where(User.user_id == record.verifier_id)
        )
        verifier_name = verifier_result.scalar_one_or_none()

        records_with_names.append(VerificationRecordResponse(
            record_id=record.record_id,
            competency_id=record.competency_id,
            verifier_id=record.verifier_id,
            verifier_name=verifier_name,
            verified_at=record.verified_at,
            is_valid=record.is_valid
        ))

    # ============================================================================
    # 활동 기록 생성 (컨펌 + 보완요청 + 리셋)
    # ============================================================================
    activities = []

    # 1. 모든 컨펌 기록 (유효/무효 모두)
    for record in competency.verification_records:
        verifier_result = await db.execute(
            select(User.name).where(User.user_id == record.verifier_id)
        )
        verifier_name = verifier_result.scalar_one_or_none() or "Unknown"

        activities.append(ActivityRecord(
            activity_type="confirm",
            actor_name=verifier_name,
            message=None,
            created_at=record.verified_at,
            is_valid=record.is_valid
        ))

    # 2. 보완요청/리셋 알림 조회
    activity_notifications_result = await db.execute(
        select(Notification)
        .where(
            Notification.related_competency_id == competency_id,
            Notification.type.in_([
                NotificationType.VERIFICATION_SUPPLEMENT_REQUEST.value,
                NotificationType.VERIFICATION_RESET.value
            ])
        )
        .order_by(Notification.created_at.desc())
    )
    activity_notifications = activity_notifications_result.scalars().all()

    for notif in activity_notifications:
        activity_type = "reset" if "reset" in notif.type else "supplement_request"
        activities.append(ActivityRecord(
            activity_type=activity_type,
            actor_name="관리자" if activity_type == "reset" else "검토자",
            message=notif.message,
            created_at=notif.created_at,
            is_valid=True
        ))

    # 시간순 정렬 (최신순)
    activities.sort(key=lambda x: x.created_at, reverse=True)

    # Build file info if file exists
    file_info = None
    if competency.file:
        file_info = FileBasicInfo(
            file_id=competency.file.file_id,
            original_filename=competency.file.original_filename,
            file_size=competency.file.file_size,
            mime_type=competency.file.mime_type,
            uploaded_at=competency.file.uploaded_at
        )

    return CompetencyVerificationStatus(
        competency_id=competency.competency_id,
        user_id=competency.user_id,
        user_name=competency.user.name if competency.user else None,
        item_id=competency.item_id,
        item_name=competency.competency_item.item_name if competency.competency_item else None,
        value=competency.value,
        file_id=competency.file_id,
        file_info=file_info,
        is_globally_verified=competency.is_globally_verified,
        globally_verified_at=competency.globally_verified_at,
        verification_count=len(valid_records),
        required_count=required_count,
        records=records_with_names,
        activities=activities
    )


@router.post("/confirm", response_model=VerificationRecordResponse)
async def confirm_verification(
    request: VerificationConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.VERIFIER, UserRole.PROJECT_MANAGER, UserRole.SUPER_ADMIN]))
):
    """
    증빙 컨펌
    - Verifier가 증빙의 진위를 확인하고 컨펌
    - 필요 수 이상 컨펌되면 자동으로 전역 검증 완료
    """
    competency_id = request.competency_id

    # CoachCompetency 존재 확인
    result = await db.execute(
        select(CoachCompetency).where(CoachCompetency.competency_id == competency_id)
    )
    competency = result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증빙을 찾을 수 없습니다"
        )

    # 이미 전역 검증 완료된 경우
    if competency.is_globally_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 검증 완료된 증빙입니다"
        )

    # 기존 유효한 컨펌 기록 확인
    existing_result = await db.execute(
        select(VerificationRecord).where(
            and_(
                VerificationRecord.competency_id == competency_id,
                VerificationRecord.verifier_id == current_user.user_id,
                VerificationRecord.is_valid == True
            )
        )
    )
    existing_record = existing_result.scalar_one_or_none()

    if existing_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 컨펌한 증빙입니다"
        )

    # 새 컨펌 기록 생성
    new_record = VerificationRecord(
        competency_id=competency_id,
        verifier_id=current_user.user_id,
        verified_at=datetime.now(timezone.utc),
        is_valid=True
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)

    # 전역 검증 상태 확인 및 업데이트
    required_count = await get_required_verifier_count(db)
    await check_and_update_global_verification(db, competency_id, required_count)

    return VerificationRecordResponse(
        record_id=new_record.record_id,
        competency_id=new_record.competency_id,
        verifier_id=new_record.verifier_id,
        verifier_name=current_user.name,
        verified_at=new_record.verified_at,
        is_valid=new_record.is_valid
    )


@router.delete("/{record_id}")
async def cancel_verification(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.VERIFIER, UserRole.PROJECT_MANAGER, UserRole.SUPER_ADMIN]))
):
    """
    본인의 컨펌 취소
    - 본인이 한 컨펌만 취소 가능
    """
    result = await db.execute(
        select(VerificationRecord).where(VerificationRecord.record_id == record_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="컨펌 기록을 찾을 수 없습니다"
        )

    # 본인 컨펌인지 확인 (SUPER_ADMIN은 예외)
    user_roles = current_user.roles if isinstance(current_user.roles, list) else [current_user.roles]
    is_super_admin = UserRole.SUPER_ADMIN in user_roles or UserRole.SUPER_ADMIN.value in user_roles

    if record.verifier_id != current_user.user_id and not is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인의 컨펌만 취소할 수 있습니다"
        )

    # 이미 무효화된 기록인지 확인
    if not record.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 컨펌입니다"
        )

    competency_id = record.competency_id

    # 컨펌 무효화
    record.is_valid = False
    await db.commit()

    # 전역 검증 상태 재확인
    required_count = await get_required_verifier_count(db)
    await check_and_update_global_verification(db, competency_id, required_count)

    return {"message": "컨펌이 취소되었습니다"}


@router.post("/{competency_id}/reset")
async def reset_verification(
    competency_id: int,
    request: VerificationResetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.PROJECT_MANAGER, UserRole.SUPER_ADMIN]))
):
    """
    증빙 검증 상태 리셋
    - 관리자/PM만 가능
    - 모든 컨펌 기록 무효화 + 전역 검증 해제
    """
    # CoachCompetency 조회 (활동 기록용 item_name 포함)
    result = await db.execute(
        select(CoachCompetency)
        .options(selectinload(CoachCompetency.competency_item))
        .where(CoachCompetency.competency_id == competency_id)
    )
    competency = result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증빙을 찾을 수 없습니다"
        )

    # 모든 유효한 컨펌 기록 무효화
    records_result = await db.execute(
        select(VerificationRecord).where(
            and_(
                VerificationRecord.competency_id == competency_id,
                VerificationRecord.is_valid == True
            )
        )
    )
    records = records_result.scalars().all()

    for record in records:
        record.is_valid = False

    # 전역 검증 상태 해제
    competency.is_globally_verified = False
    competency.globally_verified_at = None

    # 리셋 활동 기록용 알림 생성 (코치에게는 보내지 않고 기록용으로만)
    item_name = competency.competency_item.item_name if competency.competency_item else "항목"
    reset_notification = Notification(
        user_id=competency.user_id,
        type=NotificationType.VERIFICATION_RESET.value,
        title=f"검증 리셋: {item_name}",
        message=request.reason,
        related_competency_id=competency_id,
        email_sent=False
    )
    db.add(reset_notification)

    await db.commit()

    return {
        "message": "증빙 검증이 리셋되었습니다",
        "invalidated_count": len(records),
        "reason": request.reason
    }


@router.post("/{competency_id}/request-supplement")
async def request_supplement(
    competency_id: int,
    request: VerificationSupplementRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.VERIFIER, UserRole.PROJECT_MANAGER, UserRole.SUPER_ADMIN]))
):
    """
    증빙 보완 요청
    - Verifier가 증빙이 불충분하다고 판단할 때 사용
    - 기존 모든 컨펌 기록 무효화
    - 상태를 REJECTED로 변경
    - 코치에게 알림 발송
    """
    # CoachCompetency 조회
    result = await db.execute(
        select(CoachCompetency)
        .options(selectinload(CoachCompetency.competency_item))
        .where(CoachCompetency.competency_id == competency_id)
    )
    competency = result.scalar_one_or_none()

    if not competency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증빙을 찾을 수 없습니다"
        )

    # 이미 전역 검증 완료된 경우 경고
    if competency.is_globally_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 검증 완료된 증빙입니다. 먼저 관리자에게 리셋을 요청하세요."
        )

    # 모든 유효한 컨펌 기록 무효화
    records_result = await db.execute(
        select(VerificationRecord).where(
            and_(
                VerificationRecord.competency_id == competency_id,
                VerificationRecord.is_valid == True
            )
        )
    )
    records = records_result.scalars().all()

    invalidated_count = 0
    for record in records:
        record.is_valid = False
        invalidated_count += 1

    # 상태 변경
    competency.verification_status = VerificationStatus.REJECTED
    competency.rejection_reason = request.reason
    competency.is_globally_verified = False
    competency.globally_verified_at = None

    # 역량 항목명 조회
    item_name = "역량 항목"
    if competency.competency_item:
        item_name = competency.competency_item.item_name

    # 코치에게 알림 및 이메일 발송
    await send_verification_supplement_notification(
        db=db,
        user_id=competency.user_id,
        competency_id=competency_id,
        item_name=item_name,
        reason=request.reason
    )

    await db.commit()

    return {
        "message": "보완 요청이 완료되었습니다",
        "competency_id": competency_id,
        "invalidated_count": invalidated_count,
        "reason": request.reason
    }

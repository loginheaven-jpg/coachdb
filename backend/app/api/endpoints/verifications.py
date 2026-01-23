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
    Notification, NotificationType, ApplicationData, Application
)
from app.models.project import Project
from app.models.competency import VerificationStatus, ItemTemplate, ProjectItem, ProofRequiredLevel
from app.services.notification_service import send_verification_supplement_notification
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
    - CoachCompetency: 전역 검증되지 않은 증빙
    - ApplicationData: 아직 approved가 아닌 지원서 항목 (파일 첨부된 것만)
    - 현재 사용자의 컨펌 여부 포함
    """
    from app.models.file import File

    required_count = await get_required_verifier_count(db)
    items = []

    # =========================================================================
    # 1. CoachCompetency 조회 (기존 로직)
    # =========================================================================
    query = (
        select(CoachCompetency)
        .join(CompetencyItem, CoachCompetency.item_id == CompetencyItem.item_id)
        .join(User, CoachCompetency.user_id == User.user_id)
        .options(
            selectinload(CoachCompetency.competency_item),
            selectinload(CoachCompetency.user),
            selectinload(CoachCompetency.verification_records),
            selectinload(CoachCompetency.file)
        )
        .where(
            and_(
                CoachCompetency.is_globally_verified == False,
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

    for comp in competencies:
        valid_records = [r for r in comp.verification_records if r.is_valid]
        verification_count = len(valid_records)

        my_record = next(
            (r for r in valid_records if r.verifier_id == current_user.user_id),
            None
        )

        my_verification = None
        if my_record:
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
            source='competency',
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

    # =========================================================================
    # 2. ApplicationData 조회 (신규 로직)
    # - 지원서가 제출됨(submitted) 상태
    # - 검증 상태가 approved가 아님
    # - 파일이 첨부됨 (submitted_file_id is not None)
    # =========================================================================
    app_data_query = (
        select(ApplicationData)
        .join(Application, ApplicationData.application_id == Application.application_id)
        .join(Project, Application.project_id == Project.project_id)
        .join(User, Application.user_id == User.user_id)
        .join(CompetencyItem, ApplicationData.item_id == CompetencyItem.item_id)
        .outerjoin(File, ApplicationData.submitted_file_id == File.file_id)
        .options(
            selectinload(ApplicationData.application),
            selectinload(ApplicationData.competency_item),
            selectinload(ApplicationData.submitted_file),
            selectinload(ApplicationData.verification_records)
        )
        .where(
            and_(
                Application.status == 'submitted',
                ApplicationData.verification_status != 'approved',
                ApplicationData.submitted_file_id.isnot(None)  # 파일 첨부된 것만
            )
        )
        .order_by(ApplicationData.data_id.desc())
    )

    app_data_result = await db.execute(app_data_query)
    app_data_items = app_data_result.scalars().all()

    for ad in app_data_items:
        # 유효한 컨펌 수 계산
        valid_records = [r for r in ad.verification_records if r.is_valid]
        verification_count = len(valid_records)

        # 현재 사용자의 컨펌 기록 확인
        my_record = next(
            (r for r in valid_records if r.verifier_id == current_user.user_id),
            None
        )

        my_verification = None
        if my_record:
            verifier_result = await db.execute(
                select(User.name).where(User.user_id == my_record.verifier_id)
            )
            verifier_name = verifier_result.scalar_one_or_none()

            my_verification = VerificationRecordResponse(
                record_id=my_record.record_id,
                application_data_id=my_record.application_data_id,
                verifier_id=my_record.verifier_id,
                verifier_name=verifier_name,
                verified_at=my_record.verified_at,
                is_valid=my_record.is_valid
            )

        # 파일 정보
        file_info = None
        if ad.submitted_file:
            file_info = FileBasicInfo(
                file_id=ad.submitted_file.file_id,
                original_filename=ad.submitted_file.original_filename,
                file_size=ad.submitted_file.file_size,
                mime_type=ad.submitted_file.mime_type,
                uploaded_at=ad.submitted_file.uploaded_at
            )

        # Application과 User 정보 조회
        app = ad.application
        user_result = await db.execute(
            select(User).where(User.user_id == app.user_id)
        )
        user = user_result.scalar_one_or_none()

        # Project 정보 조회
        project_result = await db.execute(
            select(Project).where(Project.project_id == app.project_id)
        )
        project = project_result.scalar_one_or_none()

        items.append(PendingVerificationItem(
            source='application_data',
            application_data_id=ad.data_id,
            user_id=app.user_id,
            user_name=user.name if user else "Unknown",
            user_email=user.email if user else "",
            item_id=ad.item_id,
            item_name=ad.competency_item.item_name if ad.competency_item else "Unknown",
            item_code=ad.competency_item.item_code if ad.competency_item else "",
            value=ad.submitted_value,
            file_id=ad.submitted_file_id,
            file_info=file_info,
            created_at=app.submitted_at or datetime.now(timezone.utc),
            verification_count=verification_count,
            required_count=required_count,
            my_verification=my_verification,
            verification_status=ad.verification_status if isinstance(ad.verification_status, str) else ad.verification_status,
            rejection_reason=ad.rejection_reason,
            # ApplicationData 전용 필드
            application_id=ad.application_id,
            project_id=app.project_id,
            project_name=project.project_name if project else "Unknown"
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

    # Find current user's verification record
    my_verification = None
    for record in records_with_names:
        if record.verifier_id == current_user.user_id:
            my_verification = record
            break

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
        activities=activities,
        my_verification=my_verification
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
    - CoachCompetency: 필요 수 이상 컨펌되면 자동으로 전역 검증 완료
    - ApplicationData: 필요 수 이상 컨펌되면 approved + CoachCompetency에 반영
    """
    required_count = await get_required_verifier_count(db)

    # =========================================================================
    # Case 1: CoachCompetency 컨펌
    # =========================================================================
    if request.competency_id:
        competency_id = request.competency_id

        result = await db.execute(
            select(CoachCompetency).where(CoachCompetency.competency_id == competency_id)
        )
        competency = result.scalar_one_or_none()

        if not competency:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="증빙을 찾을 수 없습니다"
            )

        if competency.is_globally_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 검증 완료된 증빙입니다"
            )

        # 기존 컨펌 기록 확인
        existing_result = await db.execute(
            select(VerificationRecord).where(
                and_(
                    VerificationRecord.competency_id == competency_id,
                    VerificationRecord.verifier_id == current_user.user_id
                )
            )
        )
        existing_record = existing_result.scalar_one_or_none()

        if existing_record:
            if existing_record.is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 컨펌한 증빙입니다"
                )
            existing_record.is_valid = True
            existing_record.verified_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(existing_record)
            record_to_return = existing_record
        else:
            new_record = VerificationRecord(
                competency_id=competency_id,
                verifier_id=current_user.user_id,
                verified_at=datetime.now(timezone.utc),
                is_valid=True
            )
            db.add(new_record)
            await db.commit()
            await db.refresh(new_record)
            record_to_return = new_record

        await check_and_update_global_verification(db, competency_id, required_count)

        return VerificationRecordResponse(
            record_id=record_to_return.record_id,
            competency_id=record_to_return.competency_id,
            verifier_id=record_to_return.verifier_id,
            verifier_name=current_user.name,
            verified_at=record_to_return.verified_at,
            is_valid=record_to_return.is_valid
        )

    # =========================================================================
    # Case 2: ApplicationData 컨펌
    # =========================================================================
    if request.application_data_id:
        data_id = request.application_data_id

        result = await db.execute(
            select(ApplicationData)
            .options(
                selectinload(ApplicationData.application),
                selectinload(ApplicationData.competency_item),
                selectinload(ApplicationData.verification_records)
            )
            .where(ApplicationData.data_id == data_id)
        )
        app_data = result.scalar_one_or_none()

        if not app_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지원서 항목을 찾을 수 없습니다"
            )

        if app_data.verification_status == 'approved':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 승인된 항목입니다"
            )

        # 기존 컨펌 기록 확인
        existing_result = await db.execute(
            select(VerificationRecord).where(
                and_(
                    VerificationRecord.application_data_id == data_id,
                    VerificationRecord.verifier_id == current_user.user_id
                )
            )
        )
        existing_record = existing_result.scalar_one_or_none()

        if existing_record:
            if existing_record.is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 컨펌한 항목입니다"
                )
            existing_record.is_valid = True
            existing_record.verified_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(existing_record)
            record_to_return = existing_record
        else:
            new_record = VerificationRecord(
                application_data_id=data_id,
                verifier_id=current_user.user_id,
                verified_at=datetime.now(timezone.utc),
                is_valid=True
            )
            db.add(new_record)
            await db.commit()
            await db.refresh(new_record)
            record_to_return = new_record

        # N명 컨펌 확인 → approved + CoachCompetency 반영
        valid_count_result = await db.execute(
            select(func.count(VerificationRecord.record_id))
            .where(
                and_(
                    VerificationRecord.application_data_id == data_id,
                    VerificationRecord.is_valid == True
                )
            )
        )
        valid_count = valid_count_result.scalar() or 0

        if valid_count >= required_count and app_data.verification_status != 'approved':
            app_data.verification_status = 'approved'
            app_data.reviewed_at = datetime.now(timezone.utc)

            # CoachCompetency에 반영 (P3/P5)
            await reflect_to_coach_competency(db, app_data)

            await db.commit()

        return VerificationRecordResponse(
            record_id=record_to_return.record_id,
            application_data_id=record_to_return.application_data_id,
            verifier_id=record_to_return.verifier_id,
            verifier_name=current_user.name,
            verified_at=record_to_return.verified_at,
            is_valid=record_to_return.is_valid
        )


async def reflect_to_coach_competency(db: AsyncSession, app_data: ApplicationData):
    """
    승인된 ApplicationData를 CoachCompetency에 반영 (P3/P5)

    - linked_competency가 있으면: 해당 CoachCompetency 업데이트
    - linked_competency가 없으면: 새 CoachCompetency 생성
    - is_globally_verified = True로 설정
    """
    application = app_data.application
    if not application:
        return

    user_id = application.user_id
    item_id = app_data.item_id

    if app_data.competency_id:
        # 기존 CoachCompetency가 있으면 업데이트
        result = await db.execute(
            select(CoachCompetency).where(CoachCompetency.competency_id == app_data.competency_id)
        )
        competency = result.scalar_one_or_none()

        if competency:
            competency.value = app_data.submitted_value
            competency.file_id = app_data.submitted_file_id
            competency.is_globally_verified = True
            competency.globally_verified_at = datetime.now(timezone.utc)
            competency.updated_at = datetime.now(timezone.utc)
    else:
        # 새 CoachCompetency 생성
        # 먼저 같은 user_id + item_id가 있는지 확인
        existing_result = await db.execute(
            select(CoachCompetency).where(
                and_(
                    CoachCompetency.user_id == user_id,
                    CoachCompetency.item_id == item_id
                )
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            # 기존 역량 업데이트
            existing.value = app_data.submitted_value
            existing.file_id = app_data.submitted_file_id
            existing.is_globally_verified = True
            existing.globally_verified_at = datetime.now(timezone.utc)
            existing.updated_at = datetime.now(timezone.utc)
            # ApplicationData에 링크 설정
            app_data.competency_id = existing.competency_id
        else:
            # 새로 생성
            new_competency = CoachCompetency(
                user_id=user_id,
                item_id=item_id,
                value=app_data.submitted_value,
                file_id=app_data.submitted_file_id,
                is_globally_verified=True,
                globally_verified_at=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(new_competency)
            await db.flush()
            # ApplicationData에 링크 설정
            app_data.competency_id = new_competency.competency_id


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

"""
Scoring service for automatic score calculation
"""
from decimal import Decimal
from typing import Optional, List, Dict, Any
import logging
import json
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.application import Application, ApplicationData
from app.models.competency import ProjectItem, ScoringCriteria, MatchingType, ValueSourceType
from app.models.project import Project
from app.models.reviewer_evaluation import ReviewerEvaluation
from app.models.custom_question import CustomQuestion, CustomQuestionAnswer
from app.models.user import User

logger = logging.getLogger(__name__)


def extract_value_for_scoring(
    submitted_value: str,
    criteria: ScoringCriteria,
    user: Optional[User] = None
) -> str:
    """
    Extract value for scoring based on value source type

    Args:
        submitted_value: The submitted value from ApplicationData
        criteria: ScoringCriteria with value_source settings
        user: User object (required for USER_FIELD source)

    Returns:
        Extracted value string for matching
    """
    value_source = criteria.value_source or ValueSourceType.SUBMITTED

    if value_source == ValueSourceType.USER_FIELD:
        # Extract from User table field
        if not user:
            logger.warning(f"User not provided for USER_FIELD criteria {criteria.criteria_id}")
            return ""
        source_field = criteria.source_field or ""
        raw_value = getattr(user, source_field, "") or ""

        # Apply extract pattern if specified (e.g., "^(.{3})" to get first 3 chars)
        if criteria.extract_pattern and raw_value:
            try:
                match = re.match(criteria.extract_pattern, str(raw_value))
                if match and match.groups():
                    return match.group(1)
            except re.error as e:
                logger.error(f"Invalid regex pattern '{criteria.extract_pattern}': {e}")
        return str(raw_value)

    elif value_source == ValueSourceType.JSON_FIELD:
        # Extract from submitted_value JSON
        source_field = criteria.source_field or ""
        if not submitted_value or not source_field:
            return ""
        try:
            data = json.loads(submitted_value)
            if isinstance(data, dict):
                return str(data.get(source_field, ""))
            elif isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                # For repeatable items, get from first entry
                return str(data[0].get(source_field, ""))
        except (json.JSONDecodeError, TypeError) as e:
            logger.debug(f"Failed to parse JSON for field extraction: {e}")
        return ""

    else:  # SUBMITTED (default)
        return submitted_value or ""


def match_grade_value(
    extracted_value: str,
    expected_value: str,
    submitted_file_id: Optional[int] = None,
    submitted_value: Optional[str] = None
) -> Optional[Decimal]:
    """
    Match grade value and return score

    Args:
        extracted_value: The extracted value to match
        expected_value: JSON config with grade definitions
        submitted_file_id: File ID if a file was submitted (for proof_penalty)
        submitted_value: Raw submitted value (for multi_select JSON parsing)

    Returns:
        Score for matching grade, or None if no match
    """
    try:
        config = json.loads(expected_value)
    except json.JSONDecodeError:
        logger.error(f"Invalid GRADE config JSON: {expected_value}")
        return None

    grade_type = config.get("type", "string")
    grades = config.get("grades", [])
    proof_penalty = config.get("proofPenalty", 0)

    base_score = Decimal('0')

    if grade_type == "file_exists":
        # 파일 유무 점수
        if submitted_file_id:
            return Decimal(str(grades.get("exists", 0)))
        else:
            return Decimal(str(grades.get("none", 0)))

    elif grade_type == "multi_select":
        # 복수선택 점수
        mode = config.get("mode", "contains")
        try:
            selected_values = json.loads(submitted_value) if submitted_value else []
        except json.JSONDecodeError:
            selected_values = []

        if mode == "contains":
            # 특정값 포함 여부 (각각 가산)
            for grade in grades:
                grade_value = str(grade.get("value", ""))
                if grade_value in selected_values:
                    base_score += Decimal(str(grade.get("score", 0)))
        else:
            # 선택 개수
            count = len(selected_values)
            sorted_grades = sorted(grades, key=lambda x: x.get("min", 0), reverse=True)
            for grade in sorted_grades:
                if count >= grade.get("min", 0):
                    base_score = Decimal(str(grade.get("score", 0)))
                    break

        return base_score

    elif grade_type == "numeric":
        # Numeric range matching
        if not extracted_value:
            return None
        try:
            # Extract number from value
            numbers = re.findall(r'[\d.]+', str(extracted_value))
            if not numbers:
                return None
            num_value = float(numbers[0])

            for grade in grades:
                min_val = grade.get("min", float("-inf"))
                max_val = grade.get("max", float("inf"))
                if min_val <= num_value <= max_val:
                    base_score = Decimal(str(grade.get("score", 0)))
                    break
        except (ValueError, TypeError) as e:
            logger.debug(f"Numeric grade matching failed: {e}")
            return None

        # 증빙 감점 적용
        if proof_penalty and not submitted_file_id:
            base_score += Decimal(str(proof_penalty))  # 음수이므로 더하면 감점

        return max(base_score, Decimal('0'))  # 0점 미만 방지

    else:  # string matching
        if not extracted_value:
            return None
        match_mode = config.get("matchMode", "exact")
        extracted_lower = str(extracted_value).strip().lower()

        for grade in grades:
            grade_value = str(grade.get("value", "")).strip().lower()

            if match_mode == "contains":
                # 포함 매칭
                if grade_value in extracted_lower:
                    base_score = Decimal(str(grade.get("score", 0)))
                    break
            else:
                # 정확히 일치 (기본)
                if grade_value == extracted_lower:
                    base_score = Decimal(str(grade.get("score", 0)))
                    break

        return base_score if base_score > 0 else None


def match_value(submitted_value: str, expected_value: str, matching_type: MatchingType) -> bool:
    """
    Check if submitted value matches the expected value based on matching type

    Args:
        submitted_value: The value submitted by the applicant
        expected_value: The expected value from scoring criteria
        matching_type: Type of matching (EXACT, CONTAINS, RANGE)

    Returns:
        True if the value matches, False otherwise
    """
    if not submitted_value:
        return False

    submitted_str = str(submitted_value).strip().lower()
    expected_str = str(expected_value).strip().lower()

    if matching_type == MatchingType.EXACT:
        return submitted_str == expected_str

    elif matching_type == MatchingType.CONTAINS:
        return expected_str in submitted_str

    elif matching_type == MatchingType.RANGE:
        # Parse range format: "min-max" or ">=min" or "<=max"
        try:
            # Try to extract number from submitted value
            numbers = re.findall(r'[\d.]+', submitted_str)
            if not numbers:
                return False
            submitted_num = float(numbers[0])

            # Parse expected value
            if '-' in expected_str and not expected_str.startswith('-'):
                # Range format: "min-max"
                parts = expected_str.split('-')
                if len(parts) == 2:
                    min_val = float(parts[0])
                    max_val = float(parts[1])
                    return min_val <= submitted_num <= max_val
            elif expected_str.startswith('>='):
                min_val = float(expected_str[2:])
                return submitted_num >= min_val
            elif expected_str.startswith('<='):
                max_val = float(expected_str[2:])
                return submitted_num <= max_val
            elif expected_str.startswith('>'):
                min_val = float(expected_str[1:])
                return submitted_num > min_val
            elif expected_str.startswith('<'):
                max_val = float(expected_str[1:])
                return submitted_num < max_val
            else:
                # Single number - exact match
                expected_num = float(expected_str)
                return submitted_num == expected_num
        except (ValueError, TypeError):
            return False

    return False


def calculate_item_score(
    submitted_value: str,
    scoring_criteria: List[ScoringCriteria],
    max_score: Optional[Decimal] = None,
    user: Optional[User] = None,
    submitted_file_id: Optional[int] = None
) -> Decimal:
    """
    Calculate score for a single item based on scoring criteria

    Args:
        submitted_value: The value submitted by the applicant
        scoring_criteria: List of scoring criteria for this item
        max_score: Maximum score for this item (for validation)
        user: User object (required for USER_FIELD value source)
        submitted_file_id: File ID if a file was submitted (for file_exists and proof penalty)

    Returns:
        The calculated score
    """
    total_score = Decimal('0')

    for criteria in scoring_criteria:
        # Handle GRADE matching type specially
        if criteria.matching_type == MatchingType.GRADE:
            # Extract value based on source
            extracted = extract_value_for_scoring(submitted_value, criteria, user)
            grade_score = match_grade_value(
                extracted, criteria.expected_value,
                submitted_file_id=submitted_file_id,
                submitted_value=submitted_value
            )
            if grade_score is not None:
                total_score += grade_score
                break  # GRADE typically has one match per item
        else:
            # Legacy matching types (EXACT, CONTAINS, RANGE)
            if match_value(submitted_value, criteria.expected_value, criteria.matching_type):
                total_score += Decimal(str(criteria.score))
                # For EXACT matching, we typically take the first match
                if criteria.matching_type == MatchingType.EXACT:
                    break

    # Cap at max_score if specified
    if max_score is not None and total_score > max_score:
        total_score = max_score

    return total_score


async def calculate_application_auto_score(
    db: AsyncSession,
    application_id: int
) -> Decimal:
    """
    Calculate the automatic score for an application

    Args:
        db: Database session
        application_id: Application ID

    Returns:
        The calculated auto_score
    """
    # Get application with project items and user
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.project).selectinload(Project.project_items).selectinload(ProjectItem.scoring_criteria),
            selectinload(Application.application_data),
            selectinload(Application.user)  # Load user for USER_FIELD scoring
        )
        .where(Application.application_id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise ValueError(f"Application {application_id} not found")

    total_score = Decimal('0')
    applicant_user = application.user  # Get user for GRADE scoring with USER_FIELD source

    # Build a map of item_id to project_item with scoring criteria
    project_items_map: Dict[int, ProjectItem] = {}
    for pi in application.project.project_items:
        project_items_map[pi.item_id] = pi

    # Calculate score for each application data item
    for app_data in application.application_data:
        project_item = project_items_map.get(app_data.item_id)
        if not project_item or not project_item.scoring_criteria:
            continue

        # Calculate item score (pass user for USER_FIELD value source, file_id for proof penalty)
        item_score = calculate_item_score(
            app_data.submitted_value or '',
            project_item.scoring_criteria,
            project_item.max_score,
            applicant_user,
            app_data.submitted_file_id
        )

        # Update item_score in application_data
        app_data.item_score = item_score
        total_score += item_score

    # Also calculate custom question scores if they are evaluation items
    custom_q_result = await db.execute(
        select(CustomQuestion)
        .where(CustomQuestion.project_id == application.project_id)
        .where(CustomQuestion.is_evaluation_item == True)
    )
    custom_questions = custom_q_result.scalars().all()

    if custom_questions:
        answers_result = await db.execute(
            select(CustomQuestionAnswer)
            .where(CustomQuestionAnswer.application_id == application_id)
        )
        answers = {a.question_id: a for a in answers_result.scalars().all()}

        for cq in custom_questions:
            answer = answers.get(cq.question_id)
            if answer and cq.scoring_rules:
                try:
                    rules = json.loads(cq.scoring_rules)
                    for rule in rules:
                        if match_value(answer.answer_text or '', rule.get('expected_value', ''), MatchingType.EXACT):
                            total_score += Decimal(str(rule.get('score', 0)))
                            break
                except (json.JSONDecodeError, TypeError):
                    pass

    # Update application auto_score
    application.auto_score = total_score
    await db.flush()

    return total_score


async def calculate_project_all_scores(
    db: AsyncSession,
    project_id: int
) -> Dict[str, Any]:
    """
    Calculate auto_score for all submitted applications in a project

    Args:
        db: Database session
        project_id: Project ID

    Returns:
        Summary of score calculation results
    """
    # Get all submitted applications
    result = await db.execute(
        select(Application)
        .where(Application.project_id == project_id)
        .where(Application.status.in_(['submitted', 'reviewing', 'completed']))
    )
    applications = result.scalars().all()

    calculated_count = 0
    error_count = 0
    errors = []

    for app in applications:
        try:
            await calculate_application_auto_score(db, app.application_id)
            calculated_count += 1
        except Exception as e:
            error_count += 1
            errors.append({
                'application_id': app.application_id,
                'error': str(e)
            })
            logger.error(f"Error calculating score for application {app.application_id}: {e}")

    await db.commit()

    return {
        'project_id': project_id,
        'total_applications': len(applications),
        'calculated_count': calculated_count,
        'error_count': error_count,
        'errors': errors
    }


async def calculate_qualitative_score_average(
    db: AsyncSession,
    application_id: int
) -> Optional[Decimal]:
    """
    Calculate the average qualitative score from reviewer evaluations

    Args:
        db: Database session
        application_id: Application ID

    Returns:
        Average qualitative score or None if no evaluations
    """
    result = await db.execute(
        select(func.avg(ReviewerEvaluation.total_score))
        .where(ReviewerEvaluation.application_id == application_id)
    )
    avg_score = result.scalar_one_or_none()

    return Decimal(str(avg_score)) if avg_score else None


async def calculate_final_score(
    db: AsyncSession,
    application_id: int,
    quantitative_weight: Decimal = Decimal('70'),
    qualitative_weight: Decimal = Decimal('30')
) -> Optional[Decimal]:
    """
    Calculate the final weighted score

    Formula: final_score = (auto_score * quant_weight / 100) + (qual_avg * qual_weight / 100)

    The weights are percentages (0-100) that should sum to 100.
    - quantitative_weight: Weight for auto_score (default 70%)
    - qualitative_weight: Weight for qualitative average (default 30%)

    Args:
        db: Database session
        application_id: Application ID
        quantitative_weight: Weight for quantitative score (0-100)
        qualitative_weight: Weight for qualitative score (0-100)

    Returns:
        The calculated final score
    """
    # Get application
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.project))
        .where(Application.application_id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        return None

    # Use project weights if available
    if application.project:
        quantitative_weight = Decimal(str(application.project.quantitative_weight or 70))
        qualitative_weight = Decimal(str(application.project.qualitative_weight or 30))

    auto_score = application.auto_score or Decimal('0')
    qual_avg = await calculate_qualitative_score_average(db, application_id)

    # Calculate weighted score
    # auto_score is already the raw score, we apply weight
    # qual_avg is 0-30 scale, we need to normalize based on weight
    quant_component = auto_score * quantitative_weight / Decimal('100')

    if qual_avg is not None:
        # qual_avg is 0-30 (sum of 3 items each 0-10)
        qual_component = qual_avg * qualitative_weight / Decimal('100')
    else:
        qual_component = Decimal('0')

    final_score = quant_component + qual_component

    # Update application
    application.final_score = final_score
    await db.flush()

    return final_score


async def finalize_project_scores(
    db: AsyncSession,
    project_id: int
) -> Dict[str, Any]:
    """
    Calculate final scores for all applications in a project

    Args:
        db: Database session
        project_id: Project ID

    Returns:
        Summary of finalization results
    """
    # Get project for weights
    project_result = await db.execute(
        select(Project).where(Project.project_id == project_id)
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Get all applications with evaluations
    result = await db.execute(
        select(Application)
        .where(Application.project_id == project_id)
        .where(Application.status.in_(['submitted', 'reviewing', 'completed']))
    )
    applications = result.scalars().all()

    finalized_count = 0
    no_evaluation_count = 0

    for app in applications:
        qual_avg = await calculate_qualitative_score_average(db, app.application_id)
        if qual_avg is not None:
            await calculate_final_score(
                db,
                app.application_id,
                Decimal(str(project.quantitative_weight or 70)),
                Decimal(str(project.qualitative_weight or 30))
            )
            finalized_count += 1
        else:
            # No qualitative evaluation yet
            no_evaluation_count += 1

    await db.commit()

    return {
        'project_id': project_id,
        'total_applications': len(applications),
        'finalized_count': finalized_count,
        'no_evaluation_count': no_evaluation_count
    }

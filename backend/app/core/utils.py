"""
Utility functions for the application
"""
import json
from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User


def get_user_roles(user: "User") -> List[str]:
    """
    사용자 역할을 안전하게 파싱합니다.

    Args:
        user: User 객체

    Returns:
        역할 문자열 리스트. 파싱 실패 시 빈 리스트 반환.
    """
    if not user or not user.roles:
        return []
    try:
        roles = json.loads(user.roles)
        return roles if isinstance(roles, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def has_role(user: "User", role: str) -> bool:
    """
    사용자가 특정 역할을 가지고 있는지 확인합니다.

    Args:
        user: User 객체
        role: 확인할 역할 문자열

    Returns:
        역할 보유 여부
    """
    return role in get_user_roles(user)


def has_any_role(user: "User", roles: List[str]) -> bool:
    """
    사용자가 주어진 역할 중 하나라도 가지고 있는지 확인합니다.

    Args:
        user: User 객체
        roles: 확인할 역할 문자열 리스트

    Returns:
        하나라도 보유 시 True
    """
    user_roles = get_user_roles(user)
    return any(role in user_roles for role in roles)

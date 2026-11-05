"""Общие проверки для запросов: кто вошёл и есть ли у него доступ к группе."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuthSession, Membership, User
from .security import token_hash

COOKIE = "starosta_session"


def current_user(db: Session = Depends(get_db), starosta_session: str | None = Cookie(default=None)) -> User:
    if not starosta_session:
        raise HTTPException(401, "Войдите в аккаунт")
    s = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(starosta_session)))
    if not s or _aware(s.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(401, "Сессия закончилась — войдите снова")
    user = db.get(User, s.user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "Аккаунт отключён")
    return user


def membership(db: Session, user: User, group_id: str, roles: tuple[str, ...] = ("head", "deputy", "viewer")) -> Membership:
    m = db.get(Membership, {"user_id": user.id, "group_id": group_id})
    if not m or m.role not in roles:
        raise HTTPException(403, "Нет доступа к этой группе")
    return m


def _aware(dt: datetime) -> datetime:
    """SQLite возвращает время без часового пояса — считаем его UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

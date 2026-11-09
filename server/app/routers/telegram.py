"""Снимки опросов доступны участникам привязанной облачной группы."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import current_user, membership, _aware
from ..models import TelegramPoll, User

router = APIRouter(prefix="/groups/{group_id}/telegram", tags=["Telegram"])


@router.get("/polls")
def polls(group_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id)
    configured = bool(settings.telegram_token and settings.telegram_chat_id < 0 and settings.telegram_group_id == group_id)
    if not configured:
        return {"configured": False, "items": []}
    rows = db.scalars(
        select(TelegramPoll).where(TelegramPoll.group_id == group_id, TelegramPoll.chat_id == settings.telegram_chat_id)
        .order_by(TelegramPoll.updated_at.desc()).limit(40)
    )
    return {"configured": True, "items": [
        {**row.snapshot, "id": row.poll_id, "updated_at": _aware(row.updated_at).isoformat()} for row in rows
    ]}

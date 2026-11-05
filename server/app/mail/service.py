"""Приём письма: разобрать → проверить, что оно от преподавателя группы → сохранить → предложить действие.

Сюда приходят письма из обоих источников: пересылка на адрес группы (inbound.py) и IMAP (imap.py).
Письма НЕ от преподавателей из списка группы не сохраняются вовсе — так мы не храним лишнего (152-ФЗ).
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Group, GroupData, InboxItem, MailMessage, MailSource
from .parse import is_forward_confirmation, match_teacher, parse_email, suggest

log = logging.getLogger("starosta.mail")


def ingest(db: Session, group: Group, raw: bytes, source: MailSource | None = None, today: date | None = None) -> InboxItem | None:
    m = parse_email(raw)
    gd = db.get(GroupData, group.id)
    teachers = (gd.data or {}).get("teachers", []) if gd else []
    confirm = is_forward_confirmation(m)
    teacher = match_teacher(m.from_addr, teachers)
    if not teacher and not confirm:
        log.info("Письмо от %s пропущено: не преподаватель группы %s", m.from_addr, group.id)
        return None
    msg_id = m.message_id or f"<no-id-{hash((m.from_addr, m.subject, m.sent_at))}>"
    if db.scalar(select(MailMessage.id).where(MailMessage.group_id == group.id, MailMessage.message_id == msg_id)):
        return None  # уже получали (письмо пришло и пересылкой, и через IMAP)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.mail_retention_days)
    row = MailMessage(group_id=group.id, source_id=source.id if source else None, message_id=msg_id[:300],
                      from_addr=m.from_addr, from_name=m.from_name[:200], teacher_id=(teacher or {}).get("id", ""),
                      subject=m.subject[:300], text=m.text[:20000], sent_at=m.sent_at or "",
                      attachments=[a.__dict__ for a in m.attachments], expires_at=expires)
    db.add(row)
    db.flush()
    # TODO (шаг 6): вложения — в хранилище (S3-совместимое в РФ), не больше attachment_max_mb, со сроком хранения
    item = InboxItem(group_id=group.id, message_id=row.id, suggestion=suggest(m, teachers, today or date.today()))
    db.add(item)
    db.commit()
    return item


def cleanup(db: Session) -> int:
    """Удалить письма с истёкшим сроком хранения (предложения удалятся каскадом)."""
    old = db.scalars(select(MailMessage).where(MailMessage.expires_at < datetime.now(timezone.utc))).all()
    for row in old:
        db.delete(row)
    db.commit()
    return len(old)

"""Почта группы: адрес пересылки, подключение ящика по IMAP, экран «Почта» (предложения от писем)."""
from __future__ import annotations

from datetime import datetime, timezone
from secrets import compare_digest

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..config import settings
from ..db import SessionLocal, get_db
from ..deps import current_user, membership
from ..mail.imap import HOSTS, connect
from ..mail.service import MAX_MESSAGE_BYTES, ingest
from ..models import AuditLog, Group, InboxItem, MailMessage, MailSource, User
from ..security import encrypt_secret

router = APIRouter(prefix="/groups/{group_id}", tags=["Почта"])
relay = APIRouter(tags=["Почтовый шлюз"])


def deliver_mail(code: str, raw: bytes) -> None:
    with SessionLocal() as db:
        group = db.scalar(select(Group).where(Group.mail_code == code.lower()))
        if not group:
            raise HTTPException(404, "Неизвестный адрес группы")
        source = db.scalar(select(MailSource).where(MailSource.group_id == group.id, MailSource.kind == "forward"))
        ingest(db, group, raw, source)


@relay.post("/integrations/mail/{code}", status_code=204)
async def receive_mail(code: str, request: Request) -> None:
    token = settings.mail_relay_token
    if len(token) < 32:
        raise HTTPException(404, "Почтовый шлюз не подключён")
    if not compare_digest(request.headers.get("x-starosta-mail-token", "").encode(), token.encode()):
        raise HTTPException(403, "Недоступно")
    if request.headers.get("content-type", "").split(";")[0].strip().lower() != "message/rfc822":
        raise HTTPException(415, "Ожидается исходное письмо в формате message/rfc822")
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > MAX_MESSAGE_BYTES:
            raise HTTPException(413, "Письмо слишком большое")
        raw.extend(chunk)
    if not raw:
        raise HTTPException(400, "Пустое письмо")
    await run_in_threadpool(deliver_mail, code, bytes(raw))


def source_out(s: MailSource, g: Group) -> dict:
    out = {"id": s.id, "kind": s.kind, "provider": s.provider, "status": s.status, "error": s.error,
           "last_checked_at": s.last_checked_at.isoformat() if s.last_checked_at else None}
    if s.kind == "forward":
        out["address"] = f"{g.mail_code}@{settings.mail_domain}"
        out["configured"] = len(settings.mail_relay_token) >= 32
    else:
        out["login"] = s.imap_login  # пароль/токен наружу не отдаём никогда
    return out


@router.get("/mail/sources")
def sources(group_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id)
    g = db.get(Group, group_id)
    return [source_out(s, g) for s in db.scalars(select(MailSource).where(MailSource.group_id == group_id))]


class ImapIn(BaseModel):
    provider: str = Field(pattern="^(yandex|mailru|gmail|other)$")
    login: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=500)  # пароль приложения, не основной пароль почты
    host: str = Field(default="", max_length=120)


@router.post("/mail/sources", status_code=201)
def add_imap(group_id: str, body: ImapIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id, ("head",))
    host = body.host.strip().lower() or HOSTS.get(body.provider, "")
    if not host:
        raise HTTPException(422, "Укажите IMAP-сервер почты")
    if body.provider != "other" and host != HOSTS[body.provider]:
        raise HTTPException(422, "Для выбранной почты нельзя менять IMAP-сервер")
    if body.provider == "other" and host not in HOSTS.values() and host not in {
        h.strip().lower() for h in settings.mail_imap_hosts.split(",") if h.strip()
    }:
        raise HTTPException(422, "Этот IMAP-сервер должен разрешить администратор сайта")
    s = MailSource(group_id=group_id, kind="imap", provider=body.provider, imap_host=host,
                   imap_login=body.login.strip(), secret_enc=encrypt_secret(body.password))
    try:
        box = connect(s)
        try:
            box.logout()
        except Exception:
            pass
    except Exception as exc:
        raise HTTPException(422, "Не удалось войти в почту. Проверьте адрес, пароль приложения и доступ по IMAP") from exc
    s.status = "ok"
    db.add(s)
    db.add(AuditLog(user_id=user.id, group_id=group_id, action="mail_connect", meta={"provider": body.provider}))
    db.commit()
    return source_out(s, db.get(Group, group_id))


@router.delete("/mail/sources/{source_id}", status_code=204)
def remove_source(group_id: str, source_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id, ("head",))
    s = db.get(MailSource, source_id)
    if not s or s.group_id != group_id or s.kind == "forward":
        raise HTTPException(404, "Не найдено")
    db.delete(s)  # вместе с зашифрованным паролем
    db.add(AuditLog(user_id=user.id, group_id=group_id, action="mail_disconnect"))
    db.commit()


@router.get("/inbox")
def inbox(group_id: str, status: str = "new", user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id)
    rows = db.execute(select(InboxItem, MailMessage).join(MailMessage, MailMessage.id == InboxItem.message_id)
                      .where(InboxItem.group_id == group_id, InboxItem.status == status)
                      .order_by(MailMessage.received_at.desc()).limit(100)).all()
    return [{"id": i.id, "status": i.status, "suggestion": i.suggestion, "result": i.result,
             "mail": {"from": m.from_name or m.from_addr, "from_addr": m.from_addr, "subject": m.subject, "text": m.text[:4000],
                      "sent_at": m.sent_at, "attachments": m.attachments}} for i, m in rows]


class DecideIn(BaseModel):
    # что староста сделал из письма в приложении: tasks / works / events / exams / overrides / none
    type: str = Field(default="none", max_length=20)
    id: str = Field(default="", max_length=40)


def _decide(db: Session, user: User, group_id: str, item_id: str, status: str, body: DecideIn) -> dict:
    membership(db, user, group_id, ("head", "deputy"))
    it = db.get(InboxItem, item_id)
    if not it or it.group_id != group_id:
        raise HTTPException(404, "Не найдено")
    if it.status != "new":
        if it.status == status and it.result == body.model_dump():
            return {"id": it.id, "status": it.status}
        raise HTTPException(409, "Письмо уже обработано на другом устройстве")
    it.status, it.result, it.decided_at, it.decided_by = status, body.model_dump(), datetime.now(timezone.utc), user.id
    db.commit()
    return {"id": it.id, "status": it.status}


@router.post("/inbox/{item_id}/accept")
def accept(group_id: str, item_id: str, body: DecideIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Сам объект (дело, сдачу…) создаёт приложение в данных группы; сюда — только отметка «сделано»."""
    return _decide(db, user, group_id, item_id, "accepted", body)


@router.post("/inbox/{item_id}/dismiss")
def dismiss(group_id: str, item_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _decide(db, user, group_id, item_id, "dismissed", DecideIn())

"""Группы, доступ замов и синхронизация данных группы между устройствами.

Синхронизация (этап 1): весь data.json группы целиком + номер версии rev.
  GET  /groups/{id}/data            → {rev, data}
  PUT  /groups/{id}/data {rev, data} → новый rev; если на сервере уже новее — 409 и свежие данные,
                                       приложение сливает изменения (server/design/sync.md) и пробует снова.
"""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import _aware, current_user, membership
from ..models import AuditLog, Group, GroupData, Invite, MailSource, Membership, User, now
from ..security import new_mail_code, token_hash

router = APIRouter(tags=["Группы и данные"])

MAX_DATA_BYTES = 5 * 1024 * 1024  # столько же примерно помещается в localStorage


def check_group_data(data: dict) -> None:
    try:
        size = len(json.dumps(data, ensure_ascii=False, allow_nan=False).encode())
    except ValueError as exc:
        raise HTTPException(422, "Некорректные данные группы") from exc
    if size > MAX_DATA_BYTES:
        raise HTTPException(413, "Объём данных группы превышает 5 МБ")
    for key in ("settings", "attendance", "overrides"):
        if key in data and not isinstance(data[key], dict):
            raise HTTPException(422, f"Некорректный раздел данных: {key}")
    for key in ("students", "teachers", "lessons", "oneoff", "tasks", "events", "works", "funds", "exams", "sick", "docs", "polls", "templates"):
        if key in data and (not isinstance(data[key], list) or any(not isinstance(item, dict) for item in data[key])):
            raise HTTPException(422, f"Некорректный список: {key}")
    if any(not isinstance(record, dict) or not isinstance(record.get("marks"), dict)
           for record in data.get("attendance", {}).values()):
        raise HTTPException(422, "Некорректные отметки в журнале")


class GroupIn(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    university: str = Field(default="", max_length=120)
    nntu_group: str = Field(default="", max_length=60)
    data: dict | None = None  # можно сразу перенести данные с устройства


def group_out(g: Group, role: str) -> dict:
    return {"id": g.id, "title": g.title, "university": g.university, "nntu_group": g.nntu_group, "role": role,
            "mail_address": f"{g.mail_code}@{settings.mail_domain}"}


@router.post("/groups", status_code=201)
def create_group(body: GroupIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    check_group_data(body.data or {})
    g = Group(title=body.title.strip(), university=body.university.strip() or "Не указан", nntu_group=body.nntu_group.strip(), mail_code=new_mail_code(body.title))
    db.add(g)
    db.flush()
    db.add(Membership(user_id=user.id, group_id=g.id, role="head"))
    db.add(GroupData(group_id=g.id, rev=1 if body.data else 0, data=body.data or {}, updated_by=user.id))
    db.add(MailSource(group_id=g.id, kind="forward", status="ok"))  # адрес пересылки есть у каждой группы сразу
    db.add(AuditLog(user_id=user.id, group_id=g.id, action="group_create"))
    db.commit()
    return group_out(g, "head")


@router.get("/groups")
def my_groups(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Group, Membership.role).join(Membership, Membership.group_id == Group.id).where(Membership.user_id == user.id)).all()
    return [group_out(g, role) for g, role in rows]


@router.get("/groups/{group_id}/data")
def get_data(group_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id)
    gd = db.get(GroupData, group_id)
    if gd is None:
        raise HTTPException(404, "Данные группы не найдены")
    return {"rev": gd.rev, "data": gd.data, "updated_at": gd.updated_at.isoformat()}


class DataIn(BaseModel):
    rev: int = Field(ge=0, le=2**53 - 2)  # следующая версия должна точно читаться в JavaScript
    data: dict


@router.put("/groups/{group_id}/data")
def put_data(group_id: str, body: DataIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id, ("head", "deputy"))
    check_group_data(body.data)
    result = db.execute(
        update(GroupData)
        .where(GroupData.group_id == group_id, GroupData.rev == body.rev)
        .values(data=body.data, rev=body.rev + 1, updated_at=now(), updated_by=user.id)
    )
    if result.rowcount == 1:
        db.commit()
        return {"rev": body.rev + 1}
    db.rollback()
    gd = db.get(GroupData, group_id)
    if gd is None:
        raise HTTPException(404, "Данные группы не найдены")
    raise HTTPException(409, {"message": "Данные изменились на другом устройстве", "rev": gd.rev, "data": gd.data})


class InviteIn(BaseModel):
    role: str = Field(default="deputy", pattern="^(deputy|viewer)$")


@router.post("/groups/{group_id}/invites", status_code=201)
def create_invite(group_id: str, body: InviteIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership(db, user, group_id, ("head",))
    code = "-".join(secrets.token_hex(2).upper() for _ in range(3))  # «A1B2-C3D4-E5F6» — удобно продиктовать
    db.add(Invite(group_id=group_id, code_hash=token_hash(code), role=body.role, expires_at=datetime.now(timezone.utc) + timedelta(days=3)))
    db.add(AuditLog(user_id=user.id, group_id=group_id, action="invite_create", meta={"role": body.role}))
    db.commit()
    return {"code": code, "expires_in_days": 3}


class AcceptIn(BaseModel):
    code: str


@router.post("/invites/accept")
def accept_invite(body: AcceptIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    inv = db.scalar(select(Invite).where(Invite.code_hash == token_hash(body.code.strip().upper())))
    if not inv or inv.used_by or _aware(inv.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(400, "Код не подошёл или устарел — попросите у старосты новый")
    if not db.get(Membership, {"user_id": user.id, "group_id": inv.group_id}):
        db.add(Membership(user_id=user.id, group_id=inv.group_id, role=inv.role))
    inv.used_by = user.id
    db.add(AuditLog(user_id=user.id, group_id=inv.group_id, action="invite_accept"))
    db.commit()
    return group_out(db.get(Group, inv.group_id), inv.role)

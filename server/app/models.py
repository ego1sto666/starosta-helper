"""Таблицы сервера.

Главная идея: данные группы (студенты, расписание, журнал…) — тот же JSON, что сейчас лежит
в браузере (localStorage, ключ starosta.data). На первом этапе сервер хранит его целиком
(GroupData) и только синхронизирует между устройствами. Отдельными таблицами — то, что
приложение в браузере сделать не может: аккаунты, доступы, почта.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def uid() -> str:
    return uuid.uuid4().hex


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Аккаунт старосты (позже — зама и студентов)."""
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    login: Mapped[str] = mapped_column(String(32), unique=True, index=True)       # латиница, в нижнем регистре
    email: Mapped[str | None] = mapped_column(String(254), unique=True, index=True)  # для восстановления пароля
    name: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)  # согласие на обработку данных
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuthSession(Base):
    """Вход с устройства. В cookie — случайный токен, в базе — только его хеш."""
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_agent: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PasswordReset(Base):
    __tablename__ = "password_resets"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Group(Base):
    """Учебная группа. Код mail_code — адрес пересылки писем: <mail_code>@<домен>."""
    __tablename__ = "groups"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(60))                  # «26-ИВТ-2-1»
    university: Mapped[str] = mapped_column(String(120), default="Не указан")
    nntu_group: Mapped[str] = mapped_column(String(60), default="")  # как группа называется в расписании НГТУ
    mail_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Membership(Base):
    """Кто в группе и с какими правами: head — староста, deputy — зам, viewer — только смотреть."""
    __tablename__ = "memberships"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(10), default="head")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Invite(Base):
    """Приглашение в группу (заму): одноразовый код со сроком."""
    __tablename__ = "invites"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True)
    role: Mapped[str] = mapped_column(String(10), default="deputy")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class GroupData(Base):
    """Весь data.json группы + номер версии (rev): кто сохраняет со старой версией — получает 409 и сливает."""
    __tablename__ = "group_data"
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    rev: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class MailSource(Base):
    """Откуда берём письма: forward — пересылка на адрес группы, imap — чтение ящика старосты."""
    __tablename__ = "mail_sources"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))                     # forward | imap
    provider: Mapped[str] = mapped_column(String(20), default="")    # yandex | mailru | gmail | other
    imap_host: Mapped[str] = mapped_column(String(120), default="")
    imap_login: Mapped[str] = mapped_column(String(254), default="")
    secret_enc: Mapped[str] = mapped_column(Text, default="")        # пароль приложения или OAuth-токен, зашифрован
    last_uid: Mapped[int] = mapped_column(Integer, default=0)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="new")   # new | ok | error | paused
    error: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MailMessage(Base):
    """Письмо преподавателя. Хранится mail_retention_days, потом удаляется (worker.cleanup)."""
    __tablename__ = "mail_messages"
    __table_args__ = (UniqueConstraint("group_id", "message_id"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str | None] = mapped_column(ForeignKey("mail_sources.id", ondelete="SET NULL"))
    message_id: Mapped[str] = mapped_column(String(300))
    from_addr: Mapped[str] = mapped_column(String(254))
    from_name: Mapped[str] = mapped_column(String(200), default="")
    teacher_id: Mapped[str] = mapped_column(String(32), default="")  # id преподавателя из data.json группы
    subject: Mapped[str] = mapped_column(String(300), default="")
    text: Mapped[str] = mapped_column(Text, default="")
    attachments: Mapped[list] = mapped_column(JSON, default=list)   # [{name, mime, size, key}]
    sent_at: Mapped[str] = mapped_column(String(40), default="")
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class InboxItem(Base):
    """Предложение на экране «Почта»: «сделать делом / сдачей / событием». Решает староста."""
    __tablename__ = "inbox_items"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    message_id: Mapped[str] = mapped_column(ForeignKey("mail_messages.id", ondelete="CASCADE"), index=True)
    suggestion: Mapped[dict] = mapped_column(JSON, default=dict)   # результат mail.parse.suggest
    status: Mapped[str] = mapped_column(String(10), default="new")  # new | accepted | dismissed
    result: Mapped[dict] = mapped_column(JSON, default=dict)       # что создали: {"type": "works", "id": "…"}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class AuditLog(Base):
    """Журнал важных действий: вход, подключение почты, приглашения, удаление данных."""
    __tablename__ = "audit_log"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    group_id: Mapped[str | None] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(40))
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

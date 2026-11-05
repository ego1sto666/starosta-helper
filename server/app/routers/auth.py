"""Аккаунты: регистрация, вход по логину (или почте) и паролю, выход, восстановление пароля.

Вход хранится в cookie (httpOnly — недоступна скриптам страницы, SameSite=Lax), а не в localStorage:
так токен не украсть через XSS. Подробности и решения — server/design/auth.md.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import COOKIE, _aware, current_user
from ..models import AuditLog, AuthSession, Membership, PasswordReset, User
from ..security import hash_password, login_error, new_token, normalize_login, password_error, token_hash, verify_password

router = APIRouter(prefix="/auth", tags=["Аккаунт"])
log = logging.getLogger("starosta.auth")

# защита от подбора пароля: не больше 10 попыток за 15 минут на логин и на IP (на сервере — в Redis)
_tries: dict[str, list[float]] = defaultdict(list)


def _limited(key: str, limit: int = 10, window: int = 900) -> bool:
    t = time.time()
    _tries[key] = [x for x in _tries[key] if t - x < window]
    _tries[key].append(t)
    return len(_tries[key]) > limit


class RegisterIn(BaseModel):
    login: str = Field(min_length=3, max_length=32)
    email: EmailStr
    name: str = Field(default="", max_length=120)
    password: str = Field(min_length=8, max_length=200)
    consent: bool  # согласие на обработку персональных данных — без него аккаунт не создаём


class LoginIn(BaseModel):
    login: str = Field(max_length=254)  # логин или почта
    password: str = Field(max_length=200)


class UserOut(BaseModel):
    id: str
    login: str
    email: str | None
    name: str
    groups: list[dict] = []


def _me(db: Session, u: User) -> UserOut:
    rows = db.execute(select(Membership).where(Membership.user_id == u.id)).scalars().all()
    return UserOut(id=u.id, login=u.login, email=u.email, name=u.name, groups=[{"id": m.group_id, "role": m.role} for m in rows])


def _start_session(db: Session, resp: Response, user: User, request: Request) -> None:
    raw, h = new_token()
    db.add(AuthSession(user_id=user.id, token_hash=h, user_agent=(request.headers.get("user-agent") or "")[:300],
                       expires_at=datetime.now(timezone.utc) + timedelta(days=settings.session_days)))
    resp.set_cookie(COOKIE, raw, max_age=settings.session_days * 86400, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/")


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, request: Request, resp: Response, db: Session = Depends(get_db)):
    if not body.consent:
        raise HTTPException(422, "Нужно согласие на обработку персональных данных")
    login = normalize_login(body.login)
    if err := login_error(login) or password_error(body.password, login):
        raise HTTPException(422, err)
    if db.scalar(select(User).where(or_(User.login == login, User.email == body.email.lower()))):
        raise HTTPException(409, "Такой логин или почта уже заняты")
    user = User(login=login, email=body.email.lower(), name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    db.add(AuditLog(user_id=user.id, action="register"))
    _start_session(db, resp, user, request)
    db.commit()
    return _me(db, user)


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, resp: Response, db: Session = Depends(get_db)):
    who = normalize_login(body.login)
    ip = request.client.host if request.client else "?"
    if _limited("login:" + who) or _limited("ip:" + ip, 50):
        raise HTTPException(429, "Слишком много попыток. Подождите 15 минут")
    user = db.scalar(select(User).where(or_(User.login == who, User.email == who)))
    # одинаковый ответ для «нет такого» и «не тот пароль» — чтобы нельзя было перебирать логины
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")
    _start_session(db, resp, user, request)
    db.add(AuditLog(user_id=user.id, action="login", meta={"ip": ip}))
    db.commit()
    return _me(db, user)


@router.post("/logout", status_code=204)
def logout(request: Request, resp: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(COOKIE)
    if raw:
        s = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(raw)))
        if s:
            db.delete(s)
            db.commit()
    resp.delete_cookie(COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _me(db, user)


class ForgotIn(BaseModel):
    email: EmailStr


@router.post("/password/forgot", status_code=202)
def forgot(body: ForgotIn, db: Session = Depends(get_db)):
    """Письмо со ссылкой сброса. Ответ всегда одинаковый — не выдаём, есть ли такая почта."""
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user and not _limited("forgot:" + user.id, 3, 3600):
        raw, h = new_token()
        db.add(PasswordReset(user_id=user.id, token_hash=h, expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
        db.commit()
        # TODO (шаг 3 в ROADMAP.md): отправить письмо через SMTP-сервис в РФ. Пока — в журнал сервера.
        log.info("Ссылка сброса пароля для %s: %s/#reset/%s", user.login, settings.app_origin, raw)
    return {"ok": True}


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=200)


@router.post("/password/reset", status_code=204)
def reset(body: ResetIn, db: Session = Depends(get_db)):
    r = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == token_hash(body.token)))
    if not r or r.used_at or _aware(r.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(400, "Ссылка устарела — запросите новую")
    user = db.get(User, r.user_id)
    if err := password_error(body.password, user.login):
        raise HTTPException(422, err)
    user.password_hash = hash_password(body.password)
    r.used_at = datetime.now(timezone.utc)
    # после смены пароля выходим на всех устройствах
    for s in db.scalars(select(AuthSession).where(AuthSession.user_id == user.id)):
        db.delete(s)
    db.add(AuditLog(user_id=user.id, action="password_reset"))
    db.commit()

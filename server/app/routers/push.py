"""Подписка текущего браузера и пробная доставка Web Push."""
from __future__ import annotations

import base64
import hashlib
import json
import re
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pywebpush import WebPushException, webpush
from sqlalchemy import or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import PushDevice, User, now

router = APIRouter(prefix="/push", tags=["Уведомления"])
HOSTS = {"fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"}
SUFFIXES = (".push.apple.com", ".notify.windows.com")


class EndpointIn(BaseModel):
    endpoint: str = Field(max_length=2048)


class PushKeys(BaseModel):
    p256dh: str = Field(max_length=90)
    auth: str = Field(max_length=24)


class SubscriptionIn(EndpointIn):
    keys: PushKeys


def allowed_endpoint(endpoint: str) -> bool:
    if not endpoint.isascii() or re.search(r"[\x00-\x20\x7f\\]", endpoint):
        return False
    try:
        url = urlsplit(endpoint)
        host = url.hostname or ""
        return (url.scheme == "https" and not url.username and not url.password and "@" not in url.netloc
                and url.port in (None, 443) and bool(url.path.strip("/")) and not url.fragment
                and (host in HOSTS or host.endswith(SUFFIXES)))
    except ValueError:
        return False


def decode_key(value: str) -> bytes:
    if not re.fullmatch(r"[A-Za-z0-9_-]+={0,2}", value):
        raise ValueError("Некорректный ключ")
    return base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)


def configured() -> bool:
    if not (settings.push_public_key and settings.push_private_key_file
            and settings.push_subject.startswith(("mailto:", "https://"))):
        return False
    try:
        private = serialization.load_pem_private_key(Path(settings.push_private_key_file).read_bytes(), password=None)
        return (isinstance(private, ec.EllipticCurvePrivateKey) and isinstance(private.curve, ec.SECP256R1)
                and private.public_key().public_bytes(serialization.Encoding.X962,
                                                       serialization.PublicFormat.UncompressedPoint)
                == decode_key(settings.push_public_key))
    except (OSError, ValueError, TypeError):
        return False


def device_id(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()


class NoRedirectSession(requests.Session):
    def request(self, *args, **kwargs):
        kwargs["allow_redirects"] = False
        return super().request(*args, **kwargs)


def send_test(subscription: dict) -> int:
    with NoRedirectSession() as session:
        try:
            response = webpush(
                subscription, data=json.dumps({"kind": "test"}), ttl=60, timeout=8,
                vapid_private_key=settings.push_private_key_file, vapid_claims={"sub": settings.push_subject},
                requests_session=session,
            )
            return response.status_code
        except WebPushException as error:
            return error.response.status_code if error.response is not None else 502
        except (OSError, ValueError, requests.RequestException):
            return 502


@router.get("/config")
def config(_user: User = Depends(current_user)):
    return {"public_key": settings.push_public_key if configured() else None}


@router.put("/device", status_code=204)
def save(body: SubscriptionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not configured():
        raise HTTPException(503, "Пуш-уведомления ещё не настроены")
    try:
        key = decode_key(body.keys.p256dh)
        if len(key) != 65 or len(decode_key(body.keys.auth)) != 16 or not allowed_endpoint(body.endpoint):
            raise ValueError("Некорректная подписка")
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), key)
    except ValueError as error:
        raise HTTPException(422, "Браузер вернул неподдерживаемую подписку") from error
    id_ = device_id(body.endpoint)
    row = db.get(PushDevice, id_)
    if row and row.user_id != user.id:
        raise HTTPException(409, "Подписка браузера принадлежит другому аккаунту. Отключите её и включите заново.")
    if not row:
        row = PushDevice(id=id_, user_id=user.id, subscription=body.model_dump())
        db.add(row)
    else:
        row.subscription = body.model_dump()
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Подписка изменилась. Повторите действие.") from error


@router.post("/device/status")
def status(body: EndpointIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(PushDevice, device_id(body.endpoint))
    return {"active": bool(row and row.user_id == user.id)}


@router.post("/device/remove", status_code=204)
def remove(body: EndpointIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(PushDevice, device_id(body.endpoint))
    if row and row.user_id == user.id:
        db.delete(row)
        db.commit()


@router.post("/test", status_code=204)
def test_delivery(body: EndpointIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not configured():
        raise HTTPException(503, "Пуш-уведомления ещё не настроены")
    row = db.get(PushDevice, device_id(body.endpoint))
    if not row or row.user_id != user.id or not allowed_endpoint(row.subscription["endpoint"]):
        raise HTTPException(404, "Сначала включите пуши на этом устройстве")
    timestamp = now()
    changed = db.execute(update(PushDevice).where(
        PushDevice.id == row.id,
        or_(PushDevice.last_test_at.is_(None), PushDevice.last_test_at <= timestamp - timedelta(seconds=30)),
    ).values(last_test_at=timestamp).execution_options(synchronize_session=False))
    if not changed.rowcount:
        raise HTTPException(429, "Повторить проверку можно через 30 секунд")
    db.commit()
    code = send_test(row.subscription)
    if code in (404, 410):
        db.delete(row)
        db.commit()
        raise HTTPException(410, "Подписка устарела. Отключите и включите пуши снова.")
    if not 200 <= code < 300:
        raise HTTPException(502, "Сервис уведомлений не принял проверку. Попробуйте позже.")

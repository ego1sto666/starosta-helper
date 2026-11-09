"""Чтение общего ящика по IMAP. Тела писем загружаются только для известных преподавателей."""
from __future__ import annotations

import imaplib
import logging
import ssl
from datetime import datetime, timezone
from email.parser import BytesHeaderParser
from email.utils import parseaddr

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Group, GroupData, MailCursor, MailSource
from ..security import decrypt_secret
from .parse import match_teacher
from .service import MAX_MESSAGE_BYTES, ingest

log = logging.getLogger("starosta.imap")

HOSTS = {"yandex": "imap.yandex.ru", "mailru": "imap.mail.ru", "gmail": "imap.gmail.com"}


def connect(src: MailSource) -> imaplib.IMAP4_SSL:
    host = src.imap_host or HOSTS.get(src.provider, "")
    allowed = {h.strip().lower() for h in settings.mail_imap_hosts.split(",") if h.strip()}
    if host not in HOSTS.values() and host not in allowed:
        raise ValueError("IMAP-сервер не разрешён")
    secret = decrypt_secret(src.secret_enc)
    box = imaplib.IMAP4_SSL(host, 993, ssl_context=ssl.create_default_context(), timeout=30)
    try:
        if secret.startswith("oauth:"):
            token = secret[6:]
            box.authenticate("XOAUTH2", lambda _: f"user={src.imap_login}\x01auth=Bearer {token}\x01\x01".encode())
        else:
            box.login(src.imap_login, secret)
    except Exception:
        box.shutdown()
        raise
    return box


def fetch_part(box, uid: int, part: str) -> bytes | None:
    status, data = box.uid("FETCH", str(uid), part)
    if status != "OK":
        raise imaplib.IMAP4.error("FETCH")
    # Если письмо удалили между SEARCH и FETCH, сервер возвращает OK без тела.
    return next((chunk[1] for chunk in data if isinstance(chunk, tuple)), None)


def poll(db: Session, src: MailSource) -> int:
    """Забрать новые письма преподавателей из одного ящика. Возвращает число новых предложений."""
    gd = db.get(GroupData, src.group_id)
    teachers = (gd.data or {}).get("teachers", []) if gd else []
    if not isinstance(teachers, list) or not any(isinstance(t, dict) and t.get("email") for t in teachers):
        return 0
    group = db.get(Group, src.group_id)
    added = 0
    box = None
    try:
        box = connect(src)
        status, _ = box.select("INBOX", readonly=True)
        if status != "OK":
            raise imaplib.IMAP4.error("SELECT")
        _, values = box.response("UIDVALIDITY")
        uidvalidity = int(values[0] or b"0") if values else 0
        if not uidvalidity:
            raise imaplib.IMAP4.error("UIDVALIDITY")
        cursor = db.get(MailCursor, src.id)
        if not cursor:
            cursor = MailCursor(source_id=src.id, uidvalidity=uidvalidity, last_uid=0)
            db.add(cursor)
        elif cursor.uidvalidity != uidvalidity:
            cursor.uidvalidity, cursor.last_uid = uidvalidity, 0
        status, data = box.uid("SEARCH", None, f"UID {cursor.last_uid + 1}:*")
        if status != "OK":
            raise imaplib.IMAP4.error("SEARCH")
        uids = sorted({int(uid) for uid in (data[0] or b"").split()}) if data else []
        for uid in [n for n in uids if n > cursor.last_uid][:100]:
            header = fetch_part(box, uid, "(BODY.PEEK[HEADER.FIELDS (FROM)])")
            if header and match_teacher(parseaddr(BytesHeaderParser().parsebytes(header).get("From", ""))[1], teachers):
                raw = fetch_part(box, uid, f"(BODY.PEEK[]<0.{MAX_MESSAGE_BYTES + 1}>)")
                if raw and len(raw) <= MAX_MESSAGE_BYTES and ingest(db, group, raw, src):
                    added += 1
            cursor.last_uid = uid
        src.status, src.error = "ok", ""
    except (imaplib.IMAP4.error, OSError, ValueError) as e:
        src.status, src.error = "error", "Не удалось проверить ящик. Проверьте подключение и пароль приложения."
        log.warning("IMAP %s: %s", src.id, type(e).__name__)
    finally:
        if box:
            try:
                box.logout()
            except (imaplib.IMAP4.error, OSError):
                pass
    src.last_checked_at = datetime.now(timezone.utc)
    db.commit()
    return added

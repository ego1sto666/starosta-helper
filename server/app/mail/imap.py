"""Способ 2 — чтение ящика по IMAP (только чтение). Набросок, ещё не запускался.

  Яндекс   — вход через Яндекс ID (OAuth, право mail:imap_ro), пароль не нужен;
             или пароль приложения (id.yandex.ru → Безопасность → Пароли приложений).
  Mail.ru  — пароль для внешнего приложения (Настройки → Безопасность).
  Gmail    — пароль приложения (нужна двухэтапная проверка). Gmail API не используем:
             доступ к письмам у Google — «restricted scope», для публичного сервиса нужна платная проверка.

Читаем только письма ОТ преподавателей группы: IMAP-поиск FROM по их адресам, начиная с последнего UID.
"""
from __future__ import annotations

import imaplib
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import Group, GroupData, MailSource
from ..security import decrypt_secret
from .service import ingest

log = logging.getLogger("starosta.imap")

HOSTS = {"yandex": "imap.yandex.ru", "mailru": "imap.mail.ru", "gmail": "imap.gmail.com"}


def connect(src: MailSource) -> imaplib.IMAP4_SSL:
    box = imaplib.IMAP4_SSL(src.imap_host or HOSTS.get(src.provider, ""), 993, timeout=30)
    secret = decrypt_secret(src.secret_enc)
    if secret.startswith("oauth:"):  # токен Яндекс ID
        token = secret[6:]
        box.authenticate("XOAUTH2", lambda _: f"user={src.imap_login}\x01auth=Bearer {token}\x01\x01".encode())
    else:
        box.login(src.imap_login, secret)
    return box


def teacher_emails(db: Session, group_id: str) -> list[str]:
    gd = db.get(GroupData, group_id)
    out = []
    for t in (gd.data or {}).get("teachers", []) if gd else []:
        out += [a for a in (t.get("email") or "").replace(";", " ").replace(",", " ").split() if "@" in a]
    return out


def poll(db: Session, src: MailSource) -> int:
    """Забрать новые письма преподавателей из одного ящика. Возвращает число новых предложений."""
    emails = teacher_emails(db, src.group_id)
    if not emails:
        return 0
    group = db.get(Group, src.group_id)
    added = 0
    try:
        box = connect(src)
        box.select("INBOX", readonly=True)
        # (OR FROM a FROM b …) UID n:*  — только письма от преподавателей, только новые
        crit = f'FROM "{emails[0]}"'
        for e in emails[1:]:
            crit = f'OR {crit} FROM "{e}"'
        typ, data = box.uid("SEARCH", None, f"UID {src.last_uid + 1}:*", f"({crit})")
        for uid in (data[0].split() if typ == "OK" and data and data[0] else []):
            n = int(uid)
            if n <= src.last_uid:
                continue
            typ, msg = box.uid("FETCH", uid, "(BODY.PEEK[])")  # PEEK — не помечать прочитанным
            if typ == "OK" and msg and isinstance(msg[0], tuple):
                if ingest(db, group, msg[0][1], src):
                    added += 1
            src.last_uid = max(src.last_uid, n)
        box.logout()
        src.status, src.error = "ok", ""
    except (imaplib.IMAP4.error, OSError) as e:
        src.status, src.error = "error", str(e)[:300]
        log.warning("IMAP %s: %s", src.id, e)
    src.last_checked_at = datetime.now(timezone.utc)
    db.commit()
    return added

"""Закрытый SMTP-приёмник для доверенного почтового шлюза. Не используется как публичный MX."""
from __future__ import annotations

import logging
from threading import Event

from sqlalchemy import select

from ..config import settings
from ..db import SessionLocal, init_db
from ..models import Group, MailSource
from .service import MAX_MESSAGE_BYTES, ingest

log = logging.getLogger("starosta.inbound")


class Handler:
    async def handle_RCPT(self, server, session, envelope, address: str, rcpt_options):
        local, _, domain = address.lower().partition("@")
        if domain != settings.mail_domain:
            return "550 Не наш домен"
        with SessionLocal() as db:
            if not db.scalar(select(Group.id).where(Group.mail_code == local)):
                return "550 Нет такого адреса"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        if len(envelope.content) > MAX_MESSAGE_BYTES:
            return "552 Письмо слишком большое"
        with SessionLocal() as db:
            for rcpt in envelope.rcpt_tos:
                g = db.scalar(select(Group).where(Group.mail_code == rcpt.split("@")[0].lower()))
                if g:
                    src = db.scalar(select(MailSource).where(MailSource.group_id == g.id, MailSource.kind == "forward"))
                    ingest(db, g, envelope.content, src)
        return "250 Принято"


def main(host: str = "0.0.0.0", port: int = 2525) -> None:
    from aiosmtpd.controller import Controller  # pip install aiosmtpd

    init_db()
    controller = Controller(Handler(), hostname=host, port=port, data_size_limit=MAX_MESSAGE_BYTES)
    controller.start()
    log.info("Приём писем на %s:%s для @%s", host, port, settings.mail_domain)
    try:
        Event().wait()
    finally:
        controller.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()

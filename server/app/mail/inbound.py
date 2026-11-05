"""Способ 1 — пересылка (рекомендуемый для старта). Набросок, ещё не запускался на сервере.

У каждой группы есть адрес вида  26-ivt-2-1-a3f9c1@in.<домен>.  Староста в своей почте
(Яндекс, Mail.ru, Gmail…) создаёт правило: «письма от преподавателей → переслать на этот адрес».
Пароль от почты нам не нужен вовсе, а приходят только письма, которые староста сам выбрал.

Здесь — маленький SMTP-сервер (библиотека aiosmtpd). На домене нужна MX-запись на этот сервер,
порт 25 открыт у хостера. Запуск:  python -m app.mail.inbound
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from ..config import settings
from ..db import SessionLocal
from ..models import Group, MailSource
from .service import ingest

log = logging.getLogger("starosta.inbound")
MAX_BYTES = 15 * 1024 * 1024


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
        if len(envelope.content) > MAX_BYTES:
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

    controller = Controller(Handler(), hostname=host, port=port, data_size_limit=MAX_BYTES)
    controller.start()
    log.info("Приём писем на %s:%s для @%s", host, port, settings.mail_domain)
    try:
        asyncio.get_event_loop().run_forever()
    finally:
        controller.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()

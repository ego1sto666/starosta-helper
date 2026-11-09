"""Фоновый процесс: раз в несколько минут проверяет почтовые ящики (IMAP) и чистит старые письма.

Запуск рядом с API:  python -m app.worker   (в docker-compose — отдельный сервис worker)
Сборщик Telegram работает отдельным процессом, чтобы долгий опрос не задерживал почту.
"""
from __future__ import annotations

import logging
import time

from sqlalchemy import select

from .config import settings
from .db import SessionLocal, init_db
from .mail.imap import poll
from .mail.service import cleanup
from .models import MailSource

log = logging.getLogger("starosta.worker")


def tick() -> None:
    with SessionLocal() as db:
        for src in db.scalars(select(MailSource).where(MailSource.kind == "imap", MailSource.status != "paused")).all():
            source_id = src.id
            try:
                n = poll(db, src)
            except Exception as error:
                db.rollback()
                log.warning("Ошибка проверки источника %s: %s", source_id, type(error).__name__)
                continue
            if n:
                log.info("Группа %s: новых писем %s", src.group_id, n)
        removed = cleanup(db)
        if removed:
            log.info("Удалено писем со сроком хранения: %s", removed)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    init_db()
    while True:
        try:
            tick()
        except Exception:  # один сбой не должен останавливать всю проверку
            log.exception("Сбой проверки почты")
        time.sleep(settings.imap_poll_minutes * 60)


if __name__ == "__main__":
    main()

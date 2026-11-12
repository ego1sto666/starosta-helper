"""Сбор снимков опросов из одного настроенного чата. Запуск: python -m app.telegram."""
from __future__ import annotations

import argparse
import logging
import re
import time
from datetime import timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal, init_db
from .deps import _aware
from .models import Group, TelegramPoll, now

log = logging.getLogger("starosta.telegram")
UPDATES = ["message", "edited_message", "poll"]


def record_update(db: Session, group_id: str, chat_id: int, update: dict) -> bool:
    message = update.get("message") or update.get("edited_message")
    if message:
        chat = message.get("chat") or {}
        if chat.get("id") != chat_id or chat.get("type") not in ("group", "supergroup"):
            return False
        poll = message.get("poll")
        message_id = message.get("message_id")
        if type(message_id) is not int or message_id <= 0:
            return False
    else:
        poll, message_id = update.get("poll"), None
    if not isinstance(poll, dict):
        return False
    poll_id, question, options = poll.get("id"), poll.get("question"), poll.get("options")
    if not isinstance(poll_id, str) or not 0 < len(poll_id) <= 128 or not isinstance(question, str):
        return False
    if not isinstance(options, list) or not 2 <= len(options) <= 12:
        return False
    if not all(isinstance(o, dict) and isinstance(o.get("text"), str) for o in options):
        return False

    def count(value):
        return value if type(value) is int and 0 <= value <= 2**31 - 1 else 0

    key = (group_id, chat_id, poll_id)
    row = db.get(TelegramPoll, key)
    update_id = update.get("update_id")
    if type(update_id) is not int or (row is None and message_id is None):
        return False
    checked_at = now()
    # После недели без событий Telegram может начать новую последовательность ID.
    if row and update_id <= row.last_update_id and checked_at - _aware(row.updated_at) < timedelta(days=7):
        return False
    snapshot = {
        "question": question[:300],
        "options": [{"text": o["text"][:100], "votes": count(o.get("voter_count"))} for o in options],
        "total": count(poll.get("total_voter_count")),
        "closed": poll.get("is_closed") is True,
        "anonymous": poll.get("is_anonymous") is True,
    }
    if row is None:
        row = TelegramPoll(group_id=group_id, chat_id=chat_id, poll_id=poll_id, message_id=message_id)
        db.add(row)
    elif row.snapshot["closed"] and not snapshot["closed"]:
        return False
    row.snapshot, row.last_update_id, row.updated_at = snapshot, update_id, checked_at
    db.flush()
    return True


class TelegramError(Exception):
    def __init__(self, status: int, retry_after: int = 5):
        self.status = status
        self.retry_after = retry_after


def get_updates(client: httpx.Client, token: str, offset: int | None, *, timeout: int = 25) -> list[dict]:
    params = {"timeout": timeout, "allowed_updates": UPDATES}
    if offset is not None:
        params["offset"] = offset
    response = client.post(f"https://api.telegram.org/bot{token}/getUpdates", json=params)
    body = response.json()
    if not isinstance(body, dict) or body.get("ok") is not True or not isinstance(body.get("result"), list):
        retry = (body.get("parameters") or {}).get("retry_after", 5) if isinstance(body, dict) else 5
        raise TelegramError(response.status_code, max(1, min(300, retry)) if type(retry) is int else 5)
    return body["result"]


def setup_chat_ids(updates: list[dict]) -> list[int]:
    ids = set()
    for update in updates:
        message = update.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if (message.get("text") == "/starosta_id" and chat.get("type") in ("group", "supergroup")
                and type(chat_id) is int and chat_id < 0):
            ids.add(chat_id)
    return sorted(ids)


def main() -> None:
    parser = argparse.ArgumentParser(description="Сбор опросов Telegram")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--chat-id", action="store_true", help="Найти чат по сообщению /starosta_id")
    mode.add_argument("--list-groups", action="store_true", help="Показать группы на этом сервере")
    args = parser.parse_args()
    if args.list_groups:
        init_db()
        with SessionLocal() as db:
            for group in db.scalars(select(Group).order_by(Group.title, Group.id)):
                print(f"{group.title} · {group.university} · {group.id}")
        return

    token, group_id, chat_id = settings.telegram_token, settings.telegram_group_id, settings.telegram_chat_id
    if not re.fullmatch(r"\d+:[A-Za-z0-9_-]+", token):
        raise SystemExit("Укажите токен BotFather в STAROSTA_TELEGRAM_TOKEN в .env")
    logging.basicConfig(level=logging.INFO)
    # URL Bot API содержит токен. Не записываем запросы клиента или тела обновлений в журнал.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if args.chat_id:
        try:
            with httpx.Client(timeout=35, follow_redirects=False) as client:
                ids = setup_chat_ids(get_updates(client, token, None))
        except TelegramError as error:
            raise SystemExit(f"Telegram вернул HTTP {error.status}. Проверьте токен и остановите другие запуски бота.") from None
        except (httpx.HTTPError, ValueError):
            raise SystemExit("Не удалось получить обновления Telegram. Проверьте доступ к api.telegram.org.") from None
        if not ids:
            raise SystemExit("Не найдено сообщение /starosta_id. Отправьте его в группу с ботом и проверьте Privacy Mode.")
        for id_ in ids:
            print(f"STAROSTA_TELEGRAM_CHAT_ID={id_}")
        return
    if not group_id or chat_id >= 0:
        raise SystemExit("Укажите ID облачной группы и отрицательный ID чата Telegram в .env")
    init_db()
    with SessionLocal() as db:
        if not db.get(Group, group_id):
            raise SystemExit("Облачная группа из .env не найдена")
    offset = None
    with httpx.Client(timeout=35, follow_redirects=False) as client:
        while True:
            try:
                batch = get_updates(client, token, offset)
                if not batch:
                    # Не отправляем старый offset после подтверждения пустой очереди.
                    offset = None
                    continue
                updates = sorted(batch, key=lambda item: item["update_id"])
                with SessionLocal.begin() as db:
                    for update in updates:
                        record_update(db, group_id, chat_id, update)
                offset = updates[-1]["update_id"] + 1
            except TelegramError as error:
                log.warning("Telegram Bot API: HTTP %s", error.status)
                if error.status in (401, 403, 404, 409):
                    raise SystemExit("Проверьте токен, вебхук и наличие другого процесса бота") from None
                time.sleep(error.retry_after)
            except Exception as error:
                log.warning("Сбой получения обновлений: %s", type(error).__name__)
                time.sleep(5)


if __name__ == "__main__":
    main()

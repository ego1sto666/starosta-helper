"""Разбор писем преподавателей — без сети и без внешних библиотек, только стандартный Python.

Что делает:
  parse_email(raw)          — байты письма → отправитель, тема, текст, вложения;
  match_teacher(addr, ...)  — письмо от преподавателя из списка группы? (только такие письма сохраняем);
  find_dates(text, today)   — даты в тексте: «15.11», «до 20 ноября», «к пятнице», «завтра»;
  guess_kind(subject, text) — что это: перенос пары, экзамен, работа, событие или просто объявление;
  suggest(...)              — готовое предложение для экрана «Почта»: «Сделать делом / сдачей / событием».

Всё здесь — чистые функции: их легко проверять тестами (server/tests/test_parse.py).
"""
from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses, parseaddr, parsedate_to_datetime


@dataclass
class Attachment:
    name: str
    mime: str
    size: int


@dataclass
class ParsedMail:
    message_id: str
    from_addr: str
    from_name: str
    to_addrs: list[str]
    subject: str
    text: str
    sent_at: str | None  # ISO-строка
    attachments: list[Attachment] = field(default_factory=list)


# ---------- письмо ----------

def html_to_text(s: str) -> str:
    """Очень простой перевод HTML в текст: переносы строк вместо блоков, без тегов."""
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h\d)>", "\n", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t ]+", " ", s)
    return re.sub(r"\n\s*\n+", "\n\n", s).strip()


def parse_email(raw: bytes) -> ParsedMail:
    msg: EmailMessage = BytesParser(policy=policy.default).parsebytes(raw)
    name, addr = parseaddr(str(msg.get("From", "")))
    to = [a.lower() for _, a in getaddresses([str(msg.get("To", "")), str(msg.get("Cc", ""))]) if a]
    sent = None
    if msg.get("Date"):
        try:
            sent = parsedate_to_datetime(str(msg["Date"])).isoformat()
        except (TypeError, ValueError):
            sent = None
    body = msg.get_body(preferencelist=("plain", "html"))
    text = ""
    if body is not None:
        try:
            content = body.get_content()
        except LookupError:
            content = (body.get_payload(decode=True) or b"").decode("utf-8", errors="replace")
        text = html_to_text(content) if body.get_content_type() == "text/html" else content.strip()
    atts = []
    for part in msg.iter_attachments():
        payload = part.get_payload(decode=True) or b""
        atts.append(Attachment(part.get_filename() or "файл", part.get_content_type(), len(payload)))
    return ParsedMail(
        message_id=str(msg.get("Message-ID", "")).strip(),
        from_addr=addr.lower(), from_name=name, to_addrs=to,
        subject=str(msg.get("Subject", "")).strip(), text=text, sent_at=sent, attachments=atts,
    )


def normalize_addr(addr: str) -> str:
    """Адрес для сравнения: нижний регистр, без «+метки» (ivanov+lab@mail.ru → ivanov@mail.ru)."""
    addr = (addr or "").strip().lower()
    if "@" not in addr:
        return addr
    local, domain = addr.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local, domain = local.replace(".", ""), "gmail.com"
    if domain in ("ya.ru", "yandex.com", "yandex.by", "yandex.kz", "yandex.ua"):
        domain = "yandex.ru"
    return f"{local}@{domain}"


def match_teacher(from_addr: str, teachers: list[dict]) -> dict | None:
    """Преподаватель из списка группы (teachers[].email в data.json) или None."""
    want = normalize_addr(from_addr)
    if not want or "@" not in want:
        return None
    for t in teachers:
        if not isinstance(t, dict) or not isinstance(t.get("email"), str):
            continue
        for a in re.split(r"[\s,;]+", t["email"]):
            if a and normalize_addr(a) == want:
                return t
    return None


def is_forward_confirmation(m: ParsedMail) -> bool:
    """Служебное письмо почтового сервиса «подтвердите пересылку» — его показываем старосте целиком."""
    s = (m.subject + " " + m.from_addr).lower()
    return any(k in s for k in ("forwarding confirmation", "подтверждение пересылки", "подтвердите пересылку",
                                "forwarding-noreply@google.com", "переадресац"))


# ---------- даты ----------

MONTHS = {"январ": 1, "феврал": 2, "март": 3, "апрел": 4, "ма": 5, "июн": 6, "июл": 7, "август": 8,
          "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12}
MONTH_RE = r"(январ[яь]|феврал[яь]|марта?|апрел[яь]|ма[яй]|июн[яь]|июл[яь]|августа?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь])"
WEEKDAYS = {"понедельник": 0, "вторник": 1, "сред": 2, "четверг": 3, "пятниц": 4, "суббот": 5, "воскресен": 6}
WEEKDAY_RE = r"(понедельник[ауе]?|вторник[ауе]?|сред[уеы]|четверг[ауе]?|пятниц[уеы]|суббот[уеы]|воскресень[ея]|воскресенье)"
DEADLINE_WORDS = r"(до|к|не позднее|срок[^\n.]{0,12}?|дедлайн[^\n.]{0,6}?|сдать[^\n.]{0,20}?)"


def _year_for(d: int, m: int, today: date) -> int:
    """Год для «15.01» без года: ближайшая такая дата не раньше чем 2 месяца назад."""
    y = today.year
    try:
        cand = date(y, m, d)
    except ValueError:
        return y
    return y + 1 if (today - cand).days > 60 else y


def _mk(y: int, m: int, d: int) -> date | None:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def find_dates(text: str, today: date) -> list[tuple[date, bool]]:
    """Все даты в тексте по порядку: (дата, похоже ли на срок — «до 15.11», «к пятнице»)."""
    t = (text or "").lower().replace("ё", "е")
    found: list[tuple[int, date, bool]] = []

    def is_deadline(start: int) -> bool:
        return bool(re.search(DEADLINE_WORDS + r"\s*$", t[max(0, start - 30):start]))

    for m in re.finditer(r"(?<![\d.])(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?![\d.]\d)", t):
        d, mo = int(m.group(1)), int(m.group(2))
        y = int(m.group(3)) if m.group(3) else _year_for(d, mo, today)
        y = y + 2000 if y < 100 else y
        dt = _mk(y, mo, d)
        if dt:
            found.append((m.start(), dt, is_deadline(m.start())))
    for m in re.finditer(r"(?<!\d)(\d{1,2})\s+" + MONTH_RE + r"(?:\s+(\d{4}))?", t):
        d, word = int(m.group(1)), m.group(2)
        mo = next(v for k, v in MONTHS.items() if word.startswith(k))
        y = int(m.group(3)) if m.group(3) else _year_for(d, mo, today)
        dt = _mk(y, mo, d)
        if dt:
            found.append((m.start(), dt, is_deadline(m.start())))
    for m in re.finditer(r"\b(до|к|в|во|на|с)\s+(следующ(?:ий|ую|ее|его|ей)\s+)?" + WEEKDAY_RE, t):
        wd = next(v for k, v in WEEKDAYS.items() if m.group(3).startswith(k))
        ahead = (wd - today.weekday()) % 7 or 7  # «к пятнице» в пятницу — значит, к следующей
        found.append((m.start(), today + timedelta(days=ahead), m.group(1) in ("до", "к")))
    for word, k in (("послезавтра", 2), ("завтра", 1), ("сегодня", 0)):
        for m in re.finditer(r"\b" + word + r"\b", t):  # «послезавтра» не совпадёт с «завтра»: внутри слова нет границы
            found.append((m.start(), today + timedelta(days=k), is_deadline(m.start())))
    found.sort(key=lambda x: x[0])
    out, seen = [], set()
    for _, dt, dl in found:
        if dt not in seen:
            seen.add(dt)
            out.append((dt, dl))
    return out


def pick_due(text: str, today: date) -> date | None:
    """Срок: первая дата со словом «до/к/срок», иначе первая будущая дата."""
    ds = [(d, dl) for d, dl in find_dates(text, today) if d >= today]
    for d, dl in ds:
        if dl:
            return d
    return ds[0][0] if ds else None


# ---------- что это за письмо ----------

KINDS = [  # порядок важен: перенос пары важнее всего, объявление — если ничего не подошло
    ("schedule", r"перенос|переносит|отмен|не будет (пары|занятия|лекции)|замен[аы] (пары|аудитории)|в другой аудитории|дистанционно"),
    ("exam", r"экзамен|зачет|зачёт|консультац|сесси|пересдач"),
    ("work", r"лаборатор|лаб[аыу]\b|курсов|реферат|отчет|отчёт|домашн|дз\b|задани|контрольн|сдать|сдач[аи]|защит"),
    ("event", r"собрани|мероприят|встреч|конференц|экскурс|олимпиад|субботник"),
]
KIND_TITLES = {"schedule": "Изменение в расписании", "exam": "Сессия", "work": "Сдача работы", "event": "Событие", "info": "Объявление"}


def guess_kind(subject: str, text: str) -> str:
    s = f"{subject}\n{text[:2000]}".lower().replace("ё", "е")
    for kind, rx in KINDS:
        if re.search(rx.replace("ё", "е"), s):
            return kind
    return "info"


def short_title(subject: str, text: str, limit: int = 80) -> str:
    """Заголовок для предложения: тема без «Re:/Fwd:», иначе первая строка текста."""
    s = re.sub(r"^\s*((re|fwd?|fw|ответ|пересл)\s*(\[\d+\])?\s*:\s*)+", "", subject or "", flags=re.I).strip()
    if not s:
        s = next((ln.strip() for ln in (text or "").splitlines() if ln.strip()), "Письмо преподавателя")
    return s if len(s) <= limit else s[: limit - 1].rstrip() + "…"


def suggest(m: ParsedMail, teachers: list[dict], today: date) -> dict:
    """Предложение для экрана «Почта». Староста его подтверждает или отклоняет — сами ничего не создаём."""
    t = match_teacher(m.from_addr, teachers)
    kind = "confirm" if is_forward_confirmation(m) else guess_kind(m.subject, m.text)
    due = pick_due(f"{m.subject}\n{m.text}", today)
    subject = ""
    if t and t.get("subjects"):
        subject = re.split(r"[,;\n]", t["subjects"])[0].strip()
    return {
        "kind": kind,
        "kind_title": "Подтверждение пересылки" if kind == "confirm" else KIND_TITLES[kind],
        "title": short_title(m.subject, m.text),
        "due": due.isoformat() if due else "",
        "subject": subject,
        "teacher_id": t.get("id") if t else "",
        "teacher_name": (t.get("name") if t else "") or m.from_name or m.from_addr,
        "attachments": len(m.attachments),
    }

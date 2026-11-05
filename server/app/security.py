"""Пароли, токены входа и шифрование секретов почты."""
from __future__ import annotations

import base64
import hashlib
import re
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken

from .config import settings

_ph = PasswordHasher()  # Argon2id — рекомендуемый способ хранить пароли

LOGIN_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")


def normalize_login(login: str) -> str:
    return (login or "").strip().lower()


def login_error(login: str) -> str:
    if not LOGIN_RE.match(normalize_login(login)):
        return "Логин: 3–32 символа — латинские буквы, цифры, точка, дефис или подчёркивание"
    return ""


def password_error(pw: str, login: str = "") -> str:
    if len(pw or "") < 8:
        return "Пароль — не короче 8 символов"
    if login and normalize_login(login) in pw.lower():
        return "Пароль не должен содержать логин"
    if pw.isdigit() or pw.isalpha():
        return "Добавьте в пароль и буквы, и цифры"
    return ""


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, pw)
    except (VerifyMismatchError, InvalidHashError):
        return False


def new_token() -> tuple[str, str]:
    """Случайный токен: (сам токен — отдать пользователю, его sha256 — хранить в базе)."""
    raw = secrets.token_urlsafe(32)
    return raw, token_hash(raw)


def token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_mail_code(title: str) -> str:
    """Код адреса пересылки: понятная часть из названия группы + случайный хвост, чтобы адрес нельзя было угадать."""
    base = re.sub(r"[^a-z0-9]+", "-", translit(title).lower()).strip("-")[:16] or "group"
    return f"{base}-{secrets.token_hex(3)}"


_TR = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
               ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f",
                "h", "c", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya"]))


def translit(s: str) -> str:
    return "".join(_TR.get(ch, _TR.get(ch.lower(), ch)) for ch in s)


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key)


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode() if plain else ""


def decrypt_secret(enc: str) -> str:
    try:
        return _fernet().decrypt(enc.encode()).decode() if enc else ""
    except InvalidToken:
        return ""

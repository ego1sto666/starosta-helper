"""Настройки сервера — из переменных окружения или файла server/.env (образец: .env.example)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="STAROSTA_", extra="ignore")

    # база: локально — файл SQLite, на сервере — PostgreSQL (postgresql+psycopg://user:pass@host/db)
    database_url: str = "sqlite:///./dev.db"
    # адрес приложения (PWA): только ему разрешены запросы с cookie
    app_origin: str = "http://127.0.0.1:8765"
    # cookie только по HTTPS — на настоящем сервере обязательно true
    cookie_secure: bool = False
    session_days: int = 30
    # ключ шифрования паролей приложений и токенов почты (python -c "import secrets; print(secrets.token_urlsafe(32))")
    secret_key: str = "dev-only-change-me"
    # домен для адресов пересылки: <код группы>@<mail_domain>
    mail_domain: str = "in.starosta.local"
    # письма и вложения хранятся ограниченное время (152-ФЗ: не дольше, чем нужно)
    mail_retention_days: int = 60
    attachment_max_mb: int = 10
    # как часто проверять почтовые ящики, подключённые по IMAP
    imap_poll_minutes: int = 5
    mail_imap_hosts: str = ""  # дополнительные доверенные IMAP-хосты через запятую
    mail_relay_token: str = ""  # секрет доверенного шлюза входящей почты
    push_public_key: str = ""
    push_private_key_file: str = ""
    push_subject: str = ""
    telegram_token: str = ""
    telegram_chat_id: int = 0
    telegram_group_id: str = ""


settings = Settings()

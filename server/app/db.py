"""Подключение к базе. Таблицы описаны в models.py (и тем же языком SQL — в server/schema.sql)."""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

_sqlite = settings.database_url.startswith("sqlite")
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False} if _sqlite else {}, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Для разработки: создать таблицы. На сервере вместо этого — миграции (Alembic, шаг 2 в ROADMAP.md)."""
    from . import models  # noqa: F401 — регистрирует таблицы

    Base.metadata.create_all(engine)

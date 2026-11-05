"""Выгрузить описание API (openapi.json) и таблицы для PostgreSQL (schema.sql) из кода сервера.

Запуск из папки server:  python tools/export_contract.py
Так документы всегда совпадают с кодом — руками их не правим.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("STAROSTA_DATABASE_URL", "sqlite://")

from sqlalchemy.dialects import postgresql  # noqa: E402
from sqlalchemy.schema import CreateIndex, CreateTable  # noqa: E402

from app.db import Base  # noqa: E402
from app.main import app  # noqa: E402
from app import models  # noqa: E402,F401

(ROOT / "openapi.json").write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=1), encoding="utf-8")
lines = ["-- Таблицы сервера «Помощника старосты» для PostgreSQL.",
         "-- Создано автоматически из server/app/models.py командой: python tools/export_contract.py", ""]
dialect = postgresql.dialect()
for t in Base.metadata.sorted_tables:
    if t.comment:
        lines.append(f"-- {t.comment}")
    lines.append(str(CreateTable(t).compile(dialect=dialect)).strip() + ";\n")
    for ix in sorted(t.indexes, key=lambda i: i.name):
        lines.append(str(CreateIndex(ix).compile(dialect=dialect)).strip() + ";")
    lines.append("")
(ROOT / "schema.sql").write_text("\n".join(lines), encoding="utf-8")
print("openapi.json, schema.sql — готово")

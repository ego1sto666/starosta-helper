"""API «Помощника старосты». Локально подключён через js/config.js (см. server/README.md).

Локальный запуск (из папки server):
    python -m venv .venv && .venv\\Scripts\\activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000
Документация API в браузере: http://127.0.0.1:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import init_db
from .routers import auth, groups, mail, push, telegram


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()  # для разработки; на сервере — миграции Alembic
    yield


app = FastAPI(title="Помощник старосты — API", version="0.1.0-draft", lifespan=lifespan,
              description="Аккаунты, синхронизация данных группы и письма преподавателей. Черновик.")

# запросы с cookie — только с адреса приложения
app.add_middleware(CORSMiddleware, allow_origins=[settings.app_origin], allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type", "X-Starosta"])


@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    """Изменяющие запросы — только с заголовком X-Starosta: другой сайт не сможет его поставить без разрешения CORS."""
    relay_request = request.method == "POST" and request.url.path.startswith("/integrations/mail/")
    if request.method in ("POST", "PUT", "DELETE") and not relay_request and request.headers.get("x-starosta") != "1":
        return JSONResponse({"detail": "Нет заголовка X-Starosta"}, status_code=403)
    return await call_next(request)


app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(mail.router)
app.include_router(mail.relay)
app.include_router(telegram.router)
app.include_router(push.router)


@app.get("/health", tags=["Служебное"])
def health():
    return {"ok": True}

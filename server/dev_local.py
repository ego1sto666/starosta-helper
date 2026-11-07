"""Один локальный запуск: сайт, API и проверка подключённой почты.

Только для разработки на этом компьютере. Не открывает порты во внешнюю сеть.
"""
from __future__ import annotations

import http.server
import os
import secrets
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

SERVER = Path(__file__).resolve().parent
from static_local import AppHandler


def main() -> None:
    env_file = SERVER / ".env"
    if not env_file.exists():
        env_file.write_text(
            "STAROSTA_DATABASE_URL=sqlite:///./dev.db\n"
            "STAROSTA_APP_ORIGIN=http://127.0.0.1:8765\n"
            "STAROSTA_COOKIE_SECURE=false\n"
            f"STAROSTA_SECRET_KEY={secrets.token_urlsafe(48)}\n"
            "STAROSTA_MAIL_DOMAIN=in.starosta.local\n", encoding="utf-8"
        )
    env = os.environ.copy()
    env.setdefault("STAROSTA_IMAP_POLL_MINUTES", "2")
    children = []
    try:
        children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], cwd=SERVER, env=env))
        for _ in range(40):
            try:
                with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1):
                    break
            except OSError:
                if children[0].poll() is not None:
                    raise RuntimeError("Не удалось запустить API. Проверьте настройки сервера.")
                time.sleep(0.2)
        else:
            raise RuntimeError("API не ответил на проверку запуска.")
        children.append(subprocess.Popen([sys.executable, "-m", "app.worker"], cwd=SERVER, env=env))
        with http.server.ThreadingHTTPServer(("127.0.0.1", 8765), AppHandler) as site:
            threading.Timer(1, lambda: webbrowser.open("http://127.0.0.1:8765/")).start()
            print("Помощник старосты: http://127.0.0.1:8765/")
            print("Аккаунт и почта работают, пока открыто это окно. Ctrl+C — остановить.")
            site.serve_forever()
    finally:
        for child in children:
            child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()


if __name__ == "__main__":
    main()

"""Тестовый сервер: сайт из корня проекта, тесты по адресу /__t/, результаты — POST /__save/<имя> → tests/out/.

Запуск вручную: python tests/server.py [порт]  (по умолчанию 8770)
Обычно не нужен — tests/run.py поднимает его сам.
"""
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "tests"
OUT = TESTS / "out"


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def translate_path(self, path):
        # /__t/… — файлы тестов, всё остальное — сайт из корня проекта
        clean = path.split("?")[0].split("#")[0]
        if clean.startswith("/__t/"):
            return str(TESTS / clean[len("/__t/"):])
        return super().translate_path(path)

    def do_POST(self):
        size = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(size)
        name = os.path.basename(self.path.split("?")[0]) or "out.txt"
        OUT.mkdir(exist_ok=True)
        (OUT / name).write_bytes(body)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")


def serve(port=8770, background=False):
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(ROOT)))
    if background:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return server
    print(f"Тесты: http://127.0.0.1:{port}/__t/import.html (и другие *.html в tests/)")
    server.serve_forever()


if __name__ == "__main__":
    serve(int(sys.argv[1]) if len(sys.argv) > 1 else 8770)

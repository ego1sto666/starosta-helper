"""Локальная раздача только файлов приложения, без базы, ключей и рабочих документов."""
from __future__ import annotations

import http.server
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
FILES = {"/", "/index.html", "/privacy.html", "/manifest.webmanifest", "/sw.js"}
ASSET_TYPES = {
    "/css/": {".css"},
    "/js/": {".js"},
    "/assets/": {".png", ".woff2"},
    "/demo/": {".json"},
}


class AppHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _allowed(self) -> bool:
        path = unquote(urlsplit(self.path).path)
        if path == "/":
            return True
        prefix, _, name = path.rpartition("/")
        if "\\" in path or not name or name.startswith("."):
            return False
        if path not in FILES and Path(name).suffix not in ASSET_TYPES.get(prefix + "/", set()):
            return False
        target = ROOT / path.lstrip("/")
        try:
            return target.is_file() and target.resolve() == target
        except (OSError, ValueError):
            return False

    def do_GET(self):
        if not self._allowed():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._allowed():
            self.send_error(404)
            return
        super().do_HEAD()


def serve() -> None:
    with http.server.ThreadingHTTPServer(("127.0.0.1", 8765), AppHandler) as site:
        print("Сайт: http://127.0.0.1:8765/")
        site.serve_forever()


if __name__ == "__main__":
    serve()

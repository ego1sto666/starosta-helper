"""Локальный сайт не должен отдавать секреты и личные файлы."""
import unittest

from static_local import AppHandler


class StaticAccessTest(unittest.TestCase):
    def test_only_app_files(self):
        handler = object.__new__(AppHandler)
        for path in ("/", "/index.html", "/js/app.js", "/js/routes.js", "/css/app.css", "/demo/group.json"):
            handler.path = path
            self.assertTrue(handler._allowed(), path)
        for path in ("/server/.env", "/server/dev.db", "/docs/names.xlsx", "/.agents/skills/",
                     "/js/../server/.env", "/js/%2e%2e/server/.env", "/tests/out/result.txt"):
            handler.path = path
            self.assertFalse(handler._allowed(), path)

"""Проверка API целиком: регистрация → группа → синхронизация → письмо преподавателя → «Почта».

Нужны библиотеки из requirements.txt. Запуск из папки server:  python -m unittest discover -s tests -v
База — временный файл SQLite, ничего настоящего не трогается.
"""
import os
import tempfile
import unittest

_tmp = tempfile.mkdtemp()
os.environ["STAROSTA_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["STAROSTA_MAIL_DOMAIN"] = "in.test"

try:
    from fastapi.testclient import TestClient
except ImportError:  # библиотеки сервера не установлены — пропускаем, test_parse.py всё равно работает
    TestClient = None

H = {"X-Starosta": "1"}


@unittest.skipIf(TestClient is None, "pip install -r requirements.txt")
class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.main import app
        cls.ctx = TestClient(app)
        cls.c = cls.ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.ctx.__exit__(None, None, None)

    def test_flow(self):
        c = self.c
        # без заголовка X-Starosta изменяющие запросы не принимаются (защита от подделки запросов)
        self.assertEqual(c.post("/auth/login", json={"login": "x", "password": "y"}).status_code, 403)
        # регистрация: слабый пароль, без согласия, нормально
        bad = c.post("/auth/register", headers=H, json={"login": "starosta1", "email": "s1@example.ru", "password": "12345678", "consent": True})
        self.assertEqual(bad.status_code, 422)
        self.assertEqual(c.post("/auth/register", headers=H, json={"login": "starosta1", "email": "s1@example.ru", "password": "Parol2026", "consent": False}).status_code, 422)
        r = c.post("/auth/register", headers=H, json={"login": "Starosta1", "email": "s1@example.ru", "name": "Староста", "password": "Parol2026", "consent": True})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["login"], "starosta1")
        self.assertEqual(c.get("/auth/me").json()["login"], "starosta1")
        # выход и вход по почте
        c.post("/auth/logout", headers=H)
        self.assertEqual(c.get("/auth/me").status_code, 401)
        self.assertEqual(c.post("/auth/login", headers=H, json={"login": "starosta1", "password": "неверный"}).status_code, 401)
        self.assertEqual(c.post("/auth/login", headers=H, json={"login": "s1@example.ru", "password": "Parol2026"}).status_code, 200)
        self.assertEqual(c.post("/auth/password/forgot", headers=H, json={"email": "s1@example.ru"}).status_code, 503)

        # группа с данными с устройства
        data = {"settings": {"group": "26-ИВТ-2-1"}, "students": [], "teachers": [{"id": "t1", "name": "Смирнов А. В.", "subjects": "Программирование", "email": "smirnov@nntu.ru"}]}
        g = c.post("/groups", headers=H, json={"title": "26-ИВТ-2-1", "university": "Другой вуз", "data": data}).json()
        self.assertEqual(g["university"], "Другой вуз")
        self.assertTrue(g["mail_address"].startswith("26-ivt-2-1-") and g["mail_address"].endswith("@in.test"))
        gid = g["id"]
        got = c.get(f"/groups/{gid}/data").json()
        self.assertEqual(got["rev"], 1)
        # сохранение: со старой версией — 409 и свежие данные
        self.assertEqual(c.put(f"/groups/{gid}/data", headers=H, json={"rev": 1, "data": data}).json()["rev"], 2)
        conflict = c.put(f"/groups/{gid}/data", headers=H, json={"rev": 1, "data": data})
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["detail"]["rev"], 2)
        invalid = c.put(f"/groups/{gid}/data", headers=H, json={"rev": 2, "data": {"students": [None]}})
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(c.get(f"/groups/{gid}/data").json()["rev"], 2)

        # Из двух одновременных сохранений одной ревизии принимается ровно одно.
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier

        barrier = Barrier(2)

        def save(tag):
            barrier.wait(timeout=5)
            return c.put(f"/groups/{gid}/data", headers=H, json={"rev": 2, "data": {**data, "tag": tag}})

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(save, ["a", "b"]))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 409])
        self.assertEqual(c.get(f"/groups/{gid}/data").json()["rev"], 3)

        # Неверный пароль приложения не сохраняется; подключённый ящик виден только группе.
        from unittest.mock import MagicMock, patch

        imap_body = {"provider": "yandex", "login": "chief@example.ru", "password": "app-secret"}
        with patch("app.routers.mail.connect", side_effect=OSError("auth failed")):
            self.assertEqual(c.post(f"/groups/{gid}/mail/sources", headers=H, json=imap_body).status_code, 422)
        self.assertEqual(len(c.get(f"/groups/{gid}/mail/sources").json()), 1)
        with patch("app.routers.mail.connect", return_value=MagicMock()):
            self.assertEqual(c.post(f"/groups/{gid}/mail/sources", headers=H, json=imap_body).status_code, 201)
        src = c.get(f"/groups/{gid}/mail/sources").json()
        self.assertEqual(len(src), 2)
        self.assertNotIn("password", str(src))

        # письмо: от преподавателя — в «Почту», от чужого — не сохраняется
        from email.message import EmailMessage

        from app.db import SessionLocal
        from app.mail.service import ingest
        from app.models import Group

        def raw(sender, subj, body, mid):
            m = EmailMessage(); m["From"], m["Subject"], m["Message-ID"] = sender, subj, mid; m.set_content(body)
            return m.as_bytes()
        with SessionLocal() as db:
            grp = db.get(Group, gid)
            self.assertIsNotNone(ingest(db, grp, raw("Смирнов <Smirnov@nntu.ru>", "Лабораторная №3", "сдать до 15.11", "<1@x>")))
            self.assertIsNone(ingest(db, grp, raw("Смирнов <Smirnov@nntu.ru>", "Лабораторная №3", "сдать до 15.11", "<1@x>")))  # повтор
            self.assertIsNone(ingest(db, grp, raw("spam@example.com", "Скидки", "купите", "<2@x>")))
        inbox = c.get(f"/groups/{gid}/inbox").json()
        self.assertEqual(len(inbox), 1)
        self.assertEqual(inbox[0]["suggestion"]["kind"], "work")
        self.assertEqual(inbox[0]["suggestion"]["subject"], "Программирование")
        self.assertEqual(c.post(f"/groups/{gid}/inbox/{inbox[0]['id']}/accept", headers=H, json={"type": "works", "id": "w1"}).json()["status"], "accepted")
        self.assertEqual(c.post(f"/groups/{gid}/inbox/{inbox[0]['id']}/accept", headers=H, json={"type": "works", "id": "w1"}).status_code, 200)
        self.assertEqual(c.post(f"/groups/{gid}/inbox/{inbox[0]['id']}/dismiss", headers=H).status_code, 409)
        self.assertEqual(c.get(f"/groups/{gid}/inbox").json(), [])

        # заместитель по коду приглашения
        code = c.post(f"/groups/{gid}/invites", headers=H, json={"role": "deputy"}).json()["code"]
        c.post("/auth/logout", headers=H)
        c.post("/auth/register", headers=H, json={"login": "zam", "email": "zam@example.ru", "password": "Deputy2026x", "consent": True})
        self.assertEqual(c.get(f"/groups/{gid}/data").status_code, 403)
        self.assertEqual(c.get(f"/groups/{gid}/inbox").status_code, 403)
        self.assertEqual(c.get(f"/groups/{gid}/mail/sources").status_code, 403)
        self.assertEqual(c.post("/invites/accept", headers=H, json={"code": code.lower()}).json()["role"], "deputy")
        self.assertEqual(c.get(f"/groups/{gid}/data").status_code, 200)
        self.assertEqual(c.post("/invites/accept", headers=H, json={"code": code}).status_code, 400)  # второй раз — нет


if __name__ == "__main__":
    unittest.main()

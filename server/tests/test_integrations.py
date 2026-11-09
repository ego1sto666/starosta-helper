"""Проверки интеграций без реальных почтовых ящиков, браузерных ключей и чатов."""
import base64
from email.message import EmailMessage
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import MagicMock, patch

from tests.test_api import H  # настраивает временную SQLite до импорта приложения
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.config import settings
from app.db import SessionLocal
from app.mail.imap import poll
from app.main import app
from app.models import MailCursor, MailSource
from app.routers.push import send_test
from app.telegram import record_update


def mail(sender, text):
    message = EmailMessage()
    message["From"] = sender
    message["To"] = "group@example.org"
    message["Subject"] = "Задание"
    message.set_content(text)
    return message.as_bytes()


def b64(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def subscription():
    public = ec.generate_private_key(ec.SECP256R1()).public_key()
    return {"endpoint": "https://fcm.googleapis.com/fcm/send/test-device",
            "keys": {"p256dh": b64(public.public_bytes(serialization.Encoding.X962,
                                                      serialization.PublicFormat.UncompressedPoint)),
                     "auth": b64(b"0123456789ABCDEF")}}


class IntegrationsTest(TestCase):
    def setUp(self):
        self.c = self.enterContext(TestClient(app))
        name = self._testMethodName.replace("_", "")[-22:]
        self.register(self.c, "head" + name)
        self.group = self.c.post("/groups", headers=H, json={
            "title": "ПИ-21", "data": {"teachers": [{"id": "t1", "name": "Преподаватель", "email": "teacher@example.org"}]},
        }).json()
        self.path = f"/groups/{self.group['id']}"

    def register(self, client, login):
        response = client.post("/auth/register", headers=H, json={
            "login": login, "email": login + "@example.org", "password": "parol-v3b", "consent": True,
        })
        self.assertEqual(response.status_code, 201, response.text)

    def test_mail_relay(self):
        route = "/integrations/mail/" + self.group["mail_address"].split("@")[0]
        token = "test-" + "x" * 32
        headers = {"X-Starosta-Mail-Token": token, "Content-Type": "message/rfc822"}
        raw = mail("teacher@example.org", "Первая лабораторная")
        with patch.object(settings, "mail_relay_token", ""):
            self.assertEqual(self.c.post(route, headers=headers, content=raw).status_code, 404)
        with patch.object(settings, "mail_relay_token", token):
            self.assertEqual(self.c.post(route, content=raw).status_code, 403)
            self.assertEqual(self.c.post(route, headers=headers, content=raw).status_code, 204)
            self.assertEqual(self.c.post(route, headers=headers, content=b"Received: by proxy\n" + raw).status_code, 204)
            self.assertEqual(self.c.post(route, headers=headers, content=mail("stranger@example.org", "Чужое")).status_code, 204)
            self.assertEqual(self.c.post(route, headers=headers, content=mail("teacher@example.org", "Вторая лабораторная")).status_code, 204)
            self.assertTrue(self.c.get(self.path + "/mail/sources").json()[0]["configured"])
        self.assertEqual(len(self.c.get(self.path + "/inbox").json()), 2)

    def test_imap_retry(self):
        group_id = self.group["id"]
        with SessionLocal.begin() as db:
            source = MailSource(group_id=group_id, kind="imap", provider="gmail")
            db.add(source)
            db.flush()
            source_id = source.id
        box = MagicMock()
        box.select.return_value = ("OK", [b"3"])
        box.response.return_value = ("UIDVALIDITY", [b"17"])
        fail = True
        def command(kind, uid, part):
            if kind == "SEARCH":
                return "OK", [b"3 2 1"]
            if "HEADER" in part:
                address = "stranger@example.org" if uid == "3" else "teacher@example.org"
                return "OK", [(b"", ("From: " + address + "\r\n\r\n").encode())]
            self.assertNotEqual(uid, "3", "тело чужого письма не загружается")
            if uid == "2" and fail:
                return "NO", [b""]
            return "OK", [(b"", mail("teacher@example.org", "Письмо " + uid))]
        box.uid.side_effect = command
        with patch("app.mail.imap.connect", return_value=box), SessionLocal() as db:
            source = db.get(MailSource, source_id)
            self.assertEqual(poll(db, source), 1)
            self.assertEqual(db.get(MailCursor, source_id).last_uid, 1)
            fail = False
            self.assertEqual(poll(db, source), 1)
            self.assertEqual(db.get(MailCursor, source_id).last_uid, 3)
        self.assertEqual(len(self.c.get(self.path + "/inbox").json()), 2)

    def test_push_ownership_and_expiry(self):
        data = subscription()
        body = {"endpoint": data["endpoint"]}
        with patch("app.routers.push.configured", return_value=True), patch("app.routers.push.send_test", return_value=410) as send:
            invalid = {**data, "endpoint": "https://fcm.googleapis.com@127.0.0.1/token"}
            self.assertEqual(self.c.put("/push/device", headers=H, json=invalid).status_code, 422)
            self.assertEqual(self.c.put("/push/device", headers=H, json=data).status_code, 204)
            with TestClient(app) as other:
                self.register(other, "otherpush")
                self.assertEqual(other.put("/push/device", headers=H, json=data).status_code, 409)
                self.assertEqual(other.post("/push/test", headers=H, json=body).status_code, 404)
                self.assertEqual(other.post("/push/device/remove", headers=H, json=body).status_code, 204)
            send.assert_not_called()
            self.assertEqual(self.c.post("/push/test", headers=H, json=body).status_code, 410)
            self.assertFalse(self.c.post("/push/device/status", headers=H, json=body).json()["active"])

    def test_encrypted_push(self):
        with TemporaryDirectory() as tmp:
            pem = Path(tmp) / "vapid.pem"
            key = ec.generate_private_key(ec.SECP256R1())
            pem.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                              serialization.NoEncryption()))
            with patch.multiple(settings, push_private_key_file=str(pem), push_subject="mailto:admin@example.org"):
                with patch("requests.Session.request", return_value=MagicMock(status_code=201)) as request:
                    self.assertEqual(send_test(subscription()), 201)
            self.assertEqual(request.call_args.kwargs["headers"]["content-encoding"], "aes128gcm")
            self.assertFalse(request.call_args.kwargs["allow_redirects"])
            self.assertNotIn(b'"kind"', request.call_args.kwargs["data"])

    def test_telegram_scoped_snapshots(self):
        group_id, chat_id = self.group["id"], -100987654321
        poll = {"id": "poll-1", "question": "Когда собраться?", "is_anonymous": True,
                "options": [{"text": "Сегодня", "voter_count": 2}, {"text": "Завтра", "voter_count": 1}],
                "total_voter_count": 3}
        message = {"message_id": 11, "chat": {"id": chat_id, "type": "supergroup"}, "poll": poll}
        with SessionLocal.begin() as db:
            self.assertFalse(record_update(db, group_id, chat_id, {"update_id": 1, "poll": poll}))
            foreign = {**message, "chat": {**message["chat"], "id": chat_id - 1}}
            self.assertFalse(record_update(db, group_id, chat_id, {"update_id": 2, "message": foreign}))
            self.assertTrue(record_update(db, group_id, chat_id, {"update_id": 3, "message": message}))
            self.assertTrue(record_update(db, group_id, chat_id, {"update_id": 4, "poll": {**poll, "is_closed": True}}))
            self.assertFalse(record_update(db, group_id, chat_id, {"update_id": 3, "message": message}))
        with patch.multiple(settings, telegram_group_id=group_id, telegram_chat_id=chat_id, telegram_token="test"):
            path = self.path + "/telegram/polls"
            response = self.c.get(path).json()
            self.assertTrue(response["configured"])
            self.assertEqual(len(response["items"]), 1)
            self.assertTrue(response["items"][0]["closed"])
            self.assertEqual(response["items"][0]["options"][0]["votes"], 2)
            self.assertNotIn("chat_id", response["items"][0])
            with TestClient(app) as other:
                self.register(other, "othertelegram")
                self.assertEqual(other.get(path).status_code, 403)

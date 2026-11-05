"""Проверка разбора писем — только стандартный Python, сервер и библиотеки не нужны.

Запуск из папки server:  python -m unittest discover -s tests -v
"""
import unittest
from datetime import date

from app.mail.parse import find_dates, guess_kind, is_forward_confirmation, match_teacher, normalize_addr, parse_email, pick_due, short_title, suggest

TODAY = date(2026, 11, 6)  # пятница

TEACHERS = [
    {"id": "t1", "name": "Смирнов А. В.", "subjects": "Программирование", "email": "Smirnov.AV@nntu.ru"},
    {"id": "t2", "name": "Кузнецова Е. Н.", "subjects": "Математика, Дискретная математика", "email": "kuznetsova@mail.ru; e.kuznetsova@yandex.ru"},
    {"id": "t3", "name": "Без почты", "subjects": "", "email": ""},
]


def mail(subject, body, sender="Смирнов А. В. <smirnov.av@nntu.ru>", html=False, attach=False):
    from email.message import EmailMessage
    m = EmailMessage()
    m["From"], m["To"], m["Subject"] = sender, "26-ivt-2-1-a3f9c1@in.starosta.local", subject
    m["Message-ID"], m["Date"] = "<abc@nntu.ru>", "Fri, 06 Nov 2026 10:15:00 +0300"
    if html:
        m.set_content("версия без HTML")
        m.add_alternative(body, subtype="html")
    else:
        m.set_content(body)
    if attach:
        m.add_attachment(b"%PDF-1.4 test", maintype="application", subtype="pdf", filename="Задание.pdf")
    return m.as_bytes()


class ParseTest(unittest.TestCase):
    def test_parse_plain(self):
        p = parse_email(mail("Лабораторная №3", "Сдать до 15.11"))
        self.assertEqual(p.from_addr, "smirnov.av@nntu.ru")
        self.assertEqual(p.from_name, "Смирнов А. В.")
        self.assertEqual(p.subject, "Лабораторная №3")
        self.assertIn("Сдать до 15.11", p.text)
        self.assertTrue(p.sent_at.startswith("2026-11-06T10:15"))

    def test_parse_html_and_attachment(self):
        p = parse_email(mail("Отчёт", "<p>Добрый день!</p><p>Отчёт &mdash; <b>к пятнице</b></p>", html=True, attach=True))
        self.assertEqual(p.text, "версия без HTML")  # текстовая версия важнее HTML
        self.assertEqual([(a.name, a.mime) for a in p.attachments], [("Задание.pdf", "application/pdf")])

    def test_html_only(self):
        from email.message import EmailMessage
        m = EmailMessage(); m["From"] = "a@b.ru"; m["Subject"] = "x"
        m.set_content("<div>Строка 1<br>Строка&nbsp;2</div><script>alert(1)</script>", subtype="html")
        self.assertEqual(parse_email(m.as_bytes()).text, "Строка 1\nСтрока 2")


class TeacherTest(unittest.TestCase):
    def test_match(self):
        self.assertEqual(match_teacher("smirnov.av@nntu.ru", TEACHERS)["id"], "t1")  # регистр не важен
        self.assertEqual(match_teacher("e.kuznetsova@ya.ru", TEACHERS)["id"], "t2")      # второй адрес, ya.ru = yandex.ru
        self.assertIsNone(match_teacher("spam@example.com", TEACHERS))
        self.assertIsNone(match_teacher("", TEACHERS))

    def test_normalize(self):
        self.assertEqual(normalize_addr("Iva.Nov+lab@GMAIL.com"), "ivanov@gmail.com")
        self.assertEqual(normalize_addr("ivan+x@mail.ru"), "ivan@mail.ru")


class DatesTest(unittest.TestCase):
    def test_numeric(self):
        self.assertEqual(find_dates("Сдать до 15.11", TODAY), [(date(2026, 11, 15), True)])
        self.assertEqual(find_dates("встреча 03.02.2027", TODAY), [(date(2027, 2, 3), False)])
        self.assertEqual(find_dates("10.01", TODAY), [(date(2027, 1, 10), False)])  # январь — уже следующего года
        self.assertEqual(find_dates("в 10.30 в аудитории", TODAY), [])                  # время, а не дата

    def test_words(self):
        self.assertEqual(pick_due("Отчёты принимаю до 20 ноября включительно", TODAY), date(2026, 11, 20))
        self.assertEqual(pick_due("к пятнице", TODAY), date(2026, 11, 13))   # сегодня пятница → следующая
        self.assertEqual(pick_due("до понедельника", TODAY), date(2026, 11, 9))
        self.assertEqual(pick_due("завтра консультация", TODAY), date(2026, 11, 7))
        self.assertEqual(pick_due("послезавтра", TODAY), date(2026, 11, 8))

    def test_deadline_wins(self):
        # первая дата — когда выдали задание, срок — вторая, со словом «до»
        self.assertEqual(pick_due("Задание от 02.11, сдать до 16.11", TODAY), date(2026, 11, 16))
        self.assertIsNone(pick_due("Без дат", TODAY))


class KindTest(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual(guess_kind("Перенос пары", "Пара в среду переносится на четверг"), "schedule")
        self.assertEqual(guess_kind("Консультация", "перед экзаменом"), "exam")
        self.assertEqual(guess_kind("Лабораторная работа №3", ""), "work")
        self.assertEqual(guess_kind("Re: отчёт", "жду отчёт"), "work")
        self.assertEqual(guess_kind("Собрание группы", ""), "event")
        self.assertEqual(guess_kind("Добрый день", "Материалы лекции во вложении"), "info")

    def test_title(self):
        self.assertEqual(short_title("Re: Fwd: Лабораторная №3", ""), "Лабораторная №3")
        self.assertEqual(short_title("", "\n  Первая строка\nвторая"), "Первая строка")
        self.assertTrue(short_title("а" * 200, "").endswith("…"))

    def test_confirmation(self):
        p = parse_email(mail("Gmail Forwarding Confirmation - Receive Mail from ivanov@gmail.com", "code 123", sender="forwarding-noreply@google.com"))
        self.assertTrue(is_forward_confirmation(p))
        self.assertEqual(suggest(p, TEACHERS, TODAY)["kind"], "confirm")


class SuggestTest(unittest.TestCase):
    def test_suggest(self):
        p = parse_email(mail("Re: Лабораторная №3", "Коллеги, отчёты по ЛР3 сдать до 15.11. Задание во вложении.", attach=True))
        s = suggest(p, TEACHERS, TODAY)
        self.assertEqual((s["kind"], s["title"], s["due"], s["subject"], s["teacher_id"], s["attachments"]),
                         ("work", "Лабораторная №3", "2026-11-15", "Программирование", "t1", 1))


if __name__ == "__main__":
    unittest.main()

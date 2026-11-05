"""Прогнать все тесты в Chrome без окна и показать результаты.

    python tests/run.py              # все тесты
    python tests/run.py features     # только tests/features.html

Каждый тест — страница tests/<имя>.html: открывает приложение во фрейме, нажимает кнопки как пользователь
и пишет журнал шагов в tests/out/result-<имя>.txt. Последняя строка — «ERRORS: нет», если ошибок не было.
Нужны Chrome и интернет (часть тестов обращается к открытому API расписания НГТУ).
Данные — обезличенные (tests/fixtures/demo.json): настоящее расписание, вымышленные студенты.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from server import OUT, TESTS, serve  # noqa: E402

PORT = 8770
CHROME = [os.environ.get("CHROME", ""), r"C:\Program Files\Google\Chrome\Application\chrome.exe",
          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium",
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
TIMEOUT = 150  # секунд на один тест (тесты идут по очереди: параллельно Chrome не успевает отрисовать)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    chrome = next((c for c in CHROME if c and Path(c).exists()), None) or shutil.which("chrome")
    if not chrome:
        sys.exit("Не нашёл Chrome. Укажите путь в переменной CHROME.")
    names = sys.argv[1:] or sorted(p.stem for p in TESTS.glob("*.html"))
    OUT.mkdir(exist_ok=True)
    for n in names:
        (OUT / f"result-{n}.txt").unlink(missing_ok=True)
    server = serve(PORT, background=True)
    failed = False
    for n in names:
        prof, f = tempfile.mkdtemp(prefix=f"starosta-{n}-"), OUT / f"result-{n}.txt"
        proc = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={prof}",
                                 "--window-size=1300,950", f"http://127.0.0.1:{PORT}/__t/{n}.html"],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + TIMEOUT
        while time.time() < deadline and not f.exists():
            time.sleep(0.5)
        time.sleep(0.5)
        proc.kill()
        text = f.read_text(encoding="utf-8") if f.exists() else "НЕТ РЕЗУЛЬТАТА (тест не успел за отведённое время)"
        ok = text.rstrip().endswith("ERRORS: нет") and "FAIL" not in text
        failed |= not ok
        print(f"\n===== {n}: {'OK' if ok else 'ОШИБКА'} =====\n{text}", flush=True)
        time.sleep(0.5)
        shutil.rmtree(prof, ignore_errors=True)
    server.shutdown()
    print("\nИтог:", "есть ошибки" if failed else "все тесты прошли")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

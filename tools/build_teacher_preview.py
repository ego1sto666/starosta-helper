"""Собрать публичное демо только из разрешённых файлов, без исходников сервера и личных данных."""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREVIEW_VERSION = 4
FILES = [
    "index.html", "manifest.webmanifest", "sw.js", "demo/group.json",
    "css/app.css", "css/tokens.css",
    "js/app.js", "js/api.js", "js/routes.js", "js/nntu.js", "js/xlsx.js",
    "assets/icon.png", "assets/icons.woff2", "assets/icons-fill.woff2",
    "assets/onest-cyrillic.woff2", "assets/onest-latin.woff2",
    "assets/unbounded-cyrillic.woff2", "assets/unbounded-latin.woff2",
]


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "teacher-preview"
    if len(sys.argv) > 2:
        raise SystemExit("Укажите только путь для демонстрационной сборки")
    if target.exists() and any(target.iterdir()):
        raise SystemExit(f"Каталог уже заполнен: {target}")
    data = json.loads((ROOT / "demo/group.json").read_text(encoding="utf-8"))
    if not data.get("settings", {}).get("demo"):
        raise SystemExit("В примере отсутствует отметка demo")
    people = data.get("students", []) + data.get("teachers", [])
    if not people or any(any(p.get(k) for k in ("phone", "email", "telegram", "birthday", "ava")) for p in people):
        raise SystemExit("В демоданных обнаружены контакты, дни рождения или фотографии")
    if any(not re.fullmatch(r"Преподаватель \d+", t.get("name", "")) for t in data.get("teachers", [])):
        raise SystemExit("Имена преподавателей в примере не обезличены")
    if any(l.get("teacher") and not re.fullmatch(r"Преподаватель \d+", l["teacher"]) for l in data.get("lessons", [])):
        raise SystemExit("В расписании примера есть реальные имена преподавателей")
    data["settings"]["preview_version"] = PREVIEW_VERSION
    if any(any(s.get(k) for k in ("phone", "email", "telegram", "birthday", "ava", "note")) for s in data["students"]):
        raise SystemExit("В публичный состав попали личные поля")
    target.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        source = ROOT / name
        if not source.is_file():
            raise SystemExit(f"Нет файла: {name}")
        dest = target / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
    (target / "demo/group.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    html = (target / "index.html").read_text(encoding="utf-8")
    html = html.replace('<meta name="description"', '<meta name="robots" content="noindex,nofollow">\n  <meta name="description"', 1)
    (target / "index.html").write_text(html, encoding="utf-8")
    (target / "js/config.js").write_text(
        "// Публичный просмотр: аккаунты и почта не подключены.\n"
        "window.STAROSTA_PREVIEW = true;\n"
        f"window.STAROSTA_PREVIEW_VERSION = {PREVIEW_VERSION};\n", encoding="utf-8")
    manifest = json.loads((target / "manifest.webmanifest").read_text(encoding="utf-8"))
    manifest["start_url"] = "./#demo"
    (target / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sw = (target / "sw.js").read_text(encoding="utf-8").replace('"privacy.html", ', "")
    (target / "sw.js").write_text(sw, encoding="utf-8")
    (target / ".nojekyll").write_text("", encoding="utf-8")
    (target / "README.md").write_text(
        "# Помощник старосты — демонстрация группы 26-ИВТ-2-1\n\n"
        "Имена студентов и преподавателей вымышлены. Расписание основано на открытых данных НГТУ. "
        "Дела, посещаемость и оценки созданы для показа. Изменения сохраняются в браузере.\n",
        encoding="utf-8",
    )
    print(f"Собрано файлов: {len(FILES) + 3}. Каталог: {target}")


if __name__ == "__main__":
    main()

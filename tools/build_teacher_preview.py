"""Собрать публичное демо только из разрешённых файлов, без исходников сервера и личных данных."""
import csv
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    "index.html", "manifest.webmanifest", "sw.js", "demo/group.json",
    "css/app.css", "css/tokens.css",
    "js/app.js", "js/api.js", "js/nntu.js", "js/xlsx.js",
    "assets/icon.png", "assets/icons.woff2", "assets/icons-fill.woff2",
    "assets/onest-cyrillic.woff2", "assets/onest-latin.woff2",
    "assets/unbounded-cyrillic.woff2", "assets/unbounded-latin.woff2",
]


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "teacher-preview"
    roster_csv = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    local_public = Path(sys.argv[3]) if len(sys.argv) > 3 else None
    if local_public and not roster_csv:
        raise SystemExit("Для сверки локального состава нужна выгрузка CSV")
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
    # Без частной выгрузки публикуется только имя старосты; CSV не копируется в сборку.
    leaders = [s for s in data["students"] if s.get("id") == "90a6f10b02"]
    if len(leaders) != 1:
        raise SystemExit("Не найден профиль старосты для публичного примера")
    for s in data["students"]:
        s["role"] = "head" if s is leaders[0] else ""
    leaders[0]["name"] = "Юнусов Артём"
    data["settings"]["preview_real_leader"] = True
    data["settings"]["preview_version"] = 3
    if roster_csv:
        with roster_csv.open(encoding="utf-8-sig", newline="") as f:
            names = [row[1].strip() for row in csv.reader(f, delimiter=";") if len(row) > 1 and row[0].strip().isdigit()]
        if (len(names) != len(data["students"]) or len(set(names)) != len(names)
                or names[7] != "Германскова Екатерина" or names[-1] != "Юнусов Артём"):
            raise SystemExit("Состав в выгрузке не совпадает с проверенной группой")
        for s, name in zip(data["students"], names):
            s["name"] = name
            s["role"] = "head" if name == "Юнусов Артём" else "deputy" if name == "Германскова Екатерина" else ""
        data["settings"]["preview_real_roster"] = True
    if local_public:
        local = json.loads(local_public.read_text(encoding="utf-8"))
        students = local.get("students", [])
        if ([s.get("name") for s in students] != names or len({s.get("id") for s in students}) != len(names)
                or local.get("settings", {}).get("group") != "26-ИВТ-2-1"
                or sum(s.get("role") == "head" for s in students) != 1
                or next(s for s in students if s.get("role") == "head")["name"] != "Юнусов Артём"):
            raise SystemExit("Локальный состав не совпадает с проверенной выгрузкой")
        data["students"] = [{"id": s["id"], "name": s["name"], "role": s.get("role", ""),
                             "subgroup": s.get("subgroup", 0), "subgroups": s.get("subgroups", {}),
                             "phone": "", "email": "", "telegram": "", "birthday": "", "note": ""} for s in students]
        data["teachers"] = [{"id": t["id"], "name": t["name"]} for t in local.get("teachers", [])]
        data["lessons"] = [{k: l[k] for k in ("id", "subject", "day", "num", "week", "kind", "room", "teacher") if k in l}
                           for l in local.get("lessons", [])]
        if len(data["teachers"]) != 16 or len(data["lessons"]) != 28:
            raise SystemExit("Локальное расписание не совпадает с ожидаемым составом")
        for k in ("bells", "subgroup_count", "own_split", "subgroup_subject_counts"):
            if k in local["settings"]:
                data["settings"][k] = local["settings"][k]
        data["settings"]["preview_from_local"] = True
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
    (target / "js/config.js").write_text("// Публичный просмотр: аккаунты и почта не подключены.\nwindow.STAROSTA_PREVIEW = true;\nwindow.STAROSTA_PREVIEW_VERSION = 3;\n", encoding="utf-8")
    manifest = json.loads((target / "manifest.webmanifest").read_text(encoding="utf-8"))
    manifest["start_url"] = "./#demo"
    (target / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sw = (target / "sw.js").read_text(encoding="utf-8").replace('"privacy.html", ', "")
    (target / "sw.js").write_text(sw, encoding="utf-8")
    (target / ".nojekyll").write_text("", encoding="utf-8")
    roster_note = ("ФИО, подгруппы, роли и расписание взяты из локального приложения." if local_public else
                   "ФИО 37 студентов взяты из выгрузки состава группы." if roster_csv else
                   "Староста — Юнусов Артём; имена остальных студентов вымышлены.")
    (target / "README.md").write_text(f"# Помощник старосты — демонстрация группы 26-ИВТ-2-1\n\n{roster_note} Расписание основано на открытых данных НГТУ. Дела, посещаемость и оценки созданы случайно для показа и не отражают реальные результаты студентов. Контактов студентов нет. Аккаунты, почта и сервер в этой версии отключены.\n\nОсновной проект разрабатывается отдельно; данные, которые вы вводите здесь, остаются в вашем браузере.\n", encoding="utf-8")
    print(f"Собрано файлов: {len(FILES) + 3}. Каталог: {target}")


if __name__ == "__main__":
    main()

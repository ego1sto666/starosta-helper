"""Пересобрать облегчённые шрифты значков (tools/fonts → assets/icons*.woff2).

Значки — Phosphor Icons (MIT): обычный (линии) и залитый (активный пункт меню).
В assets попадают только коды из таблицы ICON в js/app.js и значки, вписанные прямо
в index.html и css/app.css: полный набор весит ~0,5 МБ, нужная часть — несколько КБ.
Имена значков Phosphor и их коды — в tools/fonts/phosphor-names.json (см. phosphoricons.com).

Текстовые шрифты (Onest, Unbounded — переменные, с Google Fonts) лежат в assets готовыми.

Запуск из корня проекта (нужен fonttools с brotli):
    pip install fonttools brotli
    python tools/subset_fonts.py
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "fonts"
OUT = ROOT / "assets"


def icon_codes():
    code = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
    table = re.search(r"const ICON = \{(.*?)\};", code, re.S)
    if not table:
        sys.exit("Не нашёл таблицу ICON в js/app.js")
    codes = set(re.findall(r'"(E[0-9A-F]{3})"', table.group(1)))
    for f in ("index.html", "css/app.css"):  # значки, вписанные прямо в разметку и стили
        text = (ROOT / f).read_text(encoding="utf-8")
        for html_code, css_code in re.findall(r"&#x(E[0-9A-Fa-f]{3});|\\(E[0-9A-Fa-f]{3})\b", text):
            codes.add((html_code or css_code).upper())
    return sorted(codes)


def subset(src, out, unicodes, *extra):
    subprocess.run([sys.executable, "-m", "fontTools.subset", str(src), f"--unicodes={unicodes}",
                    "--flavor=woff2", f"--output-file={out}", *extra], check=True)
    print(f"{out.name}: {out.stat().st_size / 1024:.1f} КБ")


codes = icon_codes()
print(f"Значков: {len(codes)}")
uni = ",".join("U+" + c for c in codes)
subset(SRC / "Phosphor.ttf", OUT / "icons.woff2", uni, "--no-hinting")
subset(SRC / "Phosphor-Fill.ttf", OUT / "icons-fill.woff2", uni, "--no-hinting")

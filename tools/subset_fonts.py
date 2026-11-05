"""Пересобрать облегчённые шрифты сайта из полных (tools/fonts → assets/*.woff2).

Значки: в assets/icons.woff2 попадают только коды из таблицы ICON в js/app.js
(полный набор Material Design Icons весит 1,3 МБ, нужная часть — несколько КБ).
Roboto: только латиница, кириллица и типографские знаки.

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
TEXT = "U+0020-007E,U+00A0-00FF,U+0401,U+0410-044F,U+0451,U+2010-2027,U+2030-203A,U+20AC,U+2116,U+2190-2193,U+2212"


def icon_codes():
    code = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
    table = re.search(r"const ICON = \{(.*?)\};", code, re.S)
    if not table:
        sys.exit("Не нашёл таблицу ICON в js/app.js")
    codes = set(re.findall(r'"(F[0-9A-F]{4})"', table.group(1)))
    for f in ("index.html", "css/app.css"):  # значки, вписанные прямо в разметку и стили
        text = (ROOT / f).read_text(encoding="utf-8")
        for html_code, css_code in re.findall(r"&#x(F[0-9A-Fa-f]{4});|\\(F[0-9A-Fa-f]{4})", text):
            codes.add((html_code or css_code).upper())
    return sorted(codes)


def subset(src, out, unicodes, *extra):
    subprocess.run([sys.executable, "-m", "fontTools.subset", str(src), f"--unicodes={unicodes}",
                    "--flavor=woff2", f"--output-file={out}", *extra], check=True)
    print(f"{out.name}: {out.stat().st_size / 1024:.1f} КБ")


codes = icon_codes()
print(f"Значков: {len(codes)}")
subset(SRC / "materialdesignicons-webfont.ttf", OUT / "icons.woff2", ",".join("U+" + c for c in codes), "--no-hinting")
for weight in ("Medium", "Black"):
    subset(SRC / f"Roboto-{weight}.ttf", OUT / f"Roboto-{weight}.woff2", TEXT, "--layout-features=kern,liga")

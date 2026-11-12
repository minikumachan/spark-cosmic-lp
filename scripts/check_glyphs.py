#!/usr/bin/env python3
"""組み立てた LP で表示する日本語の字が、配る Zen Kaku Gothic New に全部入っているかを確かめる関門。

  欠けた字は端末の書体で描かれ、同じ行の中で書体が混ざる。
  （2026-11-12 に、6/20 に切り詰めた書体から「惑星図鑑」「銀河」「旅」など 300 字余りが欠けているのを見つけた）
  見る字   : dist/ の HTML・JS・CSS・JSON に出てくる U+3000〜U+FFFF の字（かな・漢字・全角・約物）。
             scripts/subset_fonts.py が書体に入れる字と同じ拾い方にしてある。
  見る書体 : dist/_astro/*.css の @font-face で Zen Kaku Gothic New に当てた woff2（dist の実物）。
  答え     : 通った（欠け 0）／落ちた（欠けた字を出す）／判定できない（書体・字が見つからない、
             またはわざと 1 字抜いた試しで欠けを見つけられない）。終了コードは 0／1／2。
使い方 : npm run build の後に npm run check:glyphs（要 fonttools[woff]）
"""
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def cannot_judge(msg: str) -> None:
    print(f"判定できない: {msg}")
    sys.exit(2)


def used_chars(dist: Path) -> tuple[set[str], int]:
    files = [p for ext in ("html", "js", "css", "json") for p in dist.rglob(f"*.{ext}")]
    chars: set[str] = set()
    for f in files:
        text = f.read_text(encoding="utf-8", errors="ignore")
        chars |= {c for c in text if 0x3000 <= ord(c) <= 0xFFFF and c.isprintable()}
    return chars, len(files)


def missing(chars: set[str], cmap: set[int]) -> list[str]:
    return sorted(c for c in chars if ord(c) not in cmap)


if not (DIST / "index.html").exists():
    cannot_judge("dist/index.html が無い（先に npm run build）")

css = "".join(p.read_text(encoding="utf-8") for p in (DIST / "_astro").glob("*.css"))
urls = sorted(set(re.findall(r'font-family:\s*"?Zen Kaku Gothic New"?\s*;\s*src:\s*url\(\s*"?([^)"]+)"?\s*\)', css)))
if len(urls) == 0:
    cannot_judge("組み立てた CSS に Zen Kaku Gothic New の @font-face が見つからない")

chars, nfiles = used_chars(DIST)
print(f"見たファイル {nfiles} 本 / 見た字 {len(chars)} 字（0 なら見ていない）/ 書体 {len(urls)} 本")
if len(chars) == 0:
    cannot_judge("日本語の字が 1 字も見つからない")

fonts = []
for u in urls:
    path = DIST / u.lstrip("/")
    if not path.exists():
        cannot_judge(f"書体のファイルが無い: {u}")
    fonts.append((u, {cp for cp in TTFont(path).getBestCmap()}))

# わざと 1 字抜いて、欠けを見つけられるかを先に試す（見張りが本当に見ているかの証明）
probe = sorted(chars)[0]
trial = missing(chars, fonts[0][1] - {ord(probe)})
if probe not in trial:
    cannot_judge(f"わざと「{probe}」を抜いた試しで欠けを見つけられなかった")
print(f"わざと「{probe}」を抜いた試し: 見つけた（見つけるのが正しい）")

bad = 0
for u, cmap in fonts:
    miss = missing(chars, cmap)
    name = u.rsplit("/", 1)[-1]
    if miss:
        bad += 1
        print(f"× {name}: 欠けた字 {len(miss)} 字 … {''.join(miss[:80])}{' …' if len(miss) > 80 else ''}")
    else:
        print(f"○ {name}: 欠けた字 0 字")

if bad:
    print(f"落ちた: {bad} 本の書体に欠けがある。npm run build → py scripts/subset_fonts.py → npm run build で作り直す")
    sys.exit(1)
print("通った")

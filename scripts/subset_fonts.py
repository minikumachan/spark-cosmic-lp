#!/usr/bin/env python3
"""Zen Kaku Gothic New を、本サイトで実際に表示する字形だけにサブセット化する。

  原本 : fonts-src/ZenKakuGothicNew-{w}.woff2              （フル日本語グリフ・各 ~950KB）
  出力 : public/fonts/ZenKakuGothicNew-{w}.{hash8}.woff2   （サブセット・各 ~数十KB）

収集元 : dist/ の HTML（全部の字）と JS・CSS・JSON（U+3000〜U+FFFF の字）＝組み立て後に実際に表示される文字。
  2026-06-20 版は src/ の全テキスト（注釈を含む）と dist の HTML を見ていたが、その後に足した宇宙の版の文言
  （惑星図鑑・銀河・旅 など 300 字余り）が入らず、その字だけ端末の書体で描かれていた（2026-11-12 に直した）。
  注釈の字は表示されないので入れない。JS の中の文字列（3D の札・左下の日付など）は dist の JS から拾う。
  拾い方は scripts/check_glyphs.py（欠けの関門）と同じにしてある。
安全マージン : ASCII / Latin-1 / かな全域 / 約物 / 全角英数（小さいので丸ごと含める）。
ファイル名 : 中身の hash を付ける。/fonts/* は 1 年キャッシュされるので、同じ名前で中身を変えると、
  前に来た人のブラウザに古い書体が残る。名前が変わったら fonts.css と Base.astro の参照も書き換える。
手順 : npm run build → py scripts/subset_fonts.py → npm run build → npm run check:glyphs（要 fonttools[woff]）。
"""
import hashlib
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# Windows コンソール(cp932)でも UTF-8 で出力する
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
WEIGHTS = [400, 700, 900]
REFS = [ROOT / "src" / "styles" / "fonts.css", ROOT / "src" / "layouts" / "Base.astro"]

if not (DIST / "index.html").exists():
    sys.exit("dist/index.html が無い。先に npm run build を走らせる")

# ── 1. 使用文字の収集 ───────────────────────────────────────────
chars: set[str] = set()
html = list(DIST.rglob("*.html"))
for f in html:
    chars |= set(f.read_text(encoding="utf-8", errors="ignore"))
other = [p for ext in ("js", "css", "json") for p in DIST.rglob(f"*.{ext}")]
for f in other:
    text = f.read_text(encoding="utf-8", errors="ignore")
    chars |= {c for c in text if 0x3000 <= ord(c) <= 0xFFFF}
print(f"見たファイル HTML {len(html)} 本 / JS・CSS・JSON {len(other)} 本")

# ── 2. 安全マージン（範囲ごと丸ごと包含） ────────────────────────
SAFE_RANGES = [
    (0x0020, 0x007E),  # ASCII 印字可能
    (0x00A0, 0x00FF),  # Latin-1 補助（©, ®, é 等）
    (0x2010, 0x2027),  # ハイフン/ダッシュ/各種引用符
    (0x2030, 0x205E),  # ‰ † ‡ • … 〜 等
    (0x2190, 0x2193),  # ← ↑ → ↓
    (0x25A0, 0x25FF),  # 幾何記号（■ ● ▶ 等）
    (0x2605, 0x2606),  # ★ ☆
    (0x3000, 0x303F),  # CJK 記号・約物（、。「」『』（）・ー 等）
    (0x3040, 0x309F),  # ひらがな全域
    (0x30A0, 0x30FF),  # カタカナ全域
    (0xFF00, 0xFFEF),  # 全角英数・記号・半角カナ
]
for a, b in SAFE_RANGES:
    chars.update(chr(cp) for cp in range(a, b + 1))

chars = {c for c in chars if c.isprintable()}
charset = "".join(sorted(chars))
charset_file = ROOT / "scripts" / "_charset.txt"
charset_file.write_text(charset, encoding="utf-8")
cjk = sum(1 for c in chars if ord(c) >= 0x3000)
print(f"collected {len(chars)} codepoints (CJK/kana/symbol ~ {cjk})")

# ── 3. サブセット実行（woff2 出力・名前に中身の hash） ─────────────
total_before = total_after = 0
names: dict[int, str] = {}
out_dir = ROOT / "public" / "fonts"
with tempfile.TemporaryDirectory() as tmp:
    for w in WEIGHTS:
        src = ROOT / "fonts-src" / f"ZenKakuGothicNew-{w}.woff2"
        work = Path(tmp) / f"ZenKakuGothicNew-{w}.woff2"
        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", str(src),
                f"--output-file={work}",
                "--flavor=woff2",
                f"--text-file={charset_file}",
                "--layout-features=*",   # palt/kern 等を保持
                "--drop-tables+=DSIG",
                "--no-hinting",
            ],
            check=True,
        )
        data = work.read_bytes()
        name = f"ZenKakuGothicNew-{w}.{hashlib.sha256(data).hexdigest()[:8]}.woff2"
        for old in out_dir.glob(f"ZenKakuGothicNew-{w}*.woff2"):
            if old.name != name:
                old.unlink()
                print(f"  消した: {old.name}")
        (out_dir / name).write_bytes(data)
        names[w] = name
        before = src.stat().st_size
        total_before += before
        total_after += len(data)
        print(f"  {name}: {before/1024:7.1f}KB -> {len(data)/1024:6.1f}KB  ({len(data)/before*100:4.1f}%)")

print(f"TOTAL: {total_before/1024:.1f}KB -> {total_after/1024:.1f}KB "
      f"(-{(1-total_after/total_before)*100:.1f}%)")

# ── 4. 参照を新しい名前に書き換える ─────────────────────────────
pattern = re.compile(r"ZenKakuGothicNew-(400|700|900)(?:\.[0-9a-f]{8})?\.woff2")
for ref in REFS:
    with open(ref, encoding="utf-8", newline="") as fh:
        text = fh.read()
    new, count = pattern.subn(lambda m: names[int(m.group(1))], text)
    if count == 0:
        sys.exit(f"参照が見つからない: {ref.relative_to(ROOT)}")
    if new != text:
        with open(ref, "w", encoding="utf-8", newline="") as fh:
            fh.write(new)
    print(f"  参照 {ref.relative_to(ROOT)}: {count} 箇所（{'書き換えた' if new != text else '変わらず'}）")

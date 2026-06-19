#!/usr/bin/env python3
"""Zen Kaku Gothic New を、本サイトで実際に使う字形だけにサブセット化する。

  原本 : fonts-src/ZenKakuGothicNew-{w}.woff2   （フル日本語グリフ・各 ~950KB）
  出力 : public/fonts/ZenKakuGothicNew-{w}.woff2 （サブセット・各 ~数十KB）

収集元 : dist/**/*.html（レンダリング済み最終出力＝権威ソース）＋ src/ 全テキスト。
安全マージン : ASCII / Latin-1 / かな全域 / 約物 / 全角英数（小さいので丸ごと含める）。
これにより本文で使う漢字だけに絞り込みつつ、将来の軽微な文言変更にも耐える。
再実行可能： `py scripts/subset_fonts.py`（要 fonttools[woff]）。
"""
import subprocess
import sys
from pathlib import Path

# Windows コンソール(cp932)でも UTF-8 で出力する
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
WEIGHTS = [400, 700, 900]

# ── 1. 使用文字の収集 ───────────────────────────────────────────
sources = [
    *ROOT.joinpath("dist").rglob("*.html"),
    *ROOT.joinpath("src").rglob("*.astro"),
    *ROOT.joinpath("src").rglob("*.ts"),
    *ROOT.joinpath("src").rglob("*.tsx"),
    *ROOT.joinpath("src").rglob("*.yaml"),
    *ROOT.joinpath("src").rglob("*.yml"),
    *ROOT.joinpath("src").rglob("*.md"),
]
chars: set[str] = set()
for f in sources:
    try:
        chars |= set(f.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"  skip {f}: {e}")

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

# ── 3. サブセット実行（woff2 出力） ─────────────────────────────
total_before = total_after = 0
for w in WEIGHTS:
    src = ROOT / "fonts-src" / f"ZenKakuGothicNew-{w}.woff2"
    out = ROOT / "public" / "fonts" / f"ZenKakuGothicNew-{w}.woff2"
    before = src.stat().st_size
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(src),
            f"--output-file={out}",
            "--flavor=woff2",
            f"--text-file={charset_file}",
            "--layout-features=*",   # palt/kern 等を保持
            "--drop-tables+=DSIG",
            "--no-hinting",
        ],
        check=True,
    )
    after = out.stat().st_size
    total_before += before
    total_after += after
    print(f"  ZenKaku-{w}: {before/1024:7.1f}KB -> {after/1024:6.1f}KB  ({after/before*100:4.1f}%)")

print(f"TOTAL: {total_before/1024:.1f}KB -> {total_after/1024:.1f}KB "
      f"(-{(1-total_after/total_before)*100:.1f}%)")

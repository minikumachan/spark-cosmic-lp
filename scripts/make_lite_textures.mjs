// 軽い描き方の端末向けに、大きすぎる惑星の絵を縮めた版を作る。版は 2 つ。
//
// lite … 軽量ティア（スマホ・非力な端末。tier.ts の LITE）。横 2048 まで。
//   惑星の絵は gpu.ts で ImageBitmap として持つ。ImageBitmap は展開した絵をメモリに持ち続け、
//   ブラウザが手放せない（<img> の展開結果は手放せる）。全部で約 164MB あり、スマホではタブが落ちる元になる。
//   軽量ティアの 3D は等倍（dpr 1）で描くので、横 2048 を超える絵は縮めても見た目が変わらない。
//
// soft … GPU を使わずに描いている端末（tier.ts の SOFT_GPU）。横 512 まで。
//   この端末では絵を GPU へ送る処理も CPU がするので、横 2048 の絵 1 枚で頁が 0.05〜0.15 秒止まっていた
//   （2026-11-12 に SwiftShader で測った）。横 512 なら 1 枚あたりの量は 1/16 になる。
//   絵は少しぼやけるが、この端末ではそもそも 3D は滑らかに動かないので、止まらない方を採る。
//
// 使い方: node scripts/make_lite_textures.mjs
// 出力: public/assets/planet/<版>/<名前>.webp と、どの絵に縮めた版があるかの一覧
//       src/components/three/cosmic/<版>-textures.json（gpu.ts が読む。手で書かない）
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "public/assets/planet");
const TIERS = [
  { dir: "lite", max: 2048, quality: 88 },
  { dir: "soft", max: 512, quality: 85 },
];

for (const { dir, max, quality } of TIERS) {
  const outDir = path.join(srcDir, dir);
  const listFile = path.join(
    root,
    `src/components/three/cosmic/${dir}-textures.json`,
  );
  fs.mkdirSync(outDir, { recursive: true });
  const names = [];
  let seen = 0;
  for (const f of fs.readdirSync(srcDir).sort()) {
    if (!f.endsWith(".webp")) continue;
    seen++;
    const src = path.join(srcDir, f);
    const { width, height } = await sharp(src).metadata();
    if (!width || width <= max) continue;
    const out = path.join(outDir, f);
    await sharp(src)
      .resize({ width: max, kernel: "lanczos3" })
      .webp({ quality, effort: 6 })
      .toFile(out);
    const m = await sharp(out).metadata();
    const name = f.replace(/\.webp$/, "");
    names.push(name);
    console.log(
      `${dir}: ${f}: ${width}x${height} ${(fs.statSync(src).size / 1024).toFixed(0)}KB → ${m.width}x${m.height} ${(fs.statSync(out).size / 1024).toFixed(0)}KB`,
    );
  }
  // 一覧に無い古い縮めた版は消す（元の絵が縮める必要の無い大きさに変わった時など）
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith(".webp") && !names.includes(f.replace(/\.webp$/, ""))) {
      fs.unlinkSync(path.join(outDir, f));
      console.log(`消した: ${dir}/${f}`);
    }
  }
  fs.writeFileSync(listFile, JSON.stringify(names, null, 2) + "\n");
  console.log(
    `${dir}: webp ${seen} 枚のうち ${names.length} 枚を縮めた → ${path.relative(root, listFile)}`,
  );
}

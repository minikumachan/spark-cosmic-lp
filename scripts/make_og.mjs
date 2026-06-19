// ブランドOG画像(1200×630)を生成する。
//   フォントを base64 で埋め込んだ自己完結HTMLを Edge headless でスクショ → sharp で最適化。
//   ブランドフォント(Clash Display / Zen Kaku 900 / JetBrains Mono)で正確に描画する。
//   Firefly でリッチ版に差し替えるまでの本番品質プレースホルダ（og:image 404 を解消）。
// 実行: node scripts/make_og.mjs   （portable Node22 を PATH 前置）
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import sharp from "sharp";

const pexec = promisify(execFile);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FONTS = join(ROOT, "public", "fonts");
const OUT_DIR = join(ROOT, "public", "assets", "og");
const TMP_HTML = join(ROOT, "scripts", "og", "_og.html");
const RAW_PNG = join(ROOT, "scripts", "og", "_og_raw.png");
const OUT_PNG = join(OUT_DIR, "og-default.png");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const b64 = async (f) => (await readFile(join(FONTS, f))).toString("base64");
const [clash700, zen900, mono500] = await Promise.all([
  b64("ClashDisplay-700.woff2"),
  b64("ZenKakuGothicNew-900.woff2"),
  b64("JetBrainsMono-500.woff2"),
]);

const face = (family, b, weight) =>
  `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b}) format("woff2");font-weight:${weight};font-display:block;}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${face("Clash Display", clash700, 700)}
${face("Zen Kaku Gothic New", zen900, 900)}
${face("JetBrains Mono", mono500, 500)}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:1200px;height:630px;overflow:hidden;}
.og{position:relative;width:1200px;height:630px;background:#ffffff;
  background-image:
    radial-gradient(ellipse 55% 50% at 82% 22%, rgba(7,87,255,.20), transparent 60%),
    radial-gradient(ellipse 50% 60% at 10% 18%, rgba(255,47,143,.12), transparent 58%),
    radial-gradient(ellipse 70% 55% at 60% 102%, rgba(155,232,0,.12), transparent 60%);
  padding:88px 96px;}
.orb{position:absolute;right:-60px;top:50%;transform:translateY(-50%);
  width:520px;height:520px;border-radius:50%;filter:blur(2px);
  background:
    radial-gradient(circle at 34% 30%, #79c6ff, transparent 55%),
    radial-gradient(circle at 72% 74%, #854dff, transparent 60%),
    #0757ff;
  box-shadow:0 40px 120px rgba(7,87,255,.35);opacity:.96;}
.eyebrow{font-family:"JetBrains Mono",monospace;font-weight:500;font-size:24px;
  letter-spacing:.32em;text-transform:uppercase;color:#0757ff;}
.brand{position:absolute;left:96px;bottom:84px;display:flex;align-items:baseline;gap:18px;}
.brand .mark{font-family:"Clash Display",sans-serif;font-weight:700;font-size:56px;color:#0b1230;letter-spacing:-.02em;}
.brand .tag{font-family:"JetBrains Mono",monospace;font-weight:500;font-size:20px;color:#68708a;letter-spacing:.04em;}
.head{font-family:"Zen Kaku Gothic New",sans-serif;font-weight:900;
  font-size:96px;line-height:1.06;letter-spacing:-.02em;color:#0b1230;margin-top:120px;
  position:relative;z-index:2;text-shadow:0 1px 0 rgba(255,255,255,.6);}
.head .accent{color:#0757ff;}
</style></head><body>
<div class="og">
  <div class="orb"></div>
  <div class="eyebrow">Creative Studio</div>
  <h1 class="head">ブランドも、体験も、<br><span class="accent">次のステージへ。</span></h1>
  <div class="brand"><span class="mark">spark</span><span class="tag">spark.studio</span></div>
</div>
</body></html>`;

await mkdir(join(ROOT, "scripts", "og"), { recursive: true });
await mkdir(OUT_DIR, { recursive: true });
await writeFile(TMP_HTML, html, "utf8");

await pexec(EDGE, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1200,630",
  `--screenshot=${RAW_PNG}`,
  `file:///${TMP_HTML.replace(/\\/g, "/")}`,
]);

// sharp で 1200×630 に正規化＋PNG最適化（OGは PNG/JPG が安全。WebP/AVIF はスクレイパ非対応あり）
const meta = await sharp(RAW_PNG).metadata();
await sharp(RAW_PNG)
  .resize(1200, 630, { fit: "cover", position: "left top" })
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(OUT_PNG);
const outMeta = await sharp(OUT_PNG).metadata();
const { size } = await sharp(OUT_PNG).toBuffer({ resolveWithObject: true }).then((r) => ({ size: r.info.size }));
console.log(`raw ${meta.width}x${meta.height} -> og-default.png ${outMeta.width}x${outMeta.height} (${(size / 1024).toFixed(1)}KB)`);

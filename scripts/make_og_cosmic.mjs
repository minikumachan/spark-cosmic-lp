// コズミック版 OG 画像(1200×630)を生成。
//   フォントを base64 埋め込みの自己完結HTMLを Playwright(chromium) でスクショ → sharp 最適化。
// 実行: node scripts/make_og_cosmic.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FONTS = join(ROOT, "public", "fonts");
const OUT_DIR = join(ROOT, "public", "assets", "og");
const RAW_PNG = join(ROOT, "scripts", "og", "_cosmic_raw.png");
const OUT_PNG = join(OUT_DIR, "og-default.png");

const b64 = async (f) => (await readFile(join(FONTS, f))).toString("base64");
const [zen900, clash700, mono500] = await Promise.all([
  b64("ZenKakuGothicNew-900.woff2"),
  b64("ClashDisplay-700.woff2"),
  b64("JetBrainsMono-500.woff2"),
]);
const face = (family, b, weight) =>
  `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b}) format("woff2");font-weight:${weight};font-display:block;}`;

// 散らした星
let stars = "";
const seed = [13, 71, 29, 97, 41, 7, 83, 53, 19, 61, 37, 89, 23, 67, 3, 79, 47, 11, 59, 31];
for (let i = 0; i < 90; i++) {
  const x = (seed[i % 20] * (i + 7) * 13.7) % 1200;
  const y = (seed[(i + 5) % 20] * (i + 3) * 9.3) % 630;
  const s = ((i % 3) + 1) * 0.9;
  const o = 0.25 + ((i * 37) % 60) / 100;
  stars += `<i style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${s}px;height:${s}px;opacity:${o.toFixed(2)}"></i>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${face("Zen Kaku Gothic New", zen900, 900)}
${face("Clash Display", clash700, 700)}
${face("JetBrains Mono", mono500, 500)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
.og{position:relative;width:1200px;height:630px;background:#05060d;
  background-image:
    radial-gradient(ellipse 60% 55% at 80% 30%, rgba(86,96,230,.30), transparent 60%),
    radial-gradient(ellipse 55% 60% at 12% 84%, rgba(190,44,150,.20), transparent 56%),
    radial-gradient(ellipse 70% 50% at 55% 8%, rgba(7,87,255,.14), transparent 60%),
    radial-gradient(circle at 50% 45%, #0a0c1c, #05060d 80%);
  overflow:hidden;font-family:"Zen Kaku Gothic New",sans-serif}
.stars i{position:absolute;border-radius:50%;background:#dce8ff;box-shadow:0 0 4px rgba(180,210,255,.7)}
/* 惑星(右) */
.planet{position:absolute;right:-90px;top:50%;transform:translateY(-50%);width:560px;height:560px;border-radius:50%;
  background:
    radial-gradient(circle at 36% 30%, #8fd0ff 0%, #4a86d8 26%, #1f4f94 52%, #0b2350 78%, #061230 100%),
    radial-gradient(circle at 70% 72%, rgba(120,90,255,.5), transparent 55%);
  box-shadow: inset -40px -30px 90px rgba(0,0,0,.55), 0 0 120px rgba(86,120,255,.35);}
.planet::after{content:"";position:absolute;inset:-26px;border-radius:50%;
  background:radial-gradient(circle, transparent 62%, rgba(95,184,255,.35) 70%, transparent 78%);}
.atmo{position:absolute;right:-130px;top:50%;transform:translateY(-50%);width:640px;height:640px;border-radius:50%;
  background:radial-gradient(circle, transparent 60%, rgba(86,150,255,.16) 72%, transparent 80%);}
/* 内容(左) */
.content{position:absolute;left:96px;top:0;height:630px;width:660px;display:flex;flex-direction:column;justify-content:center;gap:0;z-index:2}
.eyebrow{font-family:"JetBrains Mono",monospace;font-size:21px;letter-spacing:.42em;text-transform:uppercase;color:#9db4ff;margin-bottom:26px}
h1{font-weight:900;font-size:70px;line-height:1.18;color:#fff;letter-spacing:.005em;white-space:nowrap;text-shadow:0 4px 30px rgba(0,0,0,.5)}
h1 .accent{color:#7fb2ff}
.foot{display:flex;align-items:center;gap:22px;margin-top:44px}
.brand{font-family:"Clash Display",sans-serif;font-weight:700;font-size:34px;color:#fff;letter-spacing:.02em}
.brand b{color:#7fb2ff;font-weight:700}
.url{font-family:"JetBrains Mono",monospace;font-size:20px;color:#8b93c4;letter-spacing:.04em}
.bar{width:1px;height:30px;background:rgba(160,175,255,.3)}
</style></head><body>
<div class="og">
  <div class="stars">${stars}</div>
  <div class="atmo"></div>
  <div class="planet"></div>
  <div class="content">
    <p class="eyebrow">Creative Studio</p>
    <h1>ブランドも、体験も、<br><span class="accent">次のステージへ。</span></h1>
    <div class="foot">
      <span class="brand"><b>✦</b> spark</span>
      <span class="bar"></span>
      <span class="url">spark-lp.pages.dev</span>
    </div>
  </div>
</div>
</body></html>`;

await mkdir(join(ROOT, "scripts", "og"), { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: RAW_PNG });
await browser.close();

await sharp(RAW_PNG).resize(1200, 630).png({ quality: 90, compressionLevel: 9 }).toFile(OUT_PNG);
console.log("OG written:", OUT_PNG);

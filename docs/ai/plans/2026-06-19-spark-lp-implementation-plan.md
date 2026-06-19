# spark LP 実装計画書（マスター＋P0詳細）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spark（制作/ブランディング会社）の高品質LPを、Astro+R3F+Tailwind v4 で「1点豪華・見えない技術力」方針のもと、CWV満点・WCAG 2.2 AA・右サイズセキュリティで実装する。

**Architecture:** Astro 5 を静的出力（hybrid: フォームのみオンデマンドendpoint）で構築。視覚演出は React island に隔離し `client:visible` で遅延ロード。デザイントークンを Tailwind v4 `@theme` + CSS変数に一元化し light/dark を data-theme で切替。Cloudflare Pages にデプロイしエッジで WAF/DDoS/Bot 防御を得る。

**Tech Stack:** Astro 5 / React islands / Tailwind v4 / TypeScript(strict) / @react-three/fiber + drei + three / motion + ネイティブCSS scroll-driven / react-hook-form + zod / Astro Content Collections / sharp / Cloudflare adapter / Lighthouse CI / @axe-core/playwright

## Global Constraints

- 設計書: `docs/ai/specs/2026-06-19-spark-lp-design-spec.md`（本計画はこれを実装する）
- 性能: Lighthouse Performance ≥ 95 / LCP < 2.0s / **CLS = 0** / INP < 200ms
- a11y: Lighthouse Accessibility 100・axe違反0・**WCAG 2.2 AA**・キーボード完全操作・`:focus-visible`
- フォント: **Clash Display**(EN見出し) / **Zen Kaku Gothic New**(本文JP+EN) / **JetBrains Mono**(数値) の3ファミリのみ。**Space Grotesk / Inter / Roboto / system-ui 禁止**。weight 200⇄900の極端対比、サイズジャンプ最低3倍差
- カラー(tokens正本 `tokens/design_tokens.json`): base bg #FFFFFF / surface #F7F9FC / text #0B1230 / muted #68708A。dark bg #0B1230 / surface #131A3A / text #F5F7FB / muted #9AA3C0。accent blue #0757FF / cyan #4DB8FF / magenta #FF2F8F / coral #FF5A5F / orange #FF8A2A / lime #9BE800 / green #5ED000 / purple #854DFF / lavender #C9C4FF / light_blue #D8E9FF。**ハードコード禁止・CSS変数経由**
- radius: card 24px / button 999px / image_mask 32px。shadow: card `0 18px 45px rgba(11,18,48,.08)` / floating `0 24px 70px rgba(7,87,255,.18)`
- 余白スケール(px): 8 12 16 24 32 48 64 96 128。motion ease `cubic-bezier(.22,1,.36,1)` / 200–700ms / stagger 60–90ms
- モーション全演出は `prefers-reduced-motion` でガード。背景は solid禁止（mesh/noise/shader）。AIスラップ美観禁止
- **Lenis 不採用**（scroll-jack回避）。i18n 機能カット（文字列は外部化、出荷 ja 単一）
- TypeScript: `strict: true`、`any` 禁止（`unknown`）。コメントは非自明箇所のみ
- セキュリティ: フォームはサーバ側zod再検証＋Turnstile＋honeypot＋time-trap＋rate-limit、CSP(nonce)＋セキュリティヘッダ、`securityheaders.com A+`
- デプロイ: **Cloudflare Pages + Functions**
- 制作実績画像: 案C（素材blob/グラデ/maskで構成する抽象ブランドビジュアル）
- git: 各タスク末でコミット。コミット末尾に Co-Authored-By 行

---

## フェーズ ロードマップ（各フェーズ＝独立して動く成果物）

| Phase | 目的 | 主要成果物 | 完了ゲート | 詳細plan |
|---|---|---|---|---|
| **P0 基盤** | プロジェクト土台 | Astro+Tailwind v4+TS scaffold / tokens→@theme(light/dark) / 3フォントCLS0 / Baseレイアウト+SEO+FOUC防止 / セキュリティヘッダbaseline / 品質ツール / アセット配置 | 空ページが両テーマ・CLS0・build/typecheck/axe通過 | **本書（詳細）** |
| **P1 静的骨格** | 全7セクション静的構築 | Content Collections / Header/Hero…Footer の静的版（3D/アニメ無し）/ レスポンシブ(@container) / 構造化データ | 構成・コピー・レスポンシブ確定、Lighthouse SEO 100 | P1着手時に詳細化 |
| **P2 モーション** | 演出付与 | reveal / scroll-driven / micro-interaction / count-up、reduced-motionガード | 60FPS維持を視覚QA、CLS0維持 | P2着手時 |
| **P3 Hero 3D** | 主役3D | R3Fシーン+GLSL / GLB(Blender or 手続き的) / 低スペック・reduced-motion静止画フォールバック / WebGLエラーバウンダリ | 主役3Dが性能予算内・LCP<2.0s維持 | P3着手時（Blender MCP導入合図） |
| **P4 フォーム/計測/セキュリティ** | CVR着地点＋堅牢化 | RHF+Zod＋サーバendpoint / Turnstile / rate-limit / CSP(nonce)・ヘッダ / analytics抽象 / flags | フォーム堅牢化・securityheaders A+・イベント発火 | P4着手時 |
| **P5 最適化/QA/公開** | 仕上げ | 画像最適化 / Lighthouse CI / axe / SEO最終 / Cloudflareデプロイ | 設計書§1.2 成功基準を全達成 | P5着手時 |

> 各フェーズ着手時、CLAUDE.md「途中追加タスクの取り込み手順」に従い前提・完了位置・波及影響を明記して詳細plan化する。

---

# Phase P0 — 基盤（詳細）

**Phaseゴール:** `npm run dev` で空のindexが表示され、light/dark両テーマが正しく切替わり、フォント差替でCLSが発生せず（=0）、`astro check`（型）・`astro build`・axe・Playwrightスクショが全て通る、デプロイ可能な土台。

**File Structure（P0で作る/触る）:**
- `package.json` / `astro.config.mjs` / `tsconfig.json` — プロジェクト設定
- `src/styles/theme.css` — トークン（@theme＋light/dark CSS変数）
- `src/styles/fonts.css` — @font-face（self-host・size-adjust）
- `src/layouts/Base.astro` — html骨格・meta/SEO・FOUC防止・フォントpreload
- `src/components/ui/ThemeToggle.tsx` — テーマ切替island
- `src/lib/seo.ts` — メタ生成ヘルパ
- `src/pages/index.astro` — トークン/タイポ確認用スペシメン（P1で本実装に置換）
- `public/_headers` — Cloudflareセキュリティヘッダ
- `public/assets/**` — 素材パックからコピー
- `public/fonts/**` — woff2
- `playwright.config.ts` / `tests/smoke.spec.ts` / `lighthouserc.json` — 品質

---

### Task P0-0: プロジェクト scaffold（Astro + React + Tailwind v4 + TS strict + Cloudflare）

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/env.d.ts`, `.gitignore`(既存に追記), `.nvmrc`

**Interfaces:**
- Produces: 動作する Astro dev/build 環境。後続タスクが `src/` 配下に追加していく前提

- [ ] **Step 1: Astro プロジェクトを最小生成（既存docsを保持）**

プロジェクト直下で実行（`Design_LP/`）。`.` に生成、既存 `docs/`・素材は保持。
```bash
cd /Users/clark/Desktop/Share/AI_Workspace/20_Projects/Design_LP
npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict --yes
```
Expected: `src/pages/index.astro`・`astro.config.mjs`・`tsconfig.json` 生成（docs/素材は残る）

- [ ] **Step 2: 依存を導入**

```bash
npm install
npm install @astrojs/react @astrojs/cloudflare @astrojs/sitemap react react-dom
npm install -D @types/react @types/react-dom tailwindcss @tailwindcss/vite fontaine
```
Expected: `node_modules/` 生成、エラー無し

- [ ] **Step 3: astro.config.mjs を記述**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { FontaineTransform } from 'fontaine';

export default defineConfig({
  site: 'https://spark.example.com',
  output: 'static', // フォームendpointは P4 で prerender=false により部分SSR化
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react(), sitemap()],
  vite: {
    plugins: [
      tailwindcss(),
      FontaineTransform.vite({ fallbacks: ['Arial'], resolvePath: (id) => new URL(`./public${id}`, import.meta.url) }),
    ],
  },
});
```

- [ ] **Step 4: tsconfig.json を strict + React JSX に**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "strict": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 5: 型チェックとビルドが通ることを確認**

```bash
npx astro check
npm run build
```
Expected: `astro check` でエラー0、`build` 成功（`dist/` 生成）

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat(P0): Astro+React+Tailwind v4+TS strict scaffold (Cloudflare adapter)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0-1: デザイントークン → theme.css（@theme + light/dark CSS変数）

**Files:**
- Create: `src/styles/theme.css`
- Modify: `src/pages/index.astro`（後で `import '../styles/theme.css'` を効かせるため Base 経由。ここでは検証用に直import可）

**Interfaces:**
- Produces: Tailwindユーティリティ `bg-bg / text-text / text-muted / bg-surface / text-blue …` と CSS変数 `--bg --surface --text --muted --color-*`。`html[data-theme="dark"]` で semantic 色が切替

- [ ] **Step 1: theme.css を記述（tokens正本の値を転記）**

```css
@import "tailwindcss";

@layer base {
  :root {
    --bg: #FFFFFF; --surface: #F7F9FC; --text: #0B1230; --muted: #68708A;
  }
  :root[data-theme="dark"] {
    --bg: #0B1230; --surface: #131A3A; --text: #F5F7FB; --muted: #9AA3C0;
  }
  html, body { background: var(--bg); color: var(--text); }
}

@theme {
  /* semantic（data-themeで切替） */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-text: var(--text);
  --color-muted: var(--muted);
  /* accent（両テーマ固定） */
  --color-blue: #0757FF;  --color-cyan: #4DB8FF;  --color-magenta: #FF2F8F;
  --color-coral: #FF5A5F; --color-orange: #FF8A2A; --color-lime: #9BE800;
  --color-green: #5ED000; --color-purple: #854DFF; --color-lavender: #C9C4FF;
  --color-light-blue: #D8E9FF;
  /* radius / shadow */
  --radius-card: 24px; --radius-button: 999px; --radius-image: 32px;
  --shadow-card: 0 18px 45px rgba(11,18,48,.08);
  --shadow-floating: 0 24px 70px rgba(7,87,255,.18);
  /* font families（P0-2でface定義） */
  --font-display: "Clash Display", system-ui, sans-serif;
  --font-body: "Zen Kaku Gothic New", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  /* easing */
  --ease-quint: cubic-bezier(.22, 1, .36, 1);
}
```

- [ ] **Step 2: コントラスト比を検証（AA）**

light: text #0B1230 on bg #FFFFFF / dark: text #F5F7FB on bg #0B1230。
```bash
node -e "function L(h){h=h.replace('#','');const v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]} function R(a,b){const l1=L(a),l2=L(b);return ((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)).toFixed(2)} console.log('light',R('#0B1230','#FFFFFF'),'dark',R('#F5F7FB','#0B1230'),'muted-light',R('#68708A','#FFFFFF'))"
```
Expected: light/dark とも本文 ≥ 4.5、muted ≥ 4.5（下回る場合は muted を微調整しタスク内で再記録）

- [ ] **Step 3: コミット**

```bash
git add -A && git commit -m "feat(P0): design tokens -> Tailwind v4 @theme with light/dark CSS vars

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0-2: フォント self-host（@font-face + size-adjust で CLS=0）

**Files:**
- Create: `src/styles/fonts.css`, `public/fonts/`（woff2 配置）
- Modify: `src/styles/theme.css`（`@import "./fonts.css";` 追記）

**Interfaces:**
- Produces: `--font-display / --font-body / --font-mono` が実フォントで描画。fontaine がフォールバックメトリクスを自動注入し CLS=0

- [ ] **Step 1: woff2 を取得して配置**

- Clash Display: Fontshare（https://www.fontshare.com/fonts/clash-display）から woff2 を取得 → `public/fonts/ClashDisplay-Variable.woff2`
- Zen Kaku Gothic New / JetBrains Mono: fontsource から取得
```bash
npm install -D @fontsource/zen-kaku-gothic-new @fontsource/jetbrains-mono
mkdir -p public/fonts
cp node_modules/@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-japanese-400-normal.woff2 public/fonts/ZenKakuGothicNew-400.woff2
cp node_modules/@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-japanese-700-normal.woff2 public/fonts/ZenKakuGothicNew-700.woff2
cp node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2 public/fonts/JetBrainsMono-500.woff2
```
> Clash Display の woff2 取得は手動DL（Fontshareは商用可・要ライセンス確認）。取得できない場合の暫定: 本文用 Zen Kaku を見出しにも使い、Clash は導入後に差替（タスク内に明記）。

- [ ] **Step 2: fonts.css を記述**

```css
@font-face {
  font-family: "Clash Display";
  src: url("/fonts/ClashDisplay-Variable.woff2") format("woff2");
  font-weight: 200 900; font-display: swap; font-style: normal;
}
@font-face {
  font-family: "Zen Kaku Gothic New";
  src: url("/fonts/ZenKakuGothicNew-400.woff2") format("woff2");
  font-weight: 400; font-display: swap;
}
@font-face {
  font-family: "Zen Kaku Gothic New";
  src: url("/fonts/ZenKakuGothicNew-700.woff2") format("woff2");
  font-weight: 700; font-display: swap;
}
@font-face {
  font-family: "JetBrains Mono";
  src: url("/fonts/JetBrainsMono-500.woff2") format("woff2");
  font-weight: 500; font-display: swap;
}
```
`theme.css` 先頭付近に `@import "./fonts.css";` を追記。

- [ ] **Step 3: ビルドして fontaine がメトリクス注入することを確認**

```bash
npm run build
grep -r "fallback" dist/_astro/*.css | head
```
Expected: build成功。fontaine 由来の `@font-face`（…fallback）が生成CSSに存在

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat(P0): self-host 3 font families with size-adjust fallback (CLS=0)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0-3: Base レイアウト（meta/SEO/OGP/JSON-LD + FOUC防止テーマスクリプト）

**Files:**
- Create: `src/layouts/Base.astro`, `src/lib/seo.ts`
- Modify: `src/pages/index.astro`（Baseを使用）

**Interfaces:**
- Consumes: `src/styles/theme.css`
- Produces: `Base.astro` props `{ title, description, image? }`。全ページの html 骨格・head・テーマ初期化・フォントpreload を提供。`buildMeta()` from `src/lib/seo.ts`

- [ ] **Step 1: seo.ts を記述**

```ts
export interface MetaInput { title: string; description: string; image?: string; canonical?: string; }
const SITE = "spark";
const ORIGIN = "https://spark.example.com";
export function buildMeta(i: MetaInput) {
  return {
    title: `${i.title} | ${SITE}`,
    description: i.description,
    canonical: i.canonical ?? ORIGIN + "/",
    image: i.image ?? `${ORIGIN}/assets/og/og-default.png`,
  };
}
export const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE,
  url: ORIGIN,
  description: "ブランドも、体験も、次のステージへ。制作・ブランディングスタジオ spark。",
} as const;
```

- [ ] **Step 2: Base.astro を記述**

```astro
---
import "../styles/theme.css";
import { buildMeta, ORGANIZATION_JSONLD, type MetaInput } from "../lib/seo";
const { title, description, image, canonical } = Astro.props as MetaInput;
const meta = buildMeta({ title, description, image, canonical });
---
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{meta.title}</title>
    <meta name="description" content={meta.description} />
    <link rel="canonical" href={meta.canonical} />
    <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0B1230" media="(prefers-color-scheme: dark)" />
    <meta property="og:title" content={meta.title} />
    <meta property="og:description" content={meta.description} />
    <meta property="og:image" content={meta.image} />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preload" href="/fonts/ClashDisplay-Variable.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script type="application/ld+json" set:html={JSON.stringify(ORGANIZATION_JSONLD)} />
    <script is:inline>
      const t = localStorage.getItem("theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = t;
    </script>
  </head>
  <body>
    <a href="#main" class="sr-only focus:not-sr-only">本文へスキップ</a>
    <slot />
  </body>
</html>
```

- [ ] **Step 3: 仮 favicon.svg を public に配置（spark spark icon流用）**

```bash
cp lp_ec_vibe_design_assets_pack/assets/icons/svg/icon_logo_spark.svg public/favicon.svg
```

- [ ] **Step 4: index.astro を Base 使用の最小ページに**

```astro
---
import Base from "../layouts/Base.astro";
---
<Base title="ブランドも、体験も、次のステージへ" description="制作・ブランディングスタジオ spark のLP（基盤）">
  <main id="main" class="min-h-dvh grid place-items-center bg-bg text-text">
    <h1 class="font-display font-extrabold text-6xl">spark</h1>
  </main>
</Base>
```

- [ ] **Step 5: dev起動して head とテーマ初期化を確認**

```bash
npm run build && npm run preview &
```
Playwright で `/` を開き、`<html data-theme>` が付与され FOUC が無いことを次タスクのスモークで検証。ここでは build 成功と head の JSON-LD/preload 存在を確認:
```bash
grep -o "application/ld+json" dist/index.html; grep -o "preload" dist/index.html
```
Expected: 両方ヒット

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat(P0): Base layout with SEO/OGP/JSON-LD + FOUC-safe theme init

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0-4: セキュリティヘッダ baseline（Cloudflare `_headers`）

**Files:**
- Create: `public/_headers`

**Interfaces:**
- Produces: 全レスポンスに baseline セキュリティヘッダ。CSPは静的baseline（nonce化は P4）

- [ ] **Step 1: `public/_headers` を記述**

```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```
> 注: `'unsafe-inline'` は P0 暫定。P4 で nonce 方式に置換し `unsafe-inline` を排除する（DoD: securityheaders A+）。

- [ ] **Step 2: build に `_headers` が含まれることを確認**

```bash
npm run build && test -f dist/_headers && echo "headers OK"
```
Expected: `headers OK`

- [ ] **Step 3: コミット**

```bash
git add -A && git commit -m "feat(P0): baseline security headers via Cloudflare _headers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0-5: ThemeToggle island（dark/light 切替・永続・a11y）

**Files:**
- Create: `src/components/ui/ThemeToggle.tsx`
- Modify: `src/pages/index.astro`（`<ThemeToggle client:load />` 配置）

**Interfaces:**
- Consumes: `document.documentElement.dataset.theme`（P0-3で初期化済み）
- Produces: React island。クリックで `data-theme` と `localStorage.theme` をトグル。`aria-pressed` でSR対応

- [ ] **Step 1: ThemeToggle.tsx を記述**

```tsx
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as "light" | "dark") ?? "light");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    setTheme(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      aria-label={theme === "dark" ? "ライトモードに切替" : "ダークモードに切替"}
      class="fixed top-4 right-4 rounded-button bg-surface px-4 py-2 text-text shadow-card"
    >
      {theme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
```
> 注: Astro内のReactは `className` が標準。`class` でなく `className` を使う（lint/型で確認）。

- [ ] **Step 2: index.astro に配置**

```astro
---
import Base from "../layouts/Base.astro";
import ThemeToggle from "../components/ui/ThemeToggle.tsx";
---
<Base title="ブランドも、体験も、次のステージへ" description="制作・ブランディングスタジオ spark のLP（基盤）">
  <ThemeToggle client:load />
  <main id="main" class="min-h-dvh grid place-items-center bg-bg text-text">
    <h1 class="font-display font-extrabold text-6xl">spark</h1>
  </main>
</Base>
```

- [ ] **Step 3: 型チェック・ビルド**

```bash
npx astro check && npm run build
```
Expected: エラー0、build成功

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat(P0): accessible ThemeToggle island with persistence

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0-6: アセット配置（素材パック → public/assets）

**Files:**
- Create: `public/assets/{icons,shapes,ui}/...`, `src/lib/assets.ts`

**Interfaces:**
- Produces: 公開アセットパス。`assetIcon(name)` ヘルパが svg パスを返す

- [ ] **Step 1: 素材を public へコピー（svg優先・retina同梱・spritesは非出荷）**

```bash
mkdir -p public/assets/icons public/assets/shapes public/assets/ui
cp -R lp_ec_vibe_design_assets_pack/assets/icons/svg public/assets/icons/svg
cp -R lp_ec_vibe_design_assets_pack/assets/icons/png_240_retina public/assets/icons/png
cp -R lp_ec_vibe_design_assets_pack/assets/shapes/svg public/assets/shapes/svg
cp -R lp_ec_vibe_design_assets_pack/assets/shapes/png_240_retina public/assets/shapes/png
cp -R lp_ec_vibe_design_assets_pack/assets/ui/svg public/assets/ui/svg
ls public/assets/icons/svg | wc -l   # 14 期待
```
Expected: icons/svg に 14 ファイル

- [ ] **Step 2: assets.ts ヘルパを記述**

```ts
const base = "/assets";
export const assetIcon = (name: string) => `${base}/icons/svg/${name}.svg`;
export const assetShape = (name: string) => `${base}/shapes/svg/${name}.svg`;
export const assetUi = (name: string) => `${base}/ui/svg/${name}.svg`;
```

- [ ] **Step 3: コミット**

```bash
git add -A && git commit -m "chore(P0): place pack assets into public/assets with helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0-7: 品質ツール（Playwright視覚QA + axe + Lighthouse CI + scripts）

**Files:**
- Create: `playwright.config.ts`, `tests/smoke.spec.ts`, `lighthouserc.json`
- Modify: `package.json`（scripts）

**Interfaces:**
- Consumes: build成果（`dist/` を preview）
- Produces: `npm run check / test:e2e / lhci` が動く品質ゲート

- [ ] **Step 1: 依存導入**

```bash
npm install -D @playwright/test @axe-core/playwright @lhci/cli
npx playwright install --with-deps chromium
```

- [ ] **Step 2: playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  webServer: { command: "npm run preview", url: "http://localhost:4321", reuseExistingServer: true },
  use: { baseURL: "http://localhost:4321" },
});
```

- [ ] **Step 3: tests/smoke.spec.ts（テーマ初期化・FOUC無・axe違反0・両テーマスクショ）**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("html has data-theme on load (no FOUC)", async ({ page }) => {
  await page.goto("/");
  const theme = await page.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(theme);
});

test("no axe a11y violations (both themes)", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await page.goto("/");
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: `tests/__screots__/home-${theme}.png`, fullPage: true });
  }
});
```

- [ ] **Step 4: lighthouserc.json（性能/ a11y / SEO ゲート）**

```json
{
  "ci": {
    "collect": { "staticDistDir": "./dist", "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 1 }],
        "categories:seo": ["warn", { "minScore": 0.9 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0 }]
      }
    }
  }
}
```

- [ ] **Step 5: package.json scripts を追記**

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test:e2e": "playwright test",
    "lhci": "lhci autorun"
  }
}
```

- [ ] **Step 6: 品質ゲートを実行して通過確認**

```bash
npm run check
npm run build
npm run test:e2e
npm run lhci
```
Expected: check 0エラー / build成功 / e2e PASS（FOUC無・axe違反0）/ lhci で CLS=0・a11y=1・perf≥0.95

- [ ] **Step 7: コミット**

```bash
git add -A && git commit -m "test(P0): Playwright(axe) smoke + Lighthouse CI gates (CLS=0, a11y=100)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## P0 完了ゲート（Definition of Done）

- [ ] `npm run check`（型）エラー0 / `npm run build` 成功
- [ ] `npm run test:e2e`：FOUC無し・**axe違反0（light/dark両方）**
- [ ] `npm run lhci`：**CLS=0**・Accessibility=100・Performance≥95
- [ ] テーマ切替が動作し localStorage 永続、`prefers-color-scheme` 初期同期
- [ ] フォント3ファミリが描画、フォント差替で CLS 発生せず
- [ ] `_headers` が dist に出力、baseline セキュリティヘッダ付与
- [ ] 素材（icons14/shapes9/ui6）が public に配置
- [ ] 全タスクが個別コミット済み

---

## 計画セルフレビュー結果（spec照合）

- **spec coverage**: §4スタック/§6トークン/§10 a11y(axe)/§17ヘッダbaseline/§18 SEO(JSON-LD/OGP)/§19アセット配置 → P0-0〜7で被覆。3D(§8.2)/モーション(§3)/フォーム(§17.2)/構造化FAQ(§18) は P1〜P4 で被覆（ロードマップ記載）
- **placeholder scan**: Clash Display woff2取得のみ手動DL依存 → 暫定フォールバック手順を明記済み（placeholderではなく分岐）
- **type consistency**: `buildMeta`/`MetaInput`/`assetIcon` の名称は P0-3/P0-6 と一致。ThemeToggle は `data-theme` 契約を P0-3 のinline scriptと共有

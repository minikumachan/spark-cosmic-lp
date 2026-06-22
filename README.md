# spark — Cosmic Brand LP

スクロールで太陽系を旅する WebGL ランディングページ。
架空のクリエイティブスタジオ「spark」のコンセプトサイトとして、デザインと実装の両面を作り込んだ作品です。

- **Live:** https://spark-lp.pages.dev
- **Stack:** Astro 6 / React Three Fiber / 自作 GLSL / Cloudflare Pages

> 個人のポートフォリオ作品です。実在の受託案件ではありません。設計・3D・パフォーマンス・アクセシビリティ・セキュリティをどこまで作り込めるかを示すために制作しました。

---

## ハイライト

- 永続フルスクリーンの WebGL 背景に、SSR の HTML コンテンツを重ねる構成。3D は装飾（`aria-hidden`）として扱い、SEO とアクセシビリティを保つ。
- スクロール連動カメラの旅：地球 → 月 → 火星 → 木星 → 土星 → 海王星 → 天の川級の銀河へ。各セクションで実在の惑星をフォトリアルに描画。
- 惑星図鑑（鑑賞モード）：全10天体を間近で観賞。惑星切替時はカメラが宇宙空間を飛行して近づく遷移。OrbitControls で自由に回転・ズーム。
- 宇宙現象の再現：法線マップによる凹凸、実比率の自転（逆行含む）、小惑星帯・カイパーベルト、彗星・流れ星、散光星雲、Bloom による発光。
- Lighthouse 実測：a11y 100 / SEO 100 / Best-Practices 100 / CLS 0 / Performance 92（WebGL を多用したサイトとして）。

---

## 技術スタック

| 領域 | 採用 |
|---|---|
| フレームワーク | Astro 6（rolldown-vite）/ アイランド構成 |
| 3D | React Three Fiber v9 + drei + three 0.184 + @react-three/postprocessing（Bloom / Vignette）+ 自作 GLSL |
| スタイル | スコープド CSS / CSS カスタムプロパティ / `clamp()` レスポンシブ |
| タイポ | Clash Display / Zen Kaku Gothic New / JetBrains Mono（self-host・サブセット・`font-display:swap`） |
| ホスティング | Cloudflare Pages + Pages Functions（問い合わせ API・無料） |
| 品質ゲート | astro check / Playwright e2e / @axe-core / Lighthouse CI |

---

## 主な設計判断

### 1. 3D は背景、コンテンツは SSR の HTML
WebGL を全画面の固定背景に置き、その上に SSR した HTML（見出し・本文・フォーム）を重ねている。3D を Canvas 内のテキストにすると検索エンジンやスクリーンリーダーが読めないため、装飾と情報を分けた。これで没入感とアクセシビリティ／SEO を両立できる。Canvas には `aria-hidden` と `tabindex=-1` を付与。

### 2. カメラの停止点は DOM セクション駆動
各停止点を、スクロール率ではなく実際のセクションの画面中心 Y に束縛して補間する。スクロール率に直接結合するとセクションの増減や高さ変化で破綻するが、DOM 位置を基準にすれば内容が変わっても追従する。補間はフレームレート非依存（`1 - exp(-k·dt)`）で、スクロール入力も平滑化してホイールの離散的な動きをなめらかにしている。

### 3. 画質を落とさずに軽くする
重い体験でも初回表示を速くするための対策：

- 3D の遅延ロード（`DeferredStage`）：`requestIdleCallback` で three.js を FCP/LCP の後に読み込む。初期は CSS グラデのフォールバックが見える。結果として perf 84 → 92 / LCP 3.4s → 2.6s。
- Adaptive DPR：drei `PerformanceMonitor` で FPS を監視し、弱い GPU では解像度を自動で落として破綻を防ぐ。
- 接近時マウント：銀河（6万点）など終盤専用の重いオブジェクトは、スクロール接近時のみマウント。
- 遅延テクスチャ：惑星テクスチャは接近したセクションのみ読み込み（WebP・計約 5.5MB）。
- 不可視時は `frameloop="never"`、`manualChunks` で three を独立チャンク化、未使用バッファ無効化、`dispose` を徹底。

### 4. 厳格な Content-Security-Policy（unsafe-inline なし）
インラインスクリプトをビルド時に sha256 ハッシュ化して `script-src` に列挙する自作インテグレーションで、`'unsafe-inline'` を使わない CSP にしている。`frame-ancestors 'none'` / HSTS / Referrer-Policy / X-Frame-Options も付与。

### 5. 堅牢性
テクスチャ 404 や WebGL コンテキストロストで Canvas が落ちても、ErrorBoundary が CSS 背景へ安全に退避する。`prefers-reduced-motion` で 3D・入場アニメ・スクロール挙動を停止。

---

## アクセシビリティ

- Lighthouse / axe-core 違反 0（WCAG 2.1 / 2.2 AA）。
- スキップリンク・`<main>` ランドマーク・単一 h1・フォームの `aria-live` エラー通知。
- 装飾 Canvas は `aria-hidden`。`prefers-reduced-motion` を全面的に尊重。
- 全インタラクティブ要素に 44px のタップ領域、iPhone の `env(safe-area-inset-*)` に対応。

---

## 品質ゲート

```bash
npm run check      # astro check（型・テンプレート）
npm run test:e2e   # Playwright e2e + axe a11y（6 観点）
npm run lhci       # Lighthouse CI（perf / a11y / seo / bp / CLS）
```

- e2e（6/6 pass）：主要セクション・構造化データ（Organization / FAQPage）・フォームのアクセシブルエラー・モバイル横オーバーフロー無し・鑑賞モード開閉・axe 違反 0。
- Lighthouse：a11y 100 / SEO 100 / Best-Practices 100 / CLS 0 / TBT 130ms / Performance 92。

---

## ローカル開発

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 本番ビルド（dist/）
npm run preview    # 本番ビルドをローカル配信
```

> 3D の実描画には WebGL（実ブラウザ）が必要です。ヘッドレス環境では `prefers-reduced-motion` 時と同様に CSS フォールバック背景が表示されます（コンテンツ・操作は不変）。

---

## ディレクトリ構成

```
src/
  pages/index.astro              ホーム（全セクションをインライン構成・厳格 CSP 対応）
  components/three/cosmic/
    CosmicStage.tsx              背景 3D 全体（星雲 / 星 / 銀河 / 太陽系 / 小惑星 / Bloom / カメラ Rig）
    PlanetViewer.tsx             惑星図鑑（鑑賞モード・カメラ飛行遷移・全デバイス UI）
    DeferredStage.tsx            3D の遅延ロード（FCP/LCP 最適化）
  data/*.yaml                    コンテンツ（services / works / strengths / pricing / faq）
  lib/seo.ts                     メタ / 構造化データ
functions/api/contact.ts        問い合わせ API（honeypot + time-trap のスパム対策）
astro.config.mjs                自作 CSP インテグレーション / manualChunks / Fontaine
```

---

## クレジット

惑星・宇宙テクスチャの出所は [`public/assets/planet/CREDITS.txt`](public/assets/planet/CREDITS.txt) に記載（Solar System Scope = CC BY 4.0 / three.js examples = MIT・NASA 由来 public domain）。法線マップは元アルベドから生成。

---

© 2026 spark — Creative Studio（コンセプト作品）

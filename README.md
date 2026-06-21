# spark — Cosmic Brand LP

スクロールで**太陽系を旅する**インタラクティブな WebGL ランディングページ。
架空のクリエイティブスタジオ「spark」のコンセプトサイトとして、**デザイン品質と実装の工学品質を両立**させたショーケース作品です。

🔭 **Live:** https://spark-lp.pages.dev

> 本リポジトリは個人のポートフォリオ作品です。実在の受託案件ではなく、**設計・3D・パフォーマンス・アクセシビリティ・セキュリティを一貫して高水準で作り込む力**を示すための制作物です。

---

## ⭐ ハイライト

- **永続フルスクリーン WebGL 背景**に、SSR の HTML コンテンツを重ねる構成。3D は装飾（`aria-hidden`）で、**SEO・アクセシビリティを犠牲にしない**。
- **スクロール連動カメラの旅**：地球 → 月 → 火星 → 木星 → 土星 → 海王星 → 天の川級の銀河へ。各セクションで実在の惑星をフォトリアルに描画。
- **惑星図鑑（鑑賞モード）**：全10天体を間近で観賞。惑星切替時は**カメラが宇宙空間を飛行して近づく**遷移。OrbitControls で自由に回転・ズーム。
- **宇宙現象の再現**：法線マップによる凹凸、実比率の自転（逆行含む）、小惑星帯・カイパーベルト、彗星・流れ星、散光星雲、Bloom による発光。
- 計測に裏打ちされた品質：**Lighthouse a11y 100 / SEO 100 / Best-Practices 100 / CLS 0 / Performance 92**（WebGL ショーケースとして）。

---

## 🛠 技術スタック

| 領域 | 採用 |
|---|---|
| フレームワーク | **Astro 6**（rolldown-vite）/ アイランド構成 |
| 3D | **React Three Fiber v9** + **drei** + **three 0.184** + **@react-three/postprocessing**（Bloom/Vignette）+ 自作 **GLSL** |
| スタイル | スコープド CSS / CSS カスタムプロパティ / `clamp()` レスポンシブ |
| タイポ | Clash Display / Zen Kaku Gothic New / JetBrains Mono（self-host・サブセット・`font-display:swap`） |
| ホスティング | **Cloudflare Pages** + **Pages Functions**（問い合わせ API）— 無料・サーバーレス |
| 品質ゲート | astro check / Playwright e2e / **@axe-core** / **Lighthouse CI** |

---

## 🧠 主要な設計判断（なぜそうしたか）

### 1. 3D は「背景」、コンテンツは SSR の HTML
WebGL を全画面の固定背景に置き、その上に通常の SSR された HTML（見出し・本文・フォーム）を重ねた。
**理由**：3D を Canvas 内テキストにすると検索エンジン・スクリーンリーダーに読まれない。装飾と情報を分離することで、**没入感とアクセシビリティ／SEO を同時に**満たす。Canvas は `aria-hidden` + `tabindex=-1`。

### 2. カメラの旅は「DOM セクション駆動」
カメラの各停止点をスクロール率ではなく**実際のセクションの画面中心 Y**に束縛し、補間。
**理由**：スクロール率結合だとセクションの増減・高さ変化で破綻する。DOM 位置駆動なら**内容が変わってもカメラが追従**する。補間はフレームレート非依存（`1 - exp(-k·dt)`）＋スクロール入力の平滑化で、ホイールの離散ジャンプも滑らか。

### 3. 「画質を落とさない」パフォーマンス戦略
重い体験を**初回表示の速さと両立**させるための多層対策：
- **3D の遅延ロード**（`DeferredStage`）：`requestIdleCallback` で three.js を **FCP/LCP の後**に読み込む。初期は CSS グラデのフォールバックが見える → **perf 84 → 92 / LCP 3.4s → 2.6s**。
- **Adaptive DPR**：drei `PerformanceMonitor` で FPS を監視し、弱い GPU では解像度を自動で落として**破綻させない**。
- **接近時マウント**：銀河（6万点）など終盤専用の重いオブジェクトは、スクロール接近時のみマウント。
- **遅延テクスチャ**：惑星テクスチャは接近したセクションのみ読み込み（WebP・計約5.5MB）。
- 不可視時は `frameloop="never"`、`manualChunks` で three を独立チャンク化、未使用バッファ無効化、`dispose` 徹底。

### 4. 厳格な Content-Security-Policy（unsafe-inline なし）
インラインスクリプトを**ビルド時に sha256 ハッシュ化**して `script-src` に列挙する自作インテグレーションで、`'unsafe-inline'` を排した A+ 級 CSP を実現。`frame-ancestors 'none'` / HSTS / Referrer-Policy / X-Frame-Options 等も付与。

### 5. 堅牢性
テクスチャ 404 や WebGL コンテキストロストで Canvas が落ちても、**ErrorBoundary が CSS 背景へ安全に退避**。`prefers-reduced-motion` で 3D・入場アニメ・スクロール挙動を停止。

---

## ♿ アクセシビリティ

- Lighthouse / axe-core **違反 0**（WCAG 2.1/2.2 AA）。
- スキップリンク・`<main>` ランドマーク・単一 h1・フォームの `aria-live` エラー通知。
- 装飾 Canvas は `aria-hidden`。`prefers-reduced-motion` を全面尊重。
- 全インタラクティブ要素に 44px のタップ領域、iPhone の `env(safe-area-inset-*)` 対応。

---

## ✅ 品質ゲート

```bash
npm run check      # astro check（型・テンプレート）
npm run test:e2e   # Playwright e2e + axe a11y（6 観点）
npm run lhci       # Lighthouse CI（perf/a11y/seo/bp/CLS）
```

- **e2e（6/6 pass）**：主要セクション・構造化データ(Organization/FAQPage)・フォームのアクセシブルエラー・モバイル横オーバーフロー無し・鑑賞モード開閉・**axe 違反 0**。
- **Lighthouse**：a11y 100 / SEO 100 / Best-Practices 100 / CLS 0 / TBT 130ms / Performance 92。

---

## 🚀 ローカル開発

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 本番ビルド（dist/）
npm run preview    # 本番ビルドをローカル配信
```

> 注：3D の実描画には WebGL（実ブラウザ）が必要です。ヘッドレス環境では `prefers-reduced-motion` 時と同様に CSS フォールバック背景が表示されます（コンテンツ・操作は不変）。

---

## 📐 構成

```
src/
  pages/index.astro              # ホーム（全セクションをインライン構成・厳格CSP対応）
  components/three/cosmic/
    CosmicStage.tsx              # 背景3D全体（星雲/星/銀河/太陽系/小惑星/Bloom/カメラRig）
    PlanetViewer.tsx             # 惑星図鑑（鑑賞モード・カメラ飛行遷移・全デバイスUI）
    DeferredStage.tsx            # 3Dの遅延ロード（FCP/LCP最適化）
  data/*.yaml                    # コンテンツ（services/works/strengths/pricing/faq）
  lib/seo.ts                     # メタ/構造化データ
functions/api/contact.ts        # 問い合わせ API（honeypot + time-trap のスパム対策）
astro.config.mjs                # 自作 CSP インテグレーション / manualChunks / Fontaine
```

---

## 🎨 クレジット

惑星・宇宙テクスチャの出所は [`public/assets/planet/CREDITS.txt`](public/assets/planet/CREDITS.txt) に記載（Solar System Scope = CC BY 4.0 / three.js examples = MIT・NASA 由来 public domain）。法線マップは元アルベドから生成。

---

© 2026 spark — Creative Studio（コンセプト作品）

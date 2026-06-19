# spark LP — 設計書 (Design Spec)

| 項目 | 内容 |
|---|---|
| プロジェクト | spark — 制作/ブランディング会社 LP（高技術・高品質ショーケース） |
| 日付 | 2026-06-19 |
| ステータス | レビュー待ち（実装計画 writing-plans の前段） |
| 確定方針 | ① spark継承・昇華 ／ ② R3F+WebGLシェーダー主役 ／ ③ Astro+React islands |
| 制作形態 | バイブコーディング（Claude が全コード操作を実施） |
| 素材 | `lp_ec_vibe_design_assets_pack/`（モックアップ・アイコン28・shape8・tokens） |

---

## 1. 目的とゴール

### 1.1 このサイトの役割
「spark」というブランディング/制作会社の LP。同時に **制作者（まぼ）の技術力・デザイン力のショーケース** を兼ねる。
"AIが作った感" を完全排除し、Awwwards 級の表現と、シニアエンジニアが評価する "見えない技術力" を両立する。

### 1.2 成功基準（測定可能）
| 指標 | 目標 |
|---|---|
| Lighthouse Performance | ≥ 95（モバイル/デスクトップ） |
| LCP | < 2.0s（モバイル4G想定） |
| CLS | **0**（完全ゼロ） |
| INP | < 200ms |
| Accessibility（Lighthouse / axe） | 100 / 違反0、WCAG 2.2 AA 準拠 |
| 初期JS（島を除くベースライン） | ≈ 0KB（Astro静的） |
| 主役3D | Heroの1シーンに集約、`prefers-reduced-motion`で静止画フォールバック |
| CVR導線 | Hero / 各セクション末 / 固定CTA から最終フォームへ一直線 |
| セキュリティ | securityheaders.com A+ / Mozilla Observatory A以上（§17） |
| SEO | 構造化データ(Organization/FAQPage)・OGP・sitemap・canonical 完備、Lighthouse SEO 100（§18） |

---

## 2. 設計哲学 — 「1点豪華・残りは見えない技術力」

> ジュニアは全部盛る。シニアは魅せどころを1〜2発に絞り、残りは**性能・アクセシビリティ・計測・アーキテクチャ**という"見えない技術力"に投資する。

LPの本分は CVR。3D/アニメは"主役の1シーン（Hero）"に集中させ、それ以外の派手さは封印する。
削る判断（WebGPU見送り・フルCMS抑制・重ABテスト抑制）こそがプロの設計である。

---

## 3. 技術トリアージ（採用判断）

| 領域 | 技術 | 判断 | 方針 |
|---|---|---|---|
| グラフィックス | R3F + 自作GLSL Hero 3D | 🟢 主役1発 | 有機メッシュ＋シェーダー背景。インパクトの8割を集中投下 |
| | Scroll-driven animation | 🟢 採用(統制) | ネイティブCSS scroll-driven + 一部GSAP ScrollTrigger。60FPS維持・reduced-motion必須 |
| | FLIP / motion 遷移 | 🟡 控えめ | マイクロインタラクション中心。全体を動かしすぎない |
| | WebGPU | 🔴 見送り | 対応未成熟・二重実装コスト過大。検出のみ仕込み、描画はWebGL |
| パフォーマンス | AVIF/WebP・srcset・LCP preload | 🟢 全採用 | Astro `<Image>` / sharp で自動最適化 |
| | IntersectionObserver 遅延 | 🟢 全採用 | 重い島は `client:visible` で画面到達時ロード |
| | CLS=0 / Skeleton / font metrics | 🟢 全採用 | 寸法固定・`size-adjust`でフォント差替ガタつき0 |
| アーキテクチャ | デザイントークン/コンポーネント駆動 | 🟢 採用 | tokens → Tailwind v4 `@theme` + CSS変数 |
| | Container Queries `@container` | 🟢 採用 | カードグリッドで実演 |
| | Headless CMS + ISR | 🟡 折衷 | Astro Content Collections で型付き分離（CMS差替可能設計）。実CMS接続はしない |
| UX/a11y | WCAG 2.2 AA / WAI-ARIA | 🟢 全採用 | アコーディオン・フォーム・フォーカス制御を完全準拠 |
| | Dark/Light テーマ | 🟢 必須 | 白ベース⇄深ネイビー。FOUC防止のインラインスクリプト |
| | i18n (ja/en) | 🔴 機能カット（土台のみ） | JP向けLPで半端なEN版は逆効果。**文字列はContent Collections/辞書で外部化**し"後から多言語化可能"な土台のみ残す。第2言語ページは出荷しない |
| フォーム/計測 | RHF + Zod | 🟢 採用 | リアルタイム検証・アクセシブルなエラー |
| | GA4/GTM DataLayer・scroll深度 | 🟢 設計採用 | analytics抽象レイヤ。IDはプレースホルダで差込可能 |
| | コンポーネントABテスト | 🟡 軽量フラグ | フラグ機構の器のみ。大掛かりにしない |

---

## 4. 技術スタック（確定）

```
Astro 6（hybrid: 静的ページ + フォーム用オンデマンドendpoint）+ React islands + Tailwind v4 + TS(strict)
├─ 3D       : @react-three/fiber + @react-three/drei + three + 自作GLSL（Draco/KTX2）
├─ Motion   : motion/react + ネイティブCSS scroll-driven（主）。GSAPは代替不可な演出のみ。Lenisは不採用（scroll-jack回避・a11y優先）
├─ Form     : react-hook-form + zod（クライアント）+ サーバ側zod再検証 + Turnstile（§17）
├─ Content  : Astro Content Collections（型付き・CMS差替可能）
├─ 計測     : 抽象 analytics レイヤ（GA4/GTM プレースホルダ・同意管理）
├─ 画像     : Astro <Image> + sharp（AVIF/WebP/srcset）
├─ デプロイ : Cloudflare Pages + Workers/Functions（エッジWAF/DDoS/Bot対策が無料・§17）
└─ 品質     : Lighthouse CI / @axe-core/playwright / Playwright視覚QA
```

**フォント**（グローバル規約準拠・Space Grotesk不使用・**3ファミリに厳選**＝CLS/perf配慮）:
- EN見出し: **Clash Display**（weight 200⇄900の極端対比）
- 本文(JP+EN): **Zen Kaku Gothic New**（latin内包。EN比重が高い箇所のみ任意で Satoshi）
- 数値/ラベル: **JetBrains Mono**
- self-host + サブセット化、`font-display: swap` + `size-adjust` で CLS=0、サイズジャンプ最低3倍差

---

## 5. ツール支援パイプライン

> **原則**: ツールは "ビルド時のオーサリング/着想支援"。**出荷物（shipped site）はツールに依存しない**（Astro+R3F+静的アセットで自己完結）。各ツールが未接続でもフォールバックで完成する。

| ツール | 役割 | 接続 | フォールバック |
|---|---|---|---|
| **Blender MCP** | Hero 3Dアセットの制作→GLB(Draco)書き出し。Claudeが直接モデリング操作 | 🧑‍💻要導入 | R3Fの手続き的ジオメトリ＋ノイズ変位で代替 |
| **Stitch MCP** | セクションのレイアウト案を高速生成し比較・着想 | 🧑‍💻要導入 | Claudeが直接ワイヤー設計（本書§8） |
| **Figma MCP** | デザインモックアップ/デザインシステム可視化・トークン照合 | 🧑‍💻要認証 | tokens.json直読み＋コード内モック |
| **Context7** | Astro 6/R3F/drei/Tailwind v4/motion の最新docs取得 | ✅ | — |
| **Playwright** | 視覚QA・レスポンシブ撮影・axe a11y検査 | ✅ | — |
| **serena** | 実装時のシンボル単位コード解析・安全な編集 | ✅ | — |
| Gamma/Canva/Adobe | 提案資料・OG画像・アセット仕上げ | 🧑‍💻任意 | 自前生成 |

導入手順は `docs/ai/setup/TOOLCHAIN_SETUP.md` 参照。

---

## 6. デザイントークン基盤

`tokens/design_tokens.json` を正本とし、Tailwind v4 `@theme` + CSS変数に展開。**ハードコード禁止**。

### 6.1 カラー
```
Light テーマ:  bg #FFFFFF / surface #F7F9FC / text #0B1230 / muted #68708A
Dark テーマ:   bg #0B1230 / surface #131A3A / text #F5F7FB / muted #9AA3C0
アクセント（両テーマ共通・CTA/アイコン/装飾に限定）:
  blue #0757FF / cyan #4DB8FF / magenta #FF2F8F / coral #FF5A5F /
  orange #FF8A2A / lime #9BE800 / green #5ED000 / purple #854DFF /
  lavender #C9C4FF / light_blue #D8E9FF
```
- ダークは "紫グラデ on 白" を避けつつ、ネオンを暗背景で発光させる（IDEテーマ的＝Tokyo Night寄り）
- コントラスト比 WCAG 2.2 AA（本文4.5:1 / 大文字3:1）を全ペアで担保

### 6.2 余白・角丸・影・モーション
```
spacing(px): 8 12 16 24 32 48 64 96 128
radius: card 24px / button 999px(pill) / image_mask 32px
shadow: card 0 18px 45px rgba(11,18,48,.08) / floating 0 24px 70px rgba(7,87,255,.18)
motion: ease-out-quint cubic-bezier(.22,1,.36,1) / duration 200–700ms / stagger 60–90ms
```

---

## 7. アートディレクション

- **コンセプト**: 白い空間に有機的な"光のオブジェクト"が呼吸する。spark=火花/閃き を3Dの発光体で象徴
- **レイアウト**: 非対称・grid-breaking・要素のoverlap・z-layering。blobで奥行き、潤沢なnegative space
- **背景**: solid禁止。gradient mesh + noise texture。Heroはシェーダー
- **画像**: clip-path / border-radius / mask-image（shape_image_mask_blob）で有機的に切り抜く
- **モーション**: ロード時staggered reveal、scroll-triggered、hover/focus/activeに必ずmicro-interaction。**全て`prefers-reduced-motion`でガード**
- **禁則**: AIスラップ（白+紫グラデ+Inter+予測可能レイアウト）、Space Grotesk、solid背景、アニメ無しの静的ページ

---

## 8. 情報設計 / セクション仕様

各セクション = `目的 / コンテンツ / レイアウト / 演出 / 技術 / a11y`。コンテンツは Content Collections に型付き分離。

### 8.1 Header（固定ナビ）
- spark ロゴ（icon_logo_spark）＋ナビ＋テーマ切替＋pill CTA
- 演出: スクロールで背景blur+縮小。CTAは常時pill
- a11y: skip-link、キーボード巡回、`aria-current`

### 8.2 Hero ★主役
- **目的**: 第一印象で技術力を提示＋一次CTA
- コンテンツ: 「ブランドも、体験も、次のステージへ。」＋サブコピー＋2 CTA（相談/資料）
- レイアウト: 左テキスト（極端ウェイト対比）／右に3Dキャンバスをoverlap配置
- **演出**: R3F有機メッシュ（発光体）＋シェーダー背景mesh。マウス/スクロールで緩やかに変形・視差
- 技術: `client:visible`島、WebGL、低スペック/reduced-motionは静止画(AVIF)へ自動フォールバック、Draco圧縮GLB
- a11y: 3Dは装飾扱い`aria-hidden`、見出しは正しい`<h1>`

### 8.3 サービス（4カード: Branding / UI/UX / Web / Creative Direction）
- レイアウト: `@container` グリッド（親幅で1→2→4列）
- 演出: hoverで浮上（shadow-floating）＋アイコンmicro-interaction＋stagger reveal
- a11y: カードは`<article>`、リンク全体をクリッカブルかつフォーカス可

### 8.4 制作実績（ショーケース）
- 演出: 画像をblob/clip-pathで有機マスク、parallaxズレ、stagger
- 技術: `<Image>`でAVIF/WebP/srcset、遅延読込、寸法固定でCLS=0

### 8.5 私たちの強み
- 演出: 数値カウントアップ（IntersectionObserver起動）、非対称配置、squiggle/wave装飾
- a11y: カウントは`aria-live`で最終値も読み上げ

### 8.6 料金プラン（3段: ライト/スタンダード/グロース）
- レイアウト: 中央プラン強調、`@container`で段組変化
- 演出: pill CTA（グラデ）、hover浮上
- a11y: 表構造の意味付け、CTAに明確なラベル

### 8.7 FAQ（アコーディオン）
- 技術: **WAI-ARIA Disclosureパターン完全準拠**（`button[aria-expanded]` + `aria-controls`）
- 演出: +/− アイコン回転、高さアニメ（reduced-motion時は瞬時）
- a11y: キーボード操作、フォーカスリング、スクリーンリーダー対応

### 8.8 CTA / コンタクトフォーム
- 演出: gradient mesh背景、送信時micro-interaction
- 技術: **react-hook-form + zod**。入力中リアルタイム検証、`aria-invalid`/`aria-describedby`でエラー連携
- セキュリティ: サーバ側で zod 再検証 + honeypot + time-trap + Turnstile + rate-limit（§17）
- 状態: idle→submitting→success/error を明示。成功はthank-you表示、失敗は再試行可能なエラー
- 計測: 送信・項目フォーカス・離脱をイベント送出

### 8.9 Footer
- リンク・SNS・コピーライト・テーマ切替（再掲）

---

## 9. パフォーマンス予算

| 項目 | 予算 |
|---|---|
| 初期HTML/CSS | クリティカルCSSインライン、未使用Tailwindパージ |
| ベースJS | ≈0（Astro静的）。島のみ`client:visible`/`client:idle` |
| Hero 3D | GLB < 300KB（Draco）、テクスチャKTX2圧縮、DPRクランプ(≤2) |
| 画像 | AVIF優先→WebP→元、`<Image>`で寸法固定、LCP画像は`fetchpriority=high`+preload |
| フォント | サブセット化、`swap`+`size-adjust`、self-host |
| 検証 | Lighthouse CI を品質ゲート化（PR時/手元で実行） |

---

## 10. アクセシビリティ方針（WCAG 2.2 AA）

- セマンティックHTML（landmark: header/nav/main/section/footer）、見出し階層厳守
- 全インタラクティブ要素をキーボード操作可、可視フォーカス（`:focus-visible`）
- コントラスト比 AA、`prefers-color-scheme`同期、`prefers-reduced-motion`で全演出ガード
- フォーム: ラベル関連付け、エラーの`aria`連携、必須/形式の明示
- 3D/動画は`aria-hidden`の装飾扱い。情報は必ずテキストでも提供
- 検証: `@axe-core/playwright`で違反0を自動チェック

---

## 11. 計測設計

- `src/lib/analytics.ts` に抽象レイヤ（`track(event, payload)`）。実体は GA4/GTM DataLayer push、ID未設定時はno-op
- 計測イベント: `cta_click`(位置別) / `section_view`(scroll深度) / `form_focus` / `form_submit` / `theme_toggle` / `lang_switch`
- ABテスト: `src/lib/flags.ts` の軽量フラグ（Heroコピー等の出し分けの器のみ）

---

## 12. ディレクトリ構成（予定）

```
Design_LP/
├─ src/
│  ├─ pages/            index.astro（ja単一）
│  ├─ layouts/          Base.astro（meta/OG/テーマFOUC防止/フォントpreload）
│  ├─ components/
│  │  ├─ sections/      Hero / Services / Works / Strengths / Pricing / Faq / CtaForm
│  │  ├─ three/         HeroScene.tsx / shaders/*.glsl（島）
│  │  └─ ui/            ThemeToggle / LangSwitch / Accordion / Reveal / CountUp
│  ├─ content/          services / works / pricing / faq （Content Collections）
│  ├─ styles/           theme.css（@theme/tokens）/ globals.css
│  └─ lib/              analytics.ts / flags.ts / i18n.ts
├─ public/assets/       素材パックから配置（icons/shapes/ui + 3D GLB）
├─ docs/ai/             specs / setup
└─ astro.config / tailwind / tsconfig(strict)
```

---

## 13. コンテンツモデル（Content Collections）

```ts
services: { slug, title, icon, desc, accent }[]            // 4件
works:    { slug, title, category, image, alt, mask, tags }[] // 実績（alt必須=a11y）
strengths:{ slug, title, metric, suffix, desc, icon }[]    // 数値訴求
pricing:  { slug, name, price, period, features[], featured }[] // 3件
faq:      { q, a }[]                                        // アコーディオン
```
zodスキーマで型保証。将来 microCMS/Contentful へ差替可能な境界として設計。

---

## 14. 実装フェーズ計画（高レベル / 詳細は writing-plans で展開）

| Phase | 内容 | 主要ツール | 完了ゲート |
|---|---|---|---|
| **P0 基盤** | Astro+Tailwind v4+TS scaffold、tokens→@theme、テーマ/フォント、素材配置、git | serena/Context7 | 空ページが両テーマ＋CLS0で表示 |
| **P1 静的骨格** | 全7セクションをコンテンツ＋レイアウト（3D/アニメ無し）で構築、Content Collections | Context7 | 構成・コピー・レスポンシブ確定 |
| **P2 モーション** | reveal/scroll-driven/micro-interaction、reduced-motionガード | motion/GSAP | 60FPS維持を視覚QA |
| **P3 Hero 3D** | R3Fシーン＋GLSL、GLB（Blender or 手続き的）、フォールバック | Blender MCP/R3F | 主役3Dが予算内で動作 |
| **P4 フォーム/計測/セキュリティ** | RHF+Zod＋サーバ検証、Turnstile、rate-limit、セキュリティヘッダ/CSP(nonce)、analytics抽象、flags | Cloudflare | フォーム堅牢化・ヘッダA+・イベント発火 |
| **P5 最適化/QA/公開** | 画像最適化、Lighthouse CI、axe、SEO/構造化データ、securityheaders検証、Cloudflareデプロイ | Playwright/lhci/Cloudflare | 成功基準(§1.2)を全達成 |

> 各 Phase は §"途中追加タスクの取り込み手順"に従い、前提・完了位置・波及影響を明記して writing-plans で詳細化する。

---

## 15. リスクと対策

| リスク | 対策 |
|---|---|
| 3Dが重くLCP/INP悪化 | Heroのみ・`client:visible`・DPRクランプ・Draco/KTX2・reduced-motionで静止画 |
| Blender/Stitch未導入で停滞 | 全てフォールバック実装あり。出荷物はツール非依存 |
| アニメ過多でLP本分を損なう | 設計哲学§2で1点豪華に統制、動かしすぎ禁止 |
| フォント差替でCLS発生 | self-host + `size-adjust` + preload |
| ダークでネオンが眩しい/視認性低下 | アクセント彩度をダーク用に微調整、AA担保 |

---

## 16. 受け入れ基準（Definition of Done）

- [ ] §1.2 の全成功基準を達成（Lighthouse/CWV/a11y）
- [ ] Light/Dark 両テーマで全セクション破綻なし、FOUC無し
- [ ] `prefers-reduced-motion` で全演出が安全に静止
- [ ] WCAG 2.2 AA：axe違反0、キーボードのみで全操作可
- [ ] CLS=0、主役3Dが性能予算内
- [ ] フォーム：リアルタイム検証＋アクセシブルなエラー
- [ ] 計測イベントが発火（IDはプレースホルダ）
- [ ] 文字列を外部化（多言語化可能な土台）。出荷は ja 単一
- [ ] 素材パックのトークン/アセットを一貫使用、ハードコード無し
- [ ] セキュリティ: サーバ側検証＋Turnstile＋rate-limit、securityheaders.com A+（§17）
- [ ] SEO: 構造化データ/OGP/sitemap/canonical、Lighthouse SEO 100（§18）
- [ ] 制作実績の画像方針（§19）に沿って全カード破綻なし

---

## 17. セキュリティ & 堅牢化

> **方針**: LPの攻撃面は実質「フォームendpoint 1本」。重バックエンドは作らず、**薄い endpoint を正しく堅牢化 + Webセキュリティヘッダ + エッジ防御**に集約。
> 過剰実装はせず、`securityheaders.com A+ / Mozilla Observatory A+` を可視的な実力証明とする。

### 17.1 脅威モデル
| 攻撃面 | 脅威 | 対策 |
|---|---|---|
| フォームendpoint | スパム/ボット、インジェクション、悪用、軽DoS | サーバ検証・Turnstile・honeypot・time-trap・rate-limit |
| サードパーティscript | サプライチェーン、XSS | SRI・最小依存・CSP |
| ホスティング | DDoS/ボット | Cloudflareエッジ（WAF/DDoS/Bot無料） |

### 17.2 フォームendpoint（Cloudflare Pages Function / Astro endpoint）
- クライアント zod ＋ **サーバ側 zod 再検証**（信頼境界はサーバ）
- **Cloudflare Turnstile**（プライバシー配慮CAPTCHA）+ **honeypot** + **time-trap**（最小送信時間）
- **IP rate-limit**（Workers KV / Durable Object）、入力長上限、出力エンコード（XSS防止・生入力を反射しない）
- 送信は**メール転送（Resend等）**を基本、DB保存は原則しない（データ最小化）。秘密鍵は env

### 17.3 セキュリティヘッダ（全レスポンス）
```
Content-Security-Policy: nonce方式・default-src 'self'・3D/inlineをnonce許可（unsafe-inline排除）
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: DENY / frame-ancestors 'none'
```
- 外部scriptには **SRI**。`_headers`（Cloudflare）または middleware で付与

### 17.4 サプライチェーン / 秘密情報 / プライバシー
- lockfile固定・`npm audit`・Dependabot・依存最小
- `.env`（Turnstile secret / メールAPIキー）は非コミット、`.env.example` 提供
- 解析は**同意管理**（オプトイン）、プライバシーポリシー設置、個人情報は保持しない

### 17.5 検証（DoDゲート）
- securityheaders.com **A+**、Mozilla Observatory **A以上**
- CSP違反0（コンソール）、`npm audit` high/critical 0、フォーム濫用テスト（rate-limit発火）

---

## 18. SEO & 構造化データ

- **メタ**: title/description（各60/120字最適化）、canonical、`lang`、theme-color
- **OGP/Twitter**: og:title/description/image（1200×630）、`twitter:card=summary_large_image`
- **構造化データ(JSON-LD)**: `Organization`（spark）+ **`FAQPage`**（§8.7と同期=リッチリザルト狙い）+ `BreadcrumbList`
- **サイト基盤**: `@astrojs/sitemap`、`robots.txt`、favicon一式（ico/svg/apple-touch/512png）、`site.webmanifest`
- **画像SEO**: 意味のある`alt`（works.alt必須）、`width/height`固定
- 検証: Lighthouse SEO **100**、Rich Results Test 合格

---

## 19. アセット配置マッピング & 制作実績画像 & 確定/保留事項

### 19.1 アセット コピーマッピング（実パス検証済み）
```
src:  lp_ec_vibe_design_assets_pack/assets/{icons,shapes,ui}/{svg,png_60,png_240_retina}/
dst:  public/assets/{icons,shapes,ui}/...
- 出荷: svg（優先）/ png_240_retina（必要時）
- 非出荷: sprites/（開発参照のみ）、png_60（svgで代替可能なら省略）
内訳: icons 14種 / shapes 9種 / ui 6種（各 svg+png60+png240）
```

### 19.2 制作実績の画像方針（**確定: 案C**）
パックに実績写真は無いため、**素材のblob/グラデ/maskで構成する抽象ブランドビジュアル**を生成して各カードに使用（外部依存・ライセンス問題ゼロ、ブランド一貫）。
- 補助: 後付けでAI生成ビジュアル(案A)に差し替え可能な構造にする
- 各カードは `shape_image_mask_blob` 等で有機マスク

### 19.3 確定/保留事項
| 区分 | 内容 | 状態 |
|---|---|---|
| 確定 | デプロイ=Cloudflare Pages、Lenis不採用、フォント3ファミリ、i18n機能カット、セキュリティ右サイズ採用、実績画像=案C | ✅ |
| 保留 | 実コピーライティング（P1で確定）、実Turnstile/GA4/メールAPIキー（あなたが取得・env投入） | ⏳ |

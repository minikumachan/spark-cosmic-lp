# Claude Code / Claude Design 向け 制作指示

## 目的
添付モックアップ `mockups/lp_reference_full_mockup.png` を基準に、白ベース × ビビッドアクセント × 遊び心のあるEC/LPサイトを実装してください。

## 必須トーン
- 黒ベースは禁止。背景は白または明るいグレー。
- アクセントは electric blue / magenta / coral / lime / purple を限定的に使用。
- 余白を広く取り、カード・CTA・セクションごとに軽やかなリズムを作る。
- 不規則なblob、丸みのあるカード、ユニークな画像マスクを使用。
- スクロール時にふわっと出るアニメーション、parallax風のズレ、カードのstagger表示を入れる。

## 使用素材
- 60×60 PNG: `assets/**/png_60/`
- Retina PNG: `assets/**/png_240_retina/`
- SVG: `assets/**/svg/`
- 一覧グリッド: `assets/sprites/all_assets_grid_60x60.png`
- カラー/余白/影: `tokens/design_tokens.json` と `tokens/css_variables.css`

## 推奨セクション
Hero / Service or Product Benefits / Works or Product Showcase / Strengths / Pricing or Product Plans / FAQ / CTA

## 実装方針
- Next.js + Tailwind CSS想定。
- assetsは public/assets 配下に配置。
- アイコンはSVG優先、必要に応じて60x60 PNGを使用。
- 画像は clip-path / border-radius / mask-image で有機的に切り抜く。
- CTAはグラデーションと大きめのpill shapeを採用。
- 各カードは `box-shadow: var(--shadow-card); border-radius: var(--radius-card);` を基準にする。

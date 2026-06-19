# LP / EC Vibe Coding Asset Pack

このパックは、生成済みLPモックアップをClaude Code / Claude Designへ渡して実装するための素材一式です。

## 内容

- `mockups/lp_reference_full_mockup.png`  モックアップ原寸
- `mockups/lp_reference_full_mockup_2x.png`  高解像度参照用
- `assets/icons/png_60/`  60×60 透明PNGアイコン
- `assets/icons/png_240_retina/`  240×240 Retina用PNG
- `assets/icons/svg/`  SVGアイコン
- `assets/shapes/`  抽象図形・blob・マスク系素材
- `assets/ui/`  矢印、FAQ＋、チェックなどUI補助素材
- `assets/sprites/all_assets_grid_60x60.png`  60×60グリッド一覧
- `tokens/design_tokens.json`  カラー・余白・角丸・影
- `tokens/css_variables.css`  CSS変数
- `handoff/claude_code_design_prompt.md`  Claudeへ渡す実装指示

## 仕様

- PNGはすべて透明背景です。
- 基準サイズは 60×60 px。
- 高品質表示用に @4x / 240×240 px も同梱しています。
- SVGは `viewBox="0 0 60 60"` で統一しています。

## 素材数

- individual assets: 29
- grid sprites: 4

## 使用メモ

Claude Codeに渡す場合は、`handoff/claude_code_design_prompt.md` と `mockups/lp_reference_full_mockup.png`、`assets/` 一式を同時に渡してください。

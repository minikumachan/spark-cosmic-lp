# ツール整備手順書 — spark LP

> **役割分担**: 🧑‍💻 = あなた（まぼ）が手動で実行 ／ 🤖 = Claude が自動実行（バイブコーディング）
> あなたは「インストール・ログイン・認証」だけ行えば良い。コード操作・MCP駆動はすべて Claude 側で行う。
> 最終更新: 2026-06-19

---

## 0. 前提（確認済みの環境）

| 項目 | 状態 |
|---|---|
| Node | v24.5.0 ✅ |
| npm / pnpm / bun | 11.5.1 / 11.5.3 / 1.3.11 ✅ |
| Context7 MCP | ✅ 接続済（最新docs取得用） |
| Playwright MCP | ✅ 接続済（視覚QA用） |
| serena MCP | ✅ 接続済（コード解析用） |
| GitHub MCP | ✅ 接続済 |
| Blender 本体 | ❌ 未インストール |
| Blender MCP | ❌ 未設定 |
| Stitch MCP | ❌ 未設定 |
| Figma / Canva / Gamma / Adobe (claude.ai連携) | ⚠️ 認証切れ |

---

## 1. 🧑‍💻 Blender MCP（3Dオーサリング）— 優先度: 高

Hero の有機3Dアセットを **Blender で制作 → glTF/GLB 書き出し → R3F で軽量再生** するためのツール。
Claude が Blender を MCP 経由で直接操作してモデリング・配置・書き出しを行う。

> 未導入でも R3F の手続き的ジオメトリでフォールバック実装は可能。**カスタム3Dの作り込みをするなら導入推奨。**

### 手順
```bash
# 1) Blender 本体（4.x）を導入
brew install --cask blender

# 2) アドオンを取得
git clone https://github.com/ahujasid/blender-mcp ~/Documents/blender-mcp

# 3) uv（uvx）を公式インストーラで導入 ※ pip install uv はNG（uvxが作られない場合あり）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 4) Claude Code に MCP を登録
claude mcp add blender -- uvx blender-mcp
```

### Blender 側の操作（GUI）
1. Blender を起動 → `Edit > Preferences > Add-ons > Install...`
2. `~/Documents/blender-mcp/addon.py` を選択しインストール → **"Interface: Blender MCP"** を有効化
3. 3Dビューポートで `N` キー → サイドバーの **"BlenderMCP"** タブ → **"Connect to Claude" / Start MCP Server**

### 確認
```bash
claude mcp list   # blender が ✔ Connected になればOK
```
> ⚠️ `uvx blender-mcp` を**ターミナルで直接実行しない**こと（Claude がライフサイクル管理する）。
> ⚠️ Blender を起動し、アドオンの "Start MCP Server" を押した状態でないと Claude から繋がらない。

---

## 2. 🧑‍💻 Stitch MCP（UIレイアウト案出し）— 優先度: 中

Google Stitch（無料・月350生成）で**セクションのレイアウト案を高速に複数生成**し、比較・着想に使う。
> 生成コードはそのまま採用せず**参考（リファレンス）**として使う。最終UIは美観ルールに沿って手作業で作り込む。

### 手順
```bash
# 1) Google Cloud SDK を導入
brew install --cask google-cloud-sdk

# 2) Google ログイン（対話）— プロンプトで `! gcloud auth login` と打つとこのセッション内で実行できる
gcloud auth login

# 3) Stitch API を有効化
gcloud beta services mcp enable stitch.googleapis.com

# 4) Claude Code に MCP を登録（ローカルプロキシ）
claude mcp add stitch -- npx @_davideast/stitch-mcp proxy
```

### 確認
```bash
claude mcp list   # stitch が ✔ Connected になればOK
```
> ⚠️ 比較的新しいツールのため不安定な場合あり。落ちても本設計の進行はブロックしない（任意ツール扱い）。

---

## 3. 🧑‍💻 claude.ai 連携 MCP の再認証（任意）— 優先度: 中〜低

モックアップ工程やアセット整備で使う。**Claude Code 内で対話的に認証**する。

```text
claude を起動 → スラッシュコマンドで /mcp → 認証したいコネクタを選択 → ブラウザで承認
```

| コネクタ | 用途 | 優先度 |
|---|---|---|
| **Figma** | デザインモックアップ作成・デザインシステム・トークン抽出・ハンドオフ | 中（モックアップ工程で有効） |
| **Gamma** | 提案/ハンドオフ用スライド生成 | 低（任意） |
| **Canva** | OG画像・SNS用バナー生成 | 低（任意） |
| **Adobe** | アセットの仕上げ・書き出し | 低（任意） |

> ⚠️ 美観・最適化の観点では **コードファースト（Astro+R3F+Tailwind）が主**。これらは"あると便利"な補助で、無くても完成する。

---

## 4. 🤖 Claude が自動で導入するもの（あなたの操作不要）

実装フェーズで Claude が `npm`/`pnpm` で導入する。記録のため列挙：

```
astro, @astrojs/react, react, react-dom, tailwindcss@4, @tailwindcss/vite,
three, @react-three/fiber, @react-three/drei, motion, gsap, lenis,
react-hook-form, zod, @astrojs/sitemap, sharp（画像最適化）, lhci（Lighthouse CI）,
@axe-core/playwright（a11y検査）
```

---

## 5. まとめ：あなたが今やること（チェックリスト）

- [ ] **(高)** Blender MCP 導入（§1）— カスタム3Dを作り込むなら
- [ ] **(中)** Stitch MCP 導入（§2）— レイアウト案出しに使うなら
- [ ] **(中)** Figma コネクタ再認証（§3）— モックアップ工程で使うなら
- [ ] **(任意)** Gamma / Canva / Adobe 再認証（§3）

> **どれも未導入のままでも実装は開始できる**。Claude は接続済みツール（Context7 / Playwright / serena）＋コードで進め、上記が繋がり次第パイプラインに組み込む。

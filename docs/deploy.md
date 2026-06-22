# デプロイ手順（Cloudflare Pages）

静的サイト（`dist/`）と Pages Functions（`functions/api/contact.ts`）を wrangler の直接アップロードで公開する。
設定は `wrangler.toml` / `package.json` / `dist/_headers`（CSP 等）に整備済み。

## 前提

- `wrangler` は devDependency として導入済み（`npx wrangler --version`）。
- `wrangler.toml`: `name = spark-lp` / `pages_build_output_dir = ./dist`。
- `npm run deploy` は `astro build` 後に `wrangler pages deploy` を実行する。
- セキュリティヘッダ（CSP / HSTS など）は `astro build` が `dist/_headers` を生成し、Pages が適用する。

## 認証（初回のみ）

```bash
npx wrangler login        # ブラウザで OAuth
npx wrangler whoami       # 確認
```

CI 等でトークンを使う場合は `CLOUDFLARE_API_TOKEN`（Pages 編集権限）と `CLOUDFLARE_ACCOUNT_ID` を環境変数で渡す。

## デプロイ

```bash
npm run deploy
```

`https://spark-lp.pages.dev`（および各デプロイの `*.pages.dev` プレビュー URL）に反映される。更新も同じコマンド。

## 問い合わせメールの有効化（任意）

シークレット未設定だとフォームは成功を返すがメールは送信されない。実運用では最低限:

```bash
npx wrangler pages secret put RESEND_API_KEY --project-name spark-lp
npx wrangler pages secret put CONTACT_TO     --project-name spark-lp   # 受信先
npx wrangler pages secret put CONTACT_FROM   --project-name spark-lp   # 任意・検証済み送信元
```

投入後に再デプロイで反映。

## レート制限用 KV（任意・推奨）

```bash
npx wrangler kv namespace create RATE_LIMIT
```

出力された `id` を `wrangler.toml` の `[[kv_namespaces]]` に記入してコメント解除 → 再デプロイで「1分5回/IP」が有効化。未設定でも honeypot と time-trap は機能する。

## Turnstile について

サーバ（`functions/api/contact.ts`）は `TURNSTILE_SECRET` がある時だけ Turnstile を検証する。ただしフロントのウィジェットは未配線のため、現状で `TURNSTILE_SECRET` を設定すると全送信が弾かれる。設定しないこと。bot 対策は honeypot + time-trap（+ 任意で KV レート制限）で機能している。

## 公開後の確認

- フォーム送信（Resend 設定時はメール到達）と、空送信でアクセシブルなエラー表示。
- 実ブラウザで 3D 背景が描画されること（WebGL 不可・低モーション環境は静的フォールバック）。
- securityheaders.com に本番 URL を入力して A+ を確認（CSP は unsafe-inline 排除済み）。
- Lighthouse（任意・実機）: a11y 100 / SEO 100 / Best-Practices 100 / CLS 0 / Performance 92。

## 独自ドメインを割り当てる場合

`src/lib/seo.ts` の `ORIGIN` と `astro.config.mjs` の `site` を新ドメインに更新して `npm run build`（canonical / OG / sitemap が新 URL になる）。Cloudflare Pages の「カスタムドメイン」で割り当てる。

## ローカルで Functions を試す

```bash
cp .dev.vars.example .dev.vars   # 値を記入（.dev.vars は gitignore 済み）
npm run build
npx wrangler pages dev dist
```

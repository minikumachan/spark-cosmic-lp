# Cloudflare Pages デプロイ手順（spark LP）

静的サイト（`dist/`）＋ Pages Functions（`functions/api/contact.ts`）を **直接アップロード方式**で公開する。
git remote 未設定のため git 連携は使わない。設定は `wrangler.toml`／`package.json`／`dist/_headers` に整備済み。

> Windows では毎回 portable Node 22 を PATH 前置すること:
> `$env:Path = "C:\Users\Minikuma\.local\node-v22.13.0-win-x64;" + $env:Path`

---

## 0. 前提（導入済み）
- `wrangler` … devDependency 導入済み（`npx wrangler --version` で確認）
- `wrangler.toml` … `name = spark-lp` / `pages_build_output_dir = ./dist`
- `npm run deploy` … `astro build` 後に `wrangler pages deploy` を実行
- セキュリティヘッダ（CSP 等）… `astro build` が `dist/_headers` を自動生成 → Pages が適用

---

## 0.5 本番ドメインの設定（公開前に1回）
`https://spark.example.com` はプレースホルダ。canonical / og:image / sitemap が参照するため、
本番ドメインに置換すること（2箇所）:
- `src/lib/seo.ts` の `ORIGIN`
- `astro.config.mjs` の `site`

置換後に `npm run build`（→ canonical・OG・sitemap が本番URLになる）。
独自ドメインは Cloudflare Pages の「カスタムドメイン」で割当（DNS は Cloudflare 管理が容易）。

---

## 1. 【あなたの操作】Cloudflare 認証
ブラウザが開き OAuth ログインする（このセッションでは `! ` 前置で実行可）:

```
! npx wrangler login
```

または CI 等で API トークンを使う場合は環境変数で（Pages 編集権限のトークン）:

```
$env:CLOUDFLARE_API_TOKEN = "<token>"
$env:CLOUDFLARE_ACCOUNT_ID = "<account_id>"
```

確認: `npx wrangler whoami`

---

## 2. プロジェクト作成（初回のみ）
```
npx wrangler pages project create spark-lp --production-branch main
```
（ダッシュボードで作成済みなら不要。名前は `wrangler.toml` の `name` と一致させる）

---

## 3. デプロイ
```
npm run deploy
```
`*.pages.dev` の本番 URL が表示される。以降の更新も同じコマンドでよい。

---

## 4. 【あなたの操作】シークレット投入（メール送信を有効化）
未設定だとフォームは「成功」を返すがメールは飛ばない。実運用では最低限これらを設定:

```
npx wrangler pages secret put RESEND_API_KEY --project-name spark-lp
npx wrangler pages secret put CONTACT_TO     --project-name spark-lp   # 受信先メール
# 任意: 独自ドメイン送信元（Resendで検証済みのこと）
npx wrangler pages secret put CONTACT_FROM   --project-name spark-lp
```
投入後にもう一度 `npm run deploy`（または再デプロイ）で反映。

---

## 5. （任意・推奨）レート制限用 KV
```
npx wrangler kv namespace create RATE_LIMIT
```
出力された `id` を `wrangler.toml` の `[[kv_namespaces]]` ブロックに記入してコメント解除 → `npm run deploy`。
これで「1分5回/IP」が有効化される。未設定でも honeypot＋time-trap は機能する。

---

## 6. ⚠ Turnstile（bot対策）について — 現状は設定しないこと
サーバ（`functions/api/contact.ts`）は `TURNSTILE_SECRET` がある時だけ Turnstile 検証を行うが、
**フロント側のウィジェットが未配線**で `cf-turnstile-response` を送っていない。
→ いま `TURNSTILE_SECRET` を設定すると全送信が弾かれフォームが壊れる。

現状の bot 対策は honeypot（company）＋ time-trap（<2s 拒否）＋ rate-limit（KV）で機能している。
Turnstile を足したい場合は、フォームへのウィジェット配線（+ `PUBLIC_TURNSTILE_SITEKEY` をビルド時に注入、
CSP に `https://challenges.cloudflare.com` を許可）が必要。希望すれば実装する。

---

## 7. 公開後の検証
- フォーム送信 → 受信メール到達（Resend 設定時）/ 空送信でアクセシブルなエラー
- 3D ヒーローが実ブラウザで描画（WebGL）。WebGL 不可/低モーション環境は静的フォールバック
- **securityheaders.com** に本番 URL を入力 → **A+** を確認
  （CSP は unsafe-inline 排除済み・HSTS preload・X-Content-Type-Options 等を `_headers` で付与）
- Lighthouse（任意・実機）: perf99 / a11y100 / bp100 / seo100 / CLS0 を再確認

---

## ローカルで Functions を試す（任意）
```
cp .dev.vars.example .dev.vars   # 値を記入（.dev.vars は gitignore 済み）
npm run build
npx wrangler pages dev dist
```

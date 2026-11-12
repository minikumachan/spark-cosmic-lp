import { defineConfig } from "@playwright/test";

// 組み立てた dist を、Cloudflare Pages と同じく _headers（CSP など）を付けて配る wrangler pages dev で検証する。
// astro preview は _headers を読まないので、CSP に止められる不具合が手元の試験では見えなかった（2026-11-12）。
// 先に npm run build を走らせておくこと。
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  webServer: {
    command: "npx wrangler pages dev dist --port 8788 --ip 127.0.0.1",
    url: "http://127.0.0.1:8788",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8788",
  },
});

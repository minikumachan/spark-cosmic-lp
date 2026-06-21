import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { FontaineTransform } from 'fontaine';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// ビルド後、各 HTML のインライン実行 script の sha256 を集計し、
// 'unsafe-inline' を排除した厳格 CSP を dist/_headers に自動生成する。
// （hash 保守を自動化＝スクリプト変更で壊れない。目標: securityheaders.com A+）
function securityHeaders() {
  return {
    name: 'spark-security-headers',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const distPath = fileURLToPath(dir);
        const entries = await readdir(distPath, { recursive: true });
        const htmlFiles = entries.filter((f) => String(f).endsWith('.html'));
        const hashes = new Set();
        const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

        for (const rel of htmlFiles) {
          const html = await readFile(join(distPath, String(rel)), 'utf8');
          for (const m of html.matchAll(scriptRe)) {
            const attrs = m[1];
            const content = m[2];
            if (/\bsrc=/i.test(attrs)) continue; // 外部script は 'self'
            if (/application\/ld\+json/i.test(attrs)) continue; // データ(非実行)
            if (content.trim() === '') continue;
            const h = createHash('sha256').update(content, 'utf8').digest('base64');
            hashes.add(`'sha256-${h}'`);
          }
        }

        const csp = [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "img-src 'self' data:",
          "font-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          `script-src 'self' ${[...hashes].join(' ')}`,
          "connect-src 'self'",
        ].join('; ');

        const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  X-Frame-Options: DENY

/fonts/*
  Cache-Control: public, max-age=31536000

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
`;
        await writeFile(join(distPath, '_headers'), headers, 'utf8');
      },
    },
  };
}

export default defineConfig({
  site: 'https://spark-lp.pages.dev',
  // dev ツールバーは下部に出て邪魔なので無効（本番ビルドには元々含まれない）
  devToolbar: { enabled: false },
  integrations: [react(), sitemap(), securityHeaders()],
  vite: {
    plugins: [
      FontaineTransform.vite({
        fallbacks: ['Arial', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'sans-serif'],
        resolvePath: (id) => new URL(`./public${id}`, import.meta.url),
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          // three を独立チャンク化（大きく安定＝キャッシュ効率向上）。postprocessing も分離。
          manualChunks(id) {
            if (id.includes('node_modules/three/')) return 'three';
            if (id.includes('postprocessing')) return 'postprocessing';
            return undefined;
          },
        },
      },
    },
  },
});

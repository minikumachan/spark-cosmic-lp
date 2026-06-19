// 型チェックは src/** に集中させ、本ファイルは build で検証する（@tailwindcss/vite と
// Astro の vite 型の既知の不一致を避けるため @ts-check は付けない）。
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { FontaineTransform } from 'fontaine';

// NOTE:
// - Tailwind v4 は PostCSS 経由（postcss.config.mjs）で適用。
//   Astro 6 の rolldown-vite と @tailwindcss/vite の非互換を回避するため。
// - fontaine はフォントのフォールバックにメトリクスを注入し CLS=0 を担保する。
// - Cloudflare adapter + output:'server' (form endpoint) は P4 で追加する。
export default defineConfig({
  site: 'https://spark.example.com',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [
      FontaineTransform.vite({
        fallbacks: ['Arial', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'sans-serif'],
        resolvePath: (id) => new URL(`./public${id}`, import.meta.url),
      }),
    ],
  },
});

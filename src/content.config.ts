import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "zod";

// アクセントはデザイントークン名（blue/magenta/coral/...）。コンポーネント側で完全クラスにマップする。
const accent = z.enum([
  "blue",
  "cyan",
  "magenta",
  "coral",
  "orange",
  "lime",
  "green",
  "purple",
]);

const services = defineCollection({
  loader: file("src/data/services.yaml"),
  schema: z.object({
    title: z.string(),
    en: z.string(),
    icon: z.string(),
    desc: z.string(),
    accent,
  }),
});

const works = defineCollection({
  loader: file("src/data/works.yaml"),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    shape: z.string(),
    accent,
    alt: z.string(),
    tags: z.array(z.string()),
    desc: z.string(),
    // 「詳しく見る」で下に開く中身（課題 → 取り組み → 成果 → 期間・担当範囲・体制）
    detail: z.object({
      problem: z.string(),
      did: z.string(),
      result: z.string(),
      period: z.string(),
      scope: z.string(),
      team: z.string(),
    }),
  }),
});

const strengths = defineCollection({
  loader: file("src/data/strengths.yaml"),
  schema: z.object({
    title: z.string(),
    metric: z.number(),
    suffix: z.string(),
    // 裏付けの無い見本の数字（頁で「※」を付ける）
    sample: z.boolean().default(false),
    desc: z.string(),
    icon: z.string(),
    accent,
  }),
});

const pricing = defineCollection({
  loader: file("src/data/pricing.yaml"),
  schema: z.object({
    name: z.string(),
    en: z.string(),
    // 税別の円。税込は頁の側で出す。要相談のプランは書かない
    price: z.number().int().positive().optional(),
    period: z.string(),
    // 要相談のプランの一言（price が無い時に価格の下へ出す）
    note: z.string().optional(),
    features: z.array(z.string()),
    featured: z.boolean().default(false),
  }),
});

const faq = defineCollection({
  loader: file("src/data/faq.yaml"),
  schema: z.object({
    q: z.string(),
    a: z.string(),
  }),
});

export const collections = { services, works, strengths, pricing, faq };

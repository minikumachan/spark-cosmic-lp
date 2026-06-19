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
  }),
});

const strengths = defineCollection({
  loader: file("src/data/strengths.yaml"),
  schema: z.object({
    title: z.string(),
    metric: z.number(),
    suffix: z.string(),
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
    price: z.string(),
    period: z.string(),
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

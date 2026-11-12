import { z } from "zod";
import {
  BUDGET_OPTIONS,
  EMAIL_RE,
  LIMITS,
  PLAN_OPTIONS,
  TIMING_OPTIONS,
  type Option,
} from "./contact-fields";

// サーバ（Cloudflare Function）で使う検証スキーマ。上限と選択肢は contact-fields.ts と同じ物を使う。
// company は honeypot（人間は空のまま）。値が入っていれば bot とみなして弾く。

// 選ぶ欄（どれも任意）。選んでいない時はフォームから空の文字が届く。決まった値以外は弾く。
const choice = (opts: readonly Option[]) =>
  z
    .union([
      z.literal(""),
      z.enum(opts.map((o) => o.value) as [string, ...string[]]),
    ])
    .optional();

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "お名前を入力してください")
    .max(LIMITS.name, `${LIMITS.name}文字以内で入力してください`),
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .max(LIMITS.email, "メールアドレスが長すぎます")
    .pipe(
      z.email({
        pattern: EMAIL_RE,
        error: "メールアドレスの形式が正しくありません",
      }),
    ),
  message: z
    .string()
    .trim()
    .min(LIMITS.messageMin, `${LIMITS.messageMin}文字以上で入力してください`)
    .max(LIMITS.messageMax, `${LIMITS.messageMax}文字以内で入力してください`),
  plan: choice(PLAN_OPTIONS),
  budget: choice(BUDGET_OPTIONS),
  timing: choice(TIMING_OPTIONS),
  // honeypot: スキーマ上は寛容にし、サーバ側で「値があれば bot」と判定（サイレント拒否）。
  company: z.string().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

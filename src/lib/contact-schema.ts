import { z } from "zod";

// クライアント(RHF)とサーバ(Cloudflare Function)で共有する検証スキーマ。
// company は honeypot（人間は空のまま）。値が入っていれば bot とみなして弾く。
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "お名前を入力してください")
    .max(100, "100文字以内で入力してください"),
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .max(200, "メールアドレスが長すぎます")
    .pipe(z.email("メールアドレスの形式が正しくありません")),
  message: z
    .string()
    .trim()
    .min(10, "10文字以上で入力してください")
    .max(2000, "2000文字以内で入力してください"),
  // honeypot: スキーマ上は寛容にし、サーバ側で「値があれば bot」と判定（サイレント拒否）。
  company: z.string().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

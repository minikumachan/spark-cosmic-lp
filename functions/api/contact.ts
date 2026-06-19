// Cloudflare Pages Function: /api/contact （フォーム受信・堅牢化）
// 静的サイト本体(Astro)とは独立。Cloudflare Pages が functions/ を自動デプロイする。
import { contactSchema } from "../../src/lib/contact-schema";

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

interface Env {
  TURNSTILE_SECRET?: string;
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
  RATE_LIMIT?: KVNamespace;
}

interface EventContext {
  request: Request;
  env: Env;
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

async function verifyTurnstile(
  token: string | undefined,
  secret: string,
  ip: string | null,
): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

export async function onRequestPost(context: EventContext): Promise<Response> {
  const { request, env } = context;
  const ip = request.headers.get("CF-Connecting-IP");

  // rate-limit（KV が bind されていれば 1分5回/IP）
  if (env.RATE_LIMIT && ip) {
    const key = `rl:${ip}`;
    const current = Number((await env.RATE_LIMIT.get(key)) ?? "0");
    if (current >= 5) return json({ ok: false, error: "rate_limited" }, 429);
    await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: 60 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // time-trap（2秒未満の送信は bot）
  const elapsed = Number(payload._elapsed ?? 0);
  if (elapsed > 0 && elapsed < 2000) {
    return json({ ok: false, error: "too_fast" }, 400);
  }

  // honeypot（値が入っていれば bot → 成功を偽装して無視）
  if (typeof payload.company === "string" && payload.company.length > 0) {
    return json({ ok: true }, 200);
  }

  // サーバ側スキーマ再検証（信頼境界）
  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) return json({ ok: false, error: "validation" }, 400);

  // Turnstile（secret があれば検証）
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(
      payload["cf-turnstile-response"] as string | undefined,
      env.TURNSTILE_SECRET,
      ip,
    );
    if (!ok) return json({ ok: false, error: "turnstile" }, 400);
  }

  // メール転送（Resend キーがあれば送信。無ければ成功扱い＝ローカル/未設定時）
  if (env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM ?? "spark <onboarding@resend.dev>",
        to: env.CONTACT_TO ?? "owner@example.com",
        reply_to: parsed.data.email,
        subject: `【spark】お問い合わせ: ${parsed.data.name}`,
        text: `お名前: ${parsed.data.name}\nメール: ${parsed.data.email}\n\n${parsed.data.message}`,
      }),
    });
    if (!res.ok) return json({ ok: false, error: "send_failed" }, 502);
  }

  return json({ ok: true }, 200);
}

// 問い合わせフォームの欄の決まり（文字数の上限・選ぶ欄の選択肢・誤りの文）。
// 画面（index.astro の表示とブラウザでの確認）とサーバー（functions/api/contact.ts）の両方がここを読む。
// zod を読まないので、ブラウザに送る JS が重くならない。サーバーの確認（contact-schema.ts）も同じ数字を使う。

export const LIMITS = {
  name: 100,
  email: 200,
  messageMin: 10,
  messageMax: 2000,
} as const;

export type Option = { readonly value: string; readonly label: string };

// プランの名前は料金表（pricing.yaml）にもある。ずれたら index.astro の組み立てで止まる。
export const PLAN_OPTIONS = [
  { value: "light", label: "ライトプラン" },
  { value: "standard", label: "スタンダードプラン" },
  { value: "growth", label: "グロースプラン" },
  { value: "undecided", label: "まだ決めていない" },
] as const satisfies readonly Option[];

export const BUDGET_OPTIONS = [
  { value: "lt50", label: "50万円未満" },
  { value: "50-100", label: "50万〜100万円" },
  { value: "100-300", label: "100万〜300万円" },
  { value: "gte300", label: "300万円以上" },
  { value: "undecided", label: "まだ決めていない" },
] as const satisfies readonly Option[];

export const TIMING_OPTIONS = [
  { value: "1m", label: "1か月以内" },
  { value: "3m", label: "3か月以内" },
  { value: "6m", label: "半年以内" },
  { value: "undecided", label: "まだ決めていない" },
] as const satisfies readonly Option[];

/** 選んだ値の表示名（メールの本文に使う）。選んでいない時は「選択なし」。 */
export function optionLabel(opts: readonly Option[], value: unknown): string {
  return opts.find((o) => o.value === value)?.label ?? "選択なし";
}

/**
 * メールアドレスの形。サーバー（contact-schema.ts）も同じこの決まりで確かめる。
 * 画面とサーバーで決まりが違うと、画面で通った物がサーバーで弾かれ、欄ごとの誤りが出ないまま送れなくなるため、1 か所に置く。
 * 中身は zod の既定の email の決まりと同じ（返信先として Resend に渡すので、「@」の前が「.」で終わる形などは通さない）。
 */
export const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export type FieldName = "name" | "email" | "message";

/**
 * 欄の値から誤りの文を返す（誤りが無ければ null）。
 * 文は「何をすれば直るか」を書く（デジタル庁・GOV.UK の誤りの文の形）。頭の「＊」は画面の側で付ける。
 */
export function fieldError(name: FieldName, raw: string): string | null {
  const v = raw.trim();
  switch (name) {
    case "name":
      if (!v) return "お名前を入力してください";
      if (v.length > LIMITS.name)
        return `お名前は${LIMITS.name}文字以内で入力してください（いま${v.length}文字です）`;
      return null;
    case "email":
      if (!v) return "メールアドレスを入力してください";
      if (v.length > LIMITS.email || !EMAIL_RE.test(v))
        return "メールアドレスを you@example.com のような形で入力してください";
      return null;
    case "message":
      if (!v) return "ご相談内容を入力してください";
      if (v.length < LIMITS.messageMin)
        return `ご相談内容を${LIMITS.messageMin}文字以上で入力してください（いま${v.length}文字です）`;
      if (v.length > LIMITS.messageMax)
        return `ご相談内容は${LIMITS.messageMax}文字以内で入力してください（いま${v.length}文字です）`;
      return null;
  }
}

// 単発UI文字列の外部化（i18n の土台。第2言語を足す際はこのオブジェクトを差し替える）。

export const nav = [
  { href: "#services", label: "サービス" },
  { href: "#works", label: "実績" },
  { href: "#strengths", label: "強み" },
  { href: "#pricing", label: "料金" },
  { href: "#faq", label: "FAQ" },
] as const;

export const site = {
  brand: "spark",
  nav,
  cta: { label: "お問い合わせ", href: "#contact" },

  hero: {
    eyebrow: "Creative Studio",
    title: ["ブランドも、体験も、", "次のステージへ。"],
    lead: "spark は、ブランド戦略からデザイン、開発までを一貫して手がけます。アイデアに火花を、ビジネスに推進力を。",
    primary: { label: "無料で相談する", href: "#contact" },
    secondary: { label: "実績を見る", href: "#works" },
    // sample: 裏付けの無い見本の数字。頁では「※」を付け、下に notice.numbers を出す
    stats: [
      { value: "120", label: "プロジェクト", sample: true },
      { value: "98%", label: "顧客満足度", sample: true },
      { value: "2週", label: "最短初稿", sample: false },
    ],
  },

  // spark は授業の課題で作った架空のスタジオ。数字・会社・事例が本物に見えないよう、頁の中でそう書く（2026-11-12 まぼさんの選択）
  notice: {
    numbers:
      "※ spark は授業の課題で作った架空のスタジオです。数字は見本で、実際の実績ではありません。",
    site: "このサイトは授業の課題で作った架空のスタジオの LP です。掲載している会社・事例・数字はすべて見本です。",
    work: "架空の事例です。",
  },

  sections: {
    services: {
      eyebrow: "Services",
      title: "できること",
      lead: "戦略から実装まで、ブランドの成長に必要なことを一つの窓口で引き受けます。",
    },
    works: {
      eyebrow: "Works",
      title: "制作実績",
      lead: "業種・規模を問わず、ブランドの「次のステージ」を共につくってきました。",
    },
    strengths: {
      eyebrow: "Strengths",
      title: "私たちの強み",
      lead: "見た目の良さだけでは終わらせない。成果につながる4つの理由。",
    },
    pricing: {
      eyebrow: "Pricing",
      title: "料金プラン",
      lead: "プロジェクトの規模に合わせて、最適な進め方をご提案します。",
      note: "表示の価格は目安です。ページ数や機能に合わせてお見積りします。",
      badge: "おすすめ",
      taxIn: "（税込）",
      taxEx: "税別",
      ask: "要相談",
    },
    faq: {
      eyebrow: "FAQ",
      title: "よくある質問",
      lead: "ご依頼前に多くいただく質問をまとめました。",
    },
  },

  contact: {
    eyebrow: "Contact",
    title: ["一緒に、", "次のステージへ。"],
    lead: "まずは気軽にご相談ください。あなたのブランドに、最適な一手を。",
    required: "※必須",
    optional: "※任意",
    choose: "選択してください",
    fields: {
      name: { label: "お名前" },
      email: {
        label: "メールアドレス",
        support: "返信はこのアドレスに送ります。",
      },
      plan: { label: "ご希望のプラン" },
      budget: { label: "ご予算" },
      timing: { label: "ご希望の時期" },
      message: {
        label: "ご相談内容",
        support:
          "10文字以上で、プロジェクトの概要や困っていることを書いてください。",
      },
    },
    privacy: {
      before: "送信すると、",
      link: "個人情報の取り扱い",
      after:
        "に同意したものとみなします。いただいた情報は、このご相談への返信にだけ使います。",
    },
    submit: "送信する",
    note: "通常2営業日以内に、メールで返信します。",
    // 送信した後に「次に何がいつ起きるか」を書く（GOV.UK の完了画面の形）
    done: {
      title: "送信しました",
      sent: "2営業日以内に、入力したメールアドレスへ返信します。届かない時は、迷惑メールのフォルダも確認してください。",
      // サーバーにメールの送信の設定が無い時（届かないのに「返信します」と書かない）
      unsent:
        "このサイトは授業の課題の見本のため、いま送った内容はメールでは届いていません。",
    },
  },

  footer: {
    copyright: "© 2026 spark",
    links: [
      { label: "サービス", href: "#services" },
      { label: "制作実績", href: "#works" },
      { label: "料金", href: "#pricing" },
      { label: "よくある質問", href: "#faq" },
      { label: "お問い合わせ", href: "#contact" },
      { label: "個人情報の取り扱い", href: "/privacy/" },
    ],
  },
} as const;

// 旅の停留所（上の航路に出す順番）。惑星の名前と節の名前の組はここにだけ書く。
// 並びは 3D のカメラ（CosmicStage の STOPS）と段階遷移（index.astro の STAGE_SEL）と同じにしておく。
export const journey = [
  { href: "#top", planet: "地球", label: "はじめに" },
  { href: "#services", planet: "火星", label: site.sections.services.title },
  { href: "#works", planet: "木星", label: site.sections.works.title },
  { href: "#strengths", planet: "土星", label: site.sections.strengths.title },
  { href: "#pricing", planet: "天王星", label: site.sections.pricing.title },
  { href: "#faq", planet: "海王星", label: site.sections.faq.title },
  { href: "#contact", planet: "銀河", label: site.cta.label },
] as const;

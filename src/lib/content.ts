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
    lead: "spark は、ブランド戦略からデザイン、開発までを一気通貫で。アイデアに火花を、ビジネスに推進力を。",
    primary: { label: "無料で相談する", href: "#contact" },
    secondary: { label: "実績を見る", href: "#works" },
    stats: [
      { value: "120+", label: "プロジェクト" },
      { value: "98%", label: "顧客満足度" },
      { value: "2週", label: "最短初稿" },
    ],
  },

  sections: {
    services: { eyebrow: "Services", title: "できること", lead: "戦略から実装まで、ブランドの成長に必要な機能を一つの窓口で。" },
    works: { eyebrow: "Works", title: "制作実績", lead: "業種・規模を問わず、ブランドの「次のステージ」を共につくってきました。" },
    strengths: { eyebrow: "Strengths", title: "私たちの強み", lead: "見た目の良さだけでは終わらせない。成果につながる4つの理由。" },
    pricing: { eyebrow: "Pricing", title: "料金プラン", lead: "プロジェクトの規模に合わせて、最適な進め方をご提案します。" },
    faq: { eyebrow: "FAQ", title: "よくある質問", lead: "ご依頼前に多くいただく質問をまとめました。" },
  },

  contact: {
    eyebrow: "Contact",
    title: ["一緒に、", "次のステージへ。"],
    lead: "まずは気軽にご相談ください。あなたのブランドに、最適な一手を。",
    fields: {
      name: { label: "お名前", placeholder: "spark 太郎" },
      email: { label: "メールアドレス", placeholder: "you@example.com" },
      message: { label: "ご相談内容", placeholder: "プロジェクトの概要やご予算など、わかる範囲で教えてください。" },
    },
    submit: "送信する",
    note: "通常2営業日以内にご返信します。",
  },

  footer: {
    tagline: "アイデアに火花を、ビジネスに推進力を。",
    copyright: "© 2026 spark. All rights reserved.",
    groups: [
      { heading: "Studio", links: [{ label: "サービス", href: "#services" }, { label: "実績", href: "#works" }, { label: "強み", href: "#strengths" }] },
      { heading: "Info", links: [{ label: "料金", href: "#pricing" }, { label: "FAQ", href: "#faq" }, { label: "お問い合わせ", href: "#contact" }] },
    ],
  },
} as const;

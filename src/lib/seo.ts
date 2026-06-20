export interface MetaInput {
  title: string;
  description: string;
  image?: string;
  canonical?: string;
}

const SITE_NAME = "spark";
const ORIGIN = "https://spark-lp.pages.dev";

/** ページ共通のメタ情報を組み立てる（title はサイト名を付与） */
export function buildMeta(input: MetaInput) {
  return {
    title: `${input.title} | ${SITE_NAME}`,
    description: input.description,
    canonical: input.canonical ?? `${ORIGIN}/`,
    image: input.image ?? `${ORIGIN}/assets/og/og-default.png`,
  };
}

/** Organization 構造化データ（§18）。FAQPage は P1 の FAQ 実装時に追加する。 */
export const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: ORIGIN,
  description:
    "ブランドも、体験も、次のステージへ。制作・ブランディングスタジオ spark。",
} as const;

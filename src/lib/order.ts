// getCollection が返す並びは決まっていない（Astro の公式の説明でも「並びが要る時は自分で並べ替える」とある）。
// 中間発表の版は id の名前順で出ていて、料金表が「グロース → ライト → スタンダード」になっていた。
// YAML に書いた順を正として並べ直す。順の数字を別に書かないので、YAML の並びを入れ替えれば頁の並びも変わる。
export function inFileOrder<T extends { id: string }>(
  entries: T[],
  raw: string,
  name: string,
): T[] {
  const ids = [...raw.matchAll(/^- id:\s*["']?([^"'\s#]+)/gm)].map((m) => m[1]);
  const rank = new Map(ids.map((id, i) => [id, i] as const));
  const missing = entries.filter((e) => !rank.has(e.id)).map((e) => e.id);
  if (missing.length > 0 || ids.length !== entries.length) {
    throw new Error(
      `${name}.yaml から並び順を取れません（YAML の id ${ids.length} 件 / 読み込んだ ${entries.length} 件 / 見つからない id: ${missing.join(", ") || "無し"}）`,
    );
  }
  return [...entries].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
}

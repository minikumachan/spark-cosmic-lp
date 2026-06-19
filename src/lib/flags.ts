// 軽量フィーチャーフラグ（A/B の器）。過剰にしない方針。
export interface Flags {
  heroVariant: "a" | "b";
}

export const flags: Flags = {
  heroVariant: "a",
};

export function getFlag<K extends keyof Flags>(key: K): Flags[K] {
  return flags[key];
}

// アクセントトークン名 → 完全な Tailwind クラス（動的生成不可のため literal で保持）。
export type Accent =
  | "blue"
  | "cyan"
  | "magenta"
  | "coral"
  | "orange"
  | "lime"
  | "green"
  | "purple";

export const accentBg: Record<Accent, string> = {
  blue: "bg-blue",
  cyan: "bg-cyan",
  magenta: "bg-magenta",
  coral: "bg-coral",
  orange: "bg-orange",
  lime: "bg-lime",
  green: "bg-green",
  purple: "bg-purple",
};

export const accentText: Record<Accent, string> = {
  blue: "text-blue",
  cyan: "text-cyan",
  magenta: "text-magenta",
  coral: "text-coral",
  orange: "text-orange",
  lime: "text-green",
  green: "text-green",
  purple: "text-purple",
};

// 淡いアクセント背景（アイコンチップ等）。lime/cyan/orange は白地で薄いと視認性が落ちるため濃度を調整。
export const accentSoftBg: Record<Accent, string> = {
  blue: "bg-blue/10",
  cyan: "bg-cyan/15",
  magenta: "bg-magenta/10",
  coral: "bg-coral/10",
  orange: "bg-orange/15",
  lime: "bg-lime/20",
  green: "bg-green/15",
  purple: "bg-purple/10",
};

// 計測の抽象レイヤ。GA4/GTM の dataLayer に push するだけ。
// 実 ID 未設定でも no-op 的に動作（P5 で GTM タグ/同意管理を注入）。

export type AnalyticsEvent =
  | "cta_click"
  | "section_view"
  | "form_focus"
  | "form_submit"
  | "form_success"
  | "form_error"
  | "theme_toggle";

interface DataLayerWindow extends Window {
  dataLayer?: Record<string, unknown>[];
}

export function track(
  event: AnalyticsEvent,
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...payload });
}

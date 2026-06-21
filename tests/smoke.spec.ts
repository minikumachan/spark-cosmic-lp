import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// コズミック版 spark LP の品質ゲート（3D背景は装飾・内容はSSR HTML）

test("ページ読込・主要セクション・a11y構造が揃う", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // 装飾3Dを止めて内容(SSR HTML)を決定的に検証
  await page.goto("/");
  await expect(page).toHaveTitle(/spark/);
  await expect(page.locator("h1")).toBeVisible();
  // カード脱却の全セクションのアンカーが存在
  for (const id of ["#services", "#works", "#strengths", "#pricing", "#faq", "#contact"]) {
    await expect(page.locator(id)).toHaveCount(1);
  }
  // ランドマーク／スキップリンク／単一h1
  await expect(page.locator("main#main")).toHaveCount(1);
  await expect(page.locator('a.skip-link[href="#main"]')).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
});

test("構造化データ（Organization / FAQPage）と canonical・noindex無し", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('"Organization"'))).toBe(true);
  expect(ld.some((t) => t.includes('"FAQPage"'))).toBe(true);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /spark-lp\.pages\.dev/);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});

test("コンタクトフォーム: 不備送信で role=status のアクセシブルなエラー", async ({ page }) => {
  // 入場アニメ/smoothスクロールで要素が動き続けると actionability が安定しないため確定状態で
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  const submit = page.locator("#contact-form .cform-submit");
  await submit.scrollIntoViewIfNeeded();
  const status = page.locator("#contact-form .cform-status");
  await expect(status).toHaveAttribute("role", "status");
  await expect(status).toHaveAttribute("aria-live", "polite");
  // インラインモジュール(deferred)のハンドラ装着を挙動で待つ
  await expect(async () => {
    await submit.click();
    await expect(status).toHaveClass(/err/, { timeout: 1500 });
  }).toPass({ timeout: 20000 });
  await expect(status).toContainText("ご確認");
});

test("モバイル375: 横スクロール（オーバーフロー）が無い", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("惑星図鑑（鑑賞モード）が開き、Escで閉じる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  const fab = page.locator("#viewer-open");
  await expect(fab).toBeVisible();
  // PlanetViewer は client:idle。水和＋イベント購読まで挙動で待つ（headless では idle が遅延し得る）
  await expect(async () => {
    await fab.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

test("axe a11y 違反0（dark・reduced-motion）", async ({ page }) => {
  // 動く宇宙背景・遷移の途中色を避けて確定状態で測る
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.screenshot({ path: "tests/__screenshots__/cosmic-home.png", fullPage: true });
});

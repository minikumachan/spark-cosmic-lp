import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("data-theme がロード時に確定している（FOUC無し）", async ({ page }) => {
  await page.goto("/");
  const theme = await page.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(theme);
});

test("テーマトグルが切替わり永続する", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator("html").getAttribute("data-theme");
  await page.locator("#theme-toggle").click();
  const after = await page.locator("html").getAttribute("data-theme");
  expect(after).not.toBe(before);

  await page.reload();
  const persisted = await page.locator("html").getAttribute("data-theme");
  expect(persisted).toBe(after);
});

test("axe a11y 違反0（light/dark 両テーマ）", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await page.goto("/");
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);

    await page.screenshot({
      path: `tests/__screenshots__/home-${theme}.png`,
      fullPage: true,
    });
  }
});

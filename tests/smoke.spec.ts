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

test("コンタクトフォーム: 空送信でアクセシブルなエラー表示", async ({ page }) => {
  await page.goto("/");
  const submit = page.locator("#contact form button[type=submit]");
  await submit.scrollIntoViewIfNeeded();
  // 島の水和タイミングに依存せず、検証エラーが出るまで送信を再試行する。
  // （client:visible の水和完了マーカーは環境差があり信頼できないため、挙動で待つ）
  await expect(async () => {
    await submit.click();
    await expect(page.locator("#name-error")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });

  await expect(page.locator("#email-error")).toBeVisible();
  await expect(page.locator("#message-error")).toBeVisible();
  await expect(page.locator("#name")).toHaveAttribute("aria-invalid", "true");
});

test("axe a11y 違反0（light/dark 両テーマ）", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    // FOUC スクリプトにペイント前へテーマを確定させる。
    // （JSで data-theme を切替えると transition-colors の遷移途中色を axe が拾い誤検知するため）
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {
        /* noop */
      }
    }, theme);
    // モーションを実際に無効化して確定状態で測る（scroll-driven/遷移の途中色を避ける）
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

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

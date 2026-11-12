import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// 最初の案内（dialog）は初回に自動で開くので、既存の試験では「見た」状態から始める。案内そのものは final.spec.ts で確かめる。
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("spark:guide:v1", "seen");
    } catch {}
  });
});

// コズミック版 spark LP の品質ゲート（3D背景は装飾・内容はSSR HTML）

test("ページ読込・主要セクション・a11y構造が揃う", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // 装飾3Dを止めて内容(SSR HTML)を決定的に検証
  await page.goto("/");
  await expect(page).toHaveTitle(/spark/);
  await expect(page.locator("h1")).toBeVisible();
  // カード脱却の全セクションのアンカーが存在
  for (const id of [
    "#services",
    "#works",
    "#strengths",
    "#pricing",
    "#faq",
    "#contact",
  ]) {
    await expect(page.locator(id)).toHaveCount(1);
  }
  // ランドマーク／スキップリンク／単一h1
  await expect(page.locator("main#main")).toHaveCount(1);
  await expect(page.locator('a.skip-link[href="#main"]')).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
});

test("構造化データ（Organization / FAQPage）と canonical・noindex無し", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const ld = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(ld.some((t) => t.includes('"Organization"'))).toBe(true);
  expect(ld.some((t) => t.includes('"FAQPage"'))).toBe(true);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /spark-lp\.pages\.dev/,
  );
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).toHaveCount(0);
});

test("コンタクトフォーム: 不備送信で誤りのまとめへ移り、送信の状態は role=status で知らせる", async ({
  page,
}) => {
  // 入場アニメ/smoothスクロールで要素が動き続けると actionability が安定しないため確定状態で
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  const submit = page.locator("#contact-form .cform-submit");
  await submit.scrollIntoViewIfNeeded();
  const status = page.locator("#contact-form .cform-status");
  await expect(status).toHaveAttribute("role", "status");
  await expect(status).toHaveAttribute("aria-live", "polite");
  // インラインモジュール(deferred)のハンドラ装着を待つ（装着の最後に data-ready が付く）
  await expect(page.locator("#contact-form[data-ready]")).toHaveCount(1, {
    timeout: 20000,
  });
  await submit.click();
  const sum = page.locator("#cf-sum");
  await expect(sum).toBeVisible();
  await expect(sum).toBeFocused();
  await expect(sum).toContainText("入力内容を確認してください");
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
  // 図鑑は最初の表示の後に釦を待ち受け、初めて押された時に本体を読み込む。読み込みまで挙動で待つ
  await expect(async () => {
    await fab.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 30000 });
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

test("惑星図鑑を開くと焦点が中へ入り、Tab で後ろの頁へ抜けず、閉じると開いた釦へ戻る", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?guide=0", { waitUntil: "networkidle" });
  const fab = page.locator("#viewer-open");
  await expect(async () => {
    await fab.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 30000 });
  await expect(page.locator(".pv-close")).toBeFocused();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return "outside";
      return a.closest(".pv-overlay") ? "viewer" : "behind";
    });
    expect(where, `Tab ${i + 1} 回目`).not.toBe("behind");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(fab).toBeFocused();
});

test("axe a11y 違反0（dark・reduced-motion）", async ({ page }) => {
  // 動く宇宙背景・遷移の途中色を避けて確定状態で測る
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
    path: "tests/__screenshots__/cosmic-home.png",
    fullPage: true,
  });
});

// ── スクロール段階遷移（step モード）。?scroll=step で reduced-motion でも強制。
//    reduced-motion 下では遷移は即時（カメラ飛行アニメは headed で別途確認）だが、
//    API・ドット・キー/postMessage の遷移ロジックを決定的に検証する。 ──
test("step モード: API・進行ドット・キー/postMessage で段階遷移する", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scroll=step");
  // step で初期化（?scroll=step は reduced-motion を上書き）
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { sparkDeck?: { mode?: string } }).sparkDeck
            ?.mode,
      ),
    )
    .toBe("step");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { sparkDeck: { stageCount: number } }).sparkDeck
          .stageCount,
    ),
  ).toBe(7);
  // 進行ドット 7 個（desktop 既定ビューポート）
  await expect(page.locator(".deck-dots .deck-dot")).toHaveCount(7);
  // 初期は最上部
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);
  // ArrowDown で前進
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 })
    .toBeGreaterThan(50);
  // postMessage（プレゼン埋め込み同期の経路）で最終ステージへ
  await page.evaluate(() =>
    window.postMessage({ type: "spark:goto", stage: 6 }, "*"),
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                sparkDeck: { getState: () => { stage: number } };
              }
            ).sparkDeck.getState().stage,
        ),
      { timeout: 6000 },
    )
    .toBe(6);
});

test("通常スクロールが既定（mode=free・進行ドット無し）", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { sparkDeck?: { mode?: string } }).sparkDeck
            ?.mode,
      ),
    )
    .toBe("free");
  await expect(page.locator(".deck-dots")).toHaveCount(0);
});

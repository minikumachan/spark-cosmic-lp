import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// 最終発表で足した 3 つ（上の航路と相談の釦・最初の案内・左下の時間の操作）の試験。

const markGuideSeen = (page: Page) =>
  page.addInitScript(() => {
    try {
      localStorage.setItem("spark:guide:v1", "seen");
    } catch {}
  });

test.describe("最初の案内", () => {
  test("初めて来た時だけ開き、「旅を始める」で閉じると次からは出ない", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const guide = page.locator("dialog#spark-guide");
    await expect(guide).toBeVisible({ timeout: 15000 });
    await expect(
      guide.getByRole("heading", { name: "spark の歩き方" }),
    ).toBeVisible();
    await guide.getByRole("button", { name: "旅を始める" }).click();
    await expect(guide).toBeHidden();
    // dialog の close は閉じた後のタスクで届く（仕様）。消えた直後に読むと保存の前になるので待つ
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("spark:guide:v1")))
      .toBe("seen");
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(guide).toBeHidden();
  });

  test("「次からは表示しない」を外して Esc で閉じると、次も出る", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const guide = page.locator("dialog#spark-guide");
    await expect(guide).toBeVisible({ timeout: 15000 });
    await guide.getByLabel("次からは表示しない").uncheck();
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    expect(
      await page.evaluate(() => localStorage.getItem("spark:guide:v1")),
    ).toBeNull();
    await page.reload();
    await expect(guide).toBeVisible({ timeout: 15000 });
  });

  test("上の航路の「使い方」からいつでも開ける", async ({ page }) => {
    await markGuideSeen(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });
    const guide = page.locator("dialog#spark-guide");
    await expect(guide).toBeHidden();
    await page
      .getByRole("navigation", { name: "ページ内の案内" })
      .getByRole("button", { name: "使い方" })
      .click();
    await expect(guide).toBeVisible();
  });

  test("案内が開いた状態でも axe の違反 0", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?guide=1");
    await expect(page.locator("dialog#spark-guide")).toBeVisible({
      timeout: 15000,
    });
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
});

test.describe("上の航路と相談の釦", () => {
  test.beforeEach(async ({ page }) => {
    await markGuideSeen(page);
  });

  test("7 つの停留所・現在地・相談の釦があり、押すとその節へ移る", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation", { name: "ページ内の案内" });
    const stops = nav.locator(".tn-stop");
    await expect(stops).toHaveCount(7);
    await expect(stops.first()).toHaveAttribute("aria-current", "location");
    await expect(
      nav.getByRole("link", { name: "無料で相談する" }),
    ).toHaveAttribute("href", "#contact");
    await nav.getByRole("link", { name: /料金プラン/ }).click();
    await expect(stops.nth(4)).toHaveAttribute("aria-current", "location", {
      timeout: 6000,
    });
    await expect(nav.locator('.tn-stop[aria-current="location"]')).toHaveCount(
      1,
    );
    const top = await page.evaluate(
      () => document.querySelector("#pricing")!.getBoundingClientRect().top,
    );
    expect(Math.abs(top)).toBeLessThan(80);
  });

  test("スマホでは現在地と相談の釦だけを出し、現在地を押すと航路が開く", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation", { name: "ページ内の案内" });
    const here = nav.locator(".tn-here");
    await expect(nav.locator(".tn-stop").first()).toBeHidden();
    await expect(here).toBeVisible();
    await expect(here).toContainText("はじめに");
    await expect(
      nav.getByRole("link", { name: "無料で相談する" }),
    ).toBeVisible();
    await here.click();
    await expect(here).toHaveAttribute("aria-expanded", "true");
    await nav.getByRole("link", { name: /よくある質問/ }).click();
    await expect(here).toHaveAttribute("aria-expanded", "false");
    await expect(here).toContainText("よくある質問", { timeout: 6000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test("step モードでも航路から段階遷移する", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?scroll=step");
    type Deck = {
      sparkDeck?: { mode?: string; getState: () => { stage: number } };
    };
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Deck).sparkDeck?.mode),
      )
      .toBe("step");
    await page
      .getByRole("navigation", { name: "ページ内の案内" })
      .getByRole("link", { name: /制作実績/ })
      .click();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as Deck).sparkDeck!.getState().stage,
          ),
        { timeout: 6000 },
      )
      .toBe(2);
  });
});

test.describe("左下の時間の操作", () => {
  test.beforeEach(async ({ page }) => {
    await markGuideSeen(page);
  });

  test("3D の時計とつながり、今日に戻る・1か月進める・速さが効く", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const dock = page.getByRole("region", { name: "惑星の位置の日付" });
    // 3D が最初の 1 枚を描いた時に時計が知らせて来るので、それまで待つ
    await expect(dock).toBeVisible({ timeout: 45000 });
    const date = dock.locator(".td-date .td-dv");
    const rel = dock.locator(".td-date .td-rel");

    await dock.getByRole("button", { name: "今日に戻る" }).click();
    await expect(rel).toHaveText("今日");
    await expect(
      dock.getByRole("button", { name: "日付を進める" }),
    ).toBeVisible();
    const today = await page.evaluate(() =>
      new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    );
    await expect(date).toHaveText(today);

    await dock.getByRole("button", { name: "1か月進める" }).click();
    await expect(rel).toHaveText("今日から30日後");

    await dock.getByRole("button", { name: /速さ/ }).click();
    await expect(
      dock.getByRole("button", { name: "速さ 1か月/秒" }),
    ).toBeVisible();
    await expect(
      dock.getByRole("button", { name: "日付を止める" }),
    ).toBeVisible();
    const before = await date.textContent();
    await expect
      .poll(() => date.textContent(), { timeout: 10000 })
      .not.toBe(before);
  });

  test("スマホで右下の釦と重ならず、日付を押すと残りの釦が開く", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const dock = page.getByRole("region", { name: "惑星の位置の日付" });
    await expect(dock).toBeVisible({ timeout: 45000 });
    const a = (await dock.boundingBox())!;
    const b = (await page.locator(".fab-group").boundingBox())!;
    expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    await expect(dock.getByRole("button", { name: "今日に戻る" })).toBeHidden();
    await dock.locator(".td-mtoggle").click();
    await expect(
      dock.getByRole("button", { name: "今日に戻る" }),
    ).toBeVisible();
  });
});

// 別の目のレビュー（2026-11-12）で見つかった 2 つ。直す前に落ちる事を確かめてから直した。
test.describe("レビューで見つかった食い違い", () => {
  test("step モードで最初の案内が自動で開いている間は、後ろの段が進まない", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?scroll=step");
    type Deck = {
      sparkDeck?: { mode?: string; getState: () => { stage: number } };
    };
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Deck).sparkDeck?.mode),
      )
      .toBe("step");
    await expect(page.locator("dialog#spark-guide")).toBeVisible({
      timeout: 15000,
    });
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 800);
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(1500);
    expect(
      await page.evaluate(
        () => (window as unknown as Deck).sparkDeck!.getState().stage,
      ),
    ).toBe(0);
  });

  test.describe("日本時間", () => {
    test.use({ timezoneId: "Asia/Tokyo" });
    test("日本時間の 0〜9 時に止めても、その日の日付を出す", async ({
      page,
    }) => {
      await markGuideSeen(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const dock = page.getByRole("region", { name: "惑星の位置の日付" });
      await expect(dock).toBeVisible({ timeout: 45000 });
      const date = dock.locator(".td-date .td-dv");
      const set = (iso: string) =>
        page.evaluate(
          (d) =>
            window.dispatchEvent(
              new CustomEvent("spark:simdate:set", {
                detail: { date: Date.parse(d), playing: false },
              }),
            ),
          iso,
        );
      // 世界標準時では同じ 11/19 の 2 つの時刻（日本時間では 19 日 23 時と 20 日 3 時）
      await set("2026-11-19T23:00:00+09:00");
      await expect(date).toHaveText("2026年11月19日");
      await set("2026-11-20T03:00:00+09:00");
      await expect(date).toHaveText("2026年11月20日");
    });
  });
});

import { test, expect } from "@playwright/test";

// 一覧が YAML に書いた順で出る事。中間発表の版は id の名前順で出ていて、料金表が「グロース → ライト → スタンダード」だった。
// 頁の文字の中で、書いた順の言葉が前から順に出るかを数える。
const ORDER: Record<string, string[]> = {
  "#services": [
    "ブランディング",
    "UI/UXデザイン",
    "Web開発",
    "クリエイティブディレクション",
  ],
  "#works": [
    "次世代ECのブランド刷新",
    "SaaS管理画面の体験設計",
    "D2CコスメのローンチLP",
    "フィンテックアプリの刷新",
    "コーポレートサイト構築",
    "イベントの世界観設計",
  ],
  "#strengths": [
    "立ち上がりの速さ",
    "戦略から伴走",
    "一貫した世界観",
    "ユーザー起点",
  ],
  "#pricing": ["ライト", "スタンダード", "グロース"],
  "#faq": ["制作期間", "支払い", "リニューアル", "保守", "遠方"],
};

test("一覧が書いた順で出る", async ({ page }) => {
  await page.goto("/");
  for (const [sel, words] of Object.entries(ORDER)) {
    const text = (await page.locator(sel).textContent()) ?? "";
    const pos = words.map((w) => text.indexOf(w));
    expect(
      pos.every((p) => p >= 0),
      `${sel} に無い言葉がある: ${words.filter((_, i) => pos[i] < 0).join(", ")}`,
    ).toBe(true);
    const sorted = [...pos].sort((a, b) => a - b);
    expect(pos, `${sel} の並びが書いた順と違う`).toEqual(sorted);
  }
  const plans = await page.locator("#pricing .pname").allTextContents();
  expect(plans).toEqual(["ライト", "スタンダード", "グロース"]);
});

test("リンクの矢印は読み上げない", async ({ page }) => {
  await page.goto("/");
  for (const a of await page.locator("a.plink, header.hero a.ghost").all()) {
    const name = await a.evaluate((el) => {
      const c = el.cloneNode(true) as HTMLElement;
      c.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      return c.textContent ?? "";
    });
    expect(name).not.toContain("→");
    expect(await a.locator('[aria-hidden="true"]').count()).toBeGreaterThan(0);
  }
});

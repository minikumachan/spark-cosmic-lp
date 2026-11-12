import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// 大手と照らして直した 7 つ（2026-11-12 まぼさんが見本の中で選んだ物）の試験。
// 料金表（税込）・文・見本の数字の注記・フォーム・制作実績・日付の欄・動きの設定。

// 左下の時間の操作は 3D の最初の 1 枚を描いた後に出るので、出るまで最大 45 秒待つ所がある。
// 試験 1 本の持ち時間（既定 30 秒）がそれより短いと、PC が混んでいる時に待ちきる前に切られる（2026-11-12 の通し試験）
test.describe.configure({ timeout: 60_000 });

const markGuideSeen = (page: Page) =>
  page.addInitScript(() => {
    try {
      localStorage.setItem("spark:guide:v1", "seen");
    } catch {}
  });

const openHome = async (page: Page, url = "/") => {
  await markGuideSeen(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // 3D の読み込み（重い）を待たない。頁のスクリプトの準備ができた印（フォームの data-ready）だけを待つ。
  // networkidle を待つと、並べて回した時に 3D の読み込みで 30 秒を使い切る事があった（2026-11-12 の通し試験）
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#contact-form[data-ready]")).toHaveCount(1, {
    timeout: 20000,
  });
};

const formReady = (page: Page) =>
  expect(page.locator("#contact-form[data-ready]")).toHaveCount(1, {
    timeout: 20000,
  });

const axe = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
};

type Deck = {
  sparkDeck?: { mode?: string; getState: () => { stage: number } };
};

test.describe("料金表", () => {
  test("税込を大きく、税別と単位を下に出し、おすすめは 1 つだけ", async ({
    page,
  }) => {
    await openHome(page);
    const plans = page.locator("#pricing .plan");
    await expect(plans.locator(".pprice")).toHaveText([
      "¥330,000〜（税込）",
      "¥880,000〜（税込）",
      "要相談",
    ]);
    await expect(plans.locator(".ptax")).toHaveText([
      "税別 ¥300,000〜1件あたり",
      "税別 ¥800,000〜1件あたり",
      "内容に合わせてお見積りします継続のパートナー契約",
    ]);
    await expect(page.locator("#pricing .pop")).toHaveCount(1);
    await expect(page.locator("#pricing .pop")).toHaveText("おすすめ");
    await expect(page.locator("#pricing .pnote")).toHaveText(
      "表示の価格は目安です。ページ数や機能に合わせてお見積りします。",
    );
  });

  test("「〇〇プランで相談する」を押すと、フォームのプランがそれになる", async ({
    page,
  }) => {
    await openHome(page);
    await formReady(page);
    const links = page.locator("#pricing a.plink");
    await expect(links).toHaveText([
      /ライトプランで相談する/,
      /スタンダードプランで相談する/,
      /グロースプランで相談する/,
    ]);
    await page
      .getByRole("link", { name: "スタンダードプランで相談する" })
      .click();
    await expect(page.locator("#cf-plan")).toHaveValue("standard");
    await page.getByRole("link", { name: "グロースプランで相談する" }).click();
    await expect(page.locator("#cf-plan")).toHaveValue("growth");
  });
});

test.describe("問い合わせフォーム", () => {
  test("誤りは欄ごとに直し方を出し、まとめへ移り、直すと消える", async ({
    page,
  }) => {
    await openHome(page);
    await formReady(page);
    await expect(page.locator('label[for="cf-name"] .freq')).toHaveText(
      "※必須",
    );
    await expect(page.locator('label[for="cf-plan"] .fopt')).toHaveText(
      "※任意",
    );
    await expect(page.locator("#contact-form .cpriv a")).toHaveAttribute(
      "href",
      "/privacy/",
    );
    await expect(page.locator("#contact-form [placeholder]")).toHaveCount(0);

    await page.locator("#cf-msg").fill("短い");
    await page.locator("#contact-form .cform-submit").click();
    const sum = page.locator("#cf-sum");
    await expect(sum).toBeVisible();
    await expect(sum).toBeFocused();
    await expect(sum.locator(".cform-sum-t")).toHaveText(
      "入力内容を確認してください（3件）",
    );
    await expect(sum.locator("a")).toHaveText([
      "お名前を入力してください",
      "メールアドレスを入力してください",
      "ご相談内容を10文字以上で入力してください（いま2文字です）",
    ]);
    await expect(page.locator("#cf-name-err")).toHaveText(
      "＊お名前を入力してください",
    );
    await expect(page.locator("#cf-name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator("#cf-email")).toHaveAccessibleDescription(
      "返信はこのアドレスに送ります。 ＊メールアドレスを入力してください",
    );
    // 入力した内容は消さない
    await expect(page.locator("#cf-msg")).toHaveValue("短い");

    // まとめのリンクで、その欄へ移る
    await sum
      .getByRole("link", { name: "メールアドレスを入力してください" })
      .click();
    await expect(page.locator("#cf-email")).toBeFocused();
    // まだ直っていない間は誤りを残す
    await page.locator("#cf-email").fill("mabo@example");
    await expect(page.locator("#cf-email-err")).toBeVisible();
    // 直ったら、その欄の誤りとまとめの 1 件が消える
    await page.locator("#cf-email").fill("mabo@example.com");
    await expect(page.locator("#cf-email-err")).toBeHidden();
    await expect(page.locator("#cf-email")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(sum.locator(".cform-sum-t")).toHaveText(
      "入力内容を確認してください（2件）",
    );
    await expect(sum.locator("a")).toHaveCount(2);
  });

  test("メールアドレスは画面とサーバーで同じ決まりで確かめる（画面で通してサーバーで弾く事が無い）", async ({
    page,
    request,
  }) => {
    await openHome(page);
    await formReady(page);
    let posted = 0;
    await page.route("**/api/contact", async (route) => {
      posted++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, sent: true }),
      });
    });
    await page.locator("#cf-name").fill("まぼ");
    await page
      .locator("#cf-msg")
      .fill("ブランドの刷新について相談したいです。");
    // 「@」の前が「.」で終わる・「.」が続く・最後の区切りが 1 文字。前は画面だけ通って、サーバーで弾かれていた
    for (const bad of [
      "taro.@docomo.ne.jp",
      "a..b@ezweb.ne.jp",
      "user@example.c",
    ]) {
      await page.locator("#cf-email").fill(bad);
      await page.locator("#contact-form .cform-submit").click();
      await expect(page.locator("#cf-email-err")).toHaveText(
        "＊メールアドレスを you@example.com のような形で入力してください",
      );
    }
    expect(posted).toBe(0);
    // サーバーも同じ物を弾く
    const res = await request.post("/api/contact", {
      data: {
        name: "まぼ",
        email: "taro.@docomo.ne.jp",
        message: "ブランドの刷新について相談したいです。",
        _elapsed: 5000,
      },
    });
    expect(res.status()).toBe(400);
  });

  test("メールで届いた時は、いつ返信が来るかを出し、選んだ欄も送る", async ({
    page,
  }) => {
    let posted: Record<string, unknown> | null = null;
    await page.route("**/api/contact", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, sent: true }),
      });
    });
    await openHome(page);
    await formReady(page);
    await page.locator("#cf-name").fill("まぼ");
    await page.locator("#cf-email").fill("mabo@example.com");
    await page.locator("#cf-plan").selectOption("standard");
    await page.locator("#cf-budget").selectOption("100-300");
    await page.locator("#cf-timing").selectOption("3m");
    await page.locator("#cf-msg").fill("新しいサービスの LP を作りたいです。");
    await page.locator("#contact-form .cform-submit").click();
    const done = page.locator("#contact-form .cform-done");
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
    await expect(done.locator(".cform-done-t")).toHaveText("送信しました");
    await expect(done.locator('[data-done="sent"]')).toHaveText(
      "2営業日以内に、入力したメールアドレスへ返信します。届かない時は、迷惑メールのフォルダも確認してください。",
    );
    await expect(done.locator('[data-done="unsent"]')).toBeHidden();
    await expect(page.locator("#cf-name")).toBeHidden();
    expect(posted).toMatchObject({
      name: "まぼ",
      email: "mabo@example.com",
      plan: "standard",
      budget: "100-300",
      timing: "3m",
      message: "新しいサービスの LP を作りたいです。",
    });
    // 料金表から来たら、もう一度入力の欄を出す
    await page.getByRole("link", { name: "ライトプランで相談する" }).click();
    await expect(page.locator("#cf-name")).toBeVisible();
    await expect(page.locator("#cf-plan")).toHaveValue("light");
    await expect(done).toBeHidden();
  });

  test("メールの送信を設定していないサーバーでは、届いていない事をそのまま出す", async ({
    page,
  }) => {
    // 本物の /api/contact（この試験のサーバーには送信の鍵が無い）に送る
    await openHome(page);
    await formReady(page);
    await page.locator("#cf-name").fill("まぼ");
    await page.locator("#cf-email").fill("mabo@example.com");
    await page
      .locator("#cf-msg")
      .fill("試験の送信です。10文字を超えています。");
    await page.waitForTimeout(2100); // 2 秒より早い送信は bot として弾かれる
    const res = page.waitForResponse("**/api/contact");
    await page.locator("#contact-form .cform-submit").click();
    expect(await (await res).json()).toEqual({ ok: true, sent: false });
    const done = page.locator("#contact-form .cform-done");
    await expect(done).toBeVisible();
    await expect(done.locator('[data-done="unsent"]')).toHaveText(
      "このサイトは授業の課題の見本のため、いま送った内容はメールでは届いていません。",
    );
    await expect(done.locator('[data-done="sent"]')).toBeHidden();
  });

  test("送信できなかった時は、何をすればよいかを出し、入力した内容を残す", async ({
    page,
  }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ ok: false }),
      }),
    );
    await openHome(page);
    await formReady(page);
    await page.locator("#cf-name").fill("まぼ");
    await page.locator("#cf-email").fill("mabo@example.com");
    await page.locator("#cf-msg").fill("送信できない時の試験です。");
    await page.locator("#contact-form .cform-submit").click();
    const status = page.locator("#contact-form .cform-status");
    await expect(status).toHaveText(
      "送信できませんでした。通信の状態を確認して、もう一度お試しください。入力した内容は残っています。",
    );
    await expect(status).toHaveClass(/err/);
    await expect(page.locator("#cf-name")).toHaveValue("まぼ");
    await expect(page.locator("#contact-form .cform-done")).toBeHidden();
  });

  test("誤りを出した状態と「詳しく見る」を開いた状態でも axe の違反 0", async ({
    page,
  }) => {
    await openHome(page);
    await formReady(page);
    await page.locator(".works > li").first().locator("summary").click();
    await page.locator("#contact-form .cform-submit").click();
    await expect(page.locator("#cf-sum")).toBeVisible();
    await axe(page);
  });
});

test.describe("制作実績", () => {
  test("分野で絞り込み、件数を読み上げで知らせ、「詳しく見る」で中身が開く", async ({
    page,
  }) => {
    await openHome(page);
    const chips = page
      .getByRole("group", { name: "分野で絞り込む" })
      .getByRole("button");
    await expect(chips).toHaveText([
      "すべて（6）",
      "Branding（2）",
      "UI/UX（3）",
      "Web（3）",
      "Creative Direction（1）",
    ]);
    await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
    await chips.nth(2).click();
    await expect(chips.nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(chips.first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".works > li:visible")).toHaveCount(3);
    await expect(page.locator("[data-wcount]")).toHaveText(
      "3件を表示しています",
    );
    await chips.first().click();
    await expect(page.locator(".works > li:visible")).toHaveCount(6);
    await expect(page.locator("[data-wcount]")).toHaveText(
      "6件を表示しています",
    );

    const first = page.locator(".works > li").first();
    const more = first.locator("details.wmore");
    // 読み上げ用の題名は別の要素なので、名前の間に空白が 1 つ入る（Chrome の名前の計算）
    await expect(first.locator("summary")).toHaveAccessibleName(
      "詳しく見る （次世代ECのブランド刷新）",
    );
    await first.locator("summary").click();
    await expect(more).toHaveAttribute("open", "");
    await expect(more.locator("dt")).toHaveText([
      "課題",
      "取り組み",
      "成果",
      "期間",
      "担当範囲",
      "体制",
    ]);
    await expect(more.locator(".wfic")).toHaveText("架空の事例です。");
  });

  test("step モードで絞り込んで頁の高さが変わっても、航路から正しい節へ移る", async ({
    page,
  }) => {
    await markGuideSeen(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?scroll=step");
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Deck).sparkDeck?.mode),
      )
      .toBe("step");
    const nav = page.getByRole("navigation", { name: "ページ内の案内" });
    await nav.getByRole("link", { name: /制作実績/ }).click();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as Deck).sparkDeck!.getState().stage,
          ),
        { timeout: 6000 },
      )
      .toBe(2);
    // 6 件 → 1 件にして、下の節を上へ詰める
    await page
      .getByRole("group", { name: "分野で絞り込む" })
      .getByRole("button", { name: /Creative Direction/ })
      .click();
    await expect(page.locator(".works > li:visible")).toHaveCount(1);
    await nav.getByRole("link", { name: /料金プラン/ }).click();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as Deck).sparkDeck!.getState().stage,
          ),
        { timeout: 6000 },
      )
      .toBe(4);
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Math.abs(
              document.querySelector("#pricing")!.getBoundingClientRect().top,
            ),
          ),
        {
          timeout: 6000,
        },
      )
      .toBeLessThan(80);
  });
});

test.describe("日付の欄と動きの設定", () => {
  test("日付の欄で好きな日へ飛べて、範囲の外の日は受け付けない", async ({
    page,
  }) => {
    await markGuideSeen(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const dock = page.getByRole("region", { name: "惑星の位置の日付" });
    await expect(dock).toBeVisible({ timeout: 45000 });
    const input = dock.getByLabel("日付を選ぶ");
    await expect(input).toHaveAttribute("min", "1800-01-01");
    await expect(input).toHaveAttribute("max", "2050-12-31");
    await expect(input).toHaveAccessibleDescription("1800〜2050年");
    const date = dock.locator(".td-date .td-dv");

    await input.fill("1969-07-20");
    await expect(date).toHaveText("1969年7月20日");
    await expect(
      dock.getByRole("button", { name: "日付を進める" }),
    ).toBeVisible();

    await input.fill("2100-01-01");
    await page.waitForTimeout(300);
    await expect(date).toHaveText("1969年7月20日");
    // 欄から離れると、いま出している日付に合わせ直す
    await input.blur();
    await expect(input).toHaveValue("1969-07-20");

    // 1か月進めると、欄も合わせて動く
    await dock.getByRole("button", { name: "1か月進める" }).click();
    await expect(input).toHaveValue("1969-08-19");
  });

  // 範囲の端は手元の暦で決める。世界標準時で決めていた時は、アメリカで 2050年12月31日を選ぶと 12月30日になった
  for (const timezoneId of ["America/Los_Angeles", "Pacific/Kiritimati"]) {
    test.describe(`時差の大きい地域（${timezoneId}）`, () => {
      test.use({ timezoneId });
      test("範囲の端の日を選んでも、前後の日にずれない", async ({ page }) => {
        await markGuideSeen(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/");
        const dock = page.getByRole("region", { name: "惑星の位置の日付" });
        await expect(dock).toBeVisible({ timeout: 45000 });
        const input = dock.getByLabel("日付を選ぶ");
        const date = dock.locator(".td-date .td-dv");
        for (const [iso, text] of [
          ["2050-12-31", "2050年12月31日"],
          ["1800-01-01", "1800年1月1日"],
        ]) {
          await input.fill(iso);
          await expect(date).toHaveText(text);
          await input.blur();
          await expect(input).toHaveValue(iso);
        }
      });
    });
  }

  test("スマホでは日付の欄も、日付を押して開いた時だけ出る", async ({
    page,
  }) => {
    await markGuideSeen(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const dock = page.getByRole("region", { name: "惑星の位置の日付" });
    await expect(dock).toBeVisible({ timeout: 45000 });
    const input = dock.getByLabel("日付を選ぶ");
    await expect(input).toBeHidden();
    await dock.locator(".td-mtoggle").click();
    await expect(input).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  // 日付の欄を足した時、欄の行の幅で箱が右へ広がり、「宇宙の音」の釦の左端に重なっていた（2026-11-12 の写真で見つけた）
  for (const width of [360, 375]) {
    test(`スマホ（幅 ${width}）で時間の操作を開いても、右下の釦に重ならない`, async ({
      page,
    }) => {
      await markGuideSeen(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const dock = page.getByRole("region", { name: "惑星の位置の日付" });
      await expect(dock).toBeVisible({ timeout: 45000 });
      const before = await page.locator("#audio-toggle").boundingBox();
      await dock.locator(".td-mtoggle").click();
      await expect(dock.getByLabel("日付を選ぶ")).toBeVisible();
      const d = await dock.boundingBox();
      expect(d).not.toBeNull();
      for (const [name, sel] of [
        ["宇宙の音", "#audio-toggle"],
        ["惑星図鑑", "#viewer-open"],
      ]) {
        const b = await page.locator(sel).boundingBox();
        expect(b, name).not.toBeNull();
        if (!d || !b) continue;
        const overlap =
          d.x < b.x + b.width &&
          b.x < d.x + d.width &&
          d.y < b.y + b.height &&
          b.y < d.y + d.height;
        expect(
          overlap,
          `${name}: 箱 ${Math.round(d.x)}〜${Math.round(d.x + d.width)} ／ 釦 ${Math.round(b.x)}〜${Math.round(b.x + b.width)}`,
        ).toBe(false);
      }
      // 閉じると、右下の釦は元の場所へ戻る
      await dock.locator(".td-mtoggle").click();
      await expect(dock.getByLabel("日付を選ぶ")).toBeHidden();
      const after = await page.locator("#audio-toggle").boundingBox();
      expect(Math.abs((after?.y ?? 0) - (before?.y ?? -99))).toBeLessThan(1);
    });
  }

  test("右下の釦は、画面の文字と読み上げの名前が同じで、音の釦は押した状態を aria-pressed で伝える", async ({
    page,
  }) => {
    await openHome(page);
    const audio = page.locator("#audio-toggle");
    await expect(audio).toHaveAccessibleName("宇宙の音");
    await expect(page.locator("#viewer-open")).toHaveAccessibleName("惑星図鑑");
    await expect(audio).toHaveAttribute("aria-pressed", "false");
    await audio.click();
    // 音を鳴らせない環境では釦ごと隠すので、その時は状態を見ない
    if (await audio.isVisible()) {
      await expect(audio).toHaveAttribute("aria-pressed", "true");
      await expect(audio).toHaveAccessibleName("宇宙の音");
      await audio.click();
      await expect(audio).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("「視差効果を減らす」を選んでいる時は、日付を止めた状態で始まる", async ({
    page,
  }) => {
    await markGuideSeen(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const dock = page.getByRole("region", { name: "惑星の位置の日付" });
    await expect(dock).toBeVisible({ timeout: 45000 });
    await expect(
      dock.getByRole("button", { name: "日付を進める" }),
    ).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(dock.locator(".td-date .td-rel")).toHaveText("今日");
  });

  test("設定が無い時は、今日から進む", async ({ page }) => {
    await markGuideSeen(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const dock = page.getByRole("region", { name: "惑星の位置の日付" });
    await expect(dock).toBeVisible({ timeout: 45000 });
    await expect(
      dock.getByRole("button", { name: "日付を止める" }),
    ).toBeVisible();
  });
});

test.describe("見本である事の注記と文", () => {
  test("見本の数字に※を付け、フッターに架空のサイトである事と個人情報の取り扱いへのリンクを出す", async ({
    page,
  }) => {
    await openHome(page);
    await expect(page.locator("header.hero .stats sup.ast")).toHaveCount(2);
    await expect(page.locator("header.hero .snote")).toHaveText(
      "※ spark は授業の課題で作った架空のスタジオです。数字は見本で、実際の実績ではありません。",
    );
    await expect(page.locator("#strengths .metric sup.ast")).toHaveCount(2);
    await expect(page.locator("#strengths .snote")).toHaveCount(1);
    const footer = page.locator("footer");
    const fnav = footer.getByRole("navigation", { name: "サイト内のリンク" });
    await expect(fnav.getByRole("link")).toHaveText([
      "サービス",
      "制作実績",
      "料金",
      "よくある質問",
      "お問い合わせ",
      "個人情報の取り扱い",
    ]);
    await expect(
      fnav.getByRole("link", { name: "個人情報の取り扱い" }),
    ).toHaveAttribute("href", "/privacy/");
    await expect(footer).toContainText(
      "掲載している会社・事例・数字はすべて見本です。",
    );
  });

  test("直す前の言い回しが残っていない", async ({ page }) => {
    await openHome(page);
    const html = await page.content();
    for (const w of [
      "一気通貫",
      "オンラインMTG",
      "1ヶ月",
      "社+",
      "このプランで相談する",
      "送信中…",
      "入力をご確認ください",
    ]) {
      expect(html, w).not.toContain(w);
    }
  });

  test("いちばん下まで送っても、フッターの文字が左下の時間の操作に隠れない", async ({
    page,
  }) => {
    await openHome(page);
    const dock = page.getByRole("region", { name: "惑星の位置の日付" });
    await expect(dock).toBeVisible({ timeout: 45000 });
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(400);
    const f = (await page.locator("footer .fcopy").boundingBox())!;
    const d = (await dock.boundingBox())!;
    expect(f.y + f.height).toBeLessThanOrEqual(d.y);
  });
});

test.describe("個人情報の取り扱い", () => {
  test("頁が開き、使う外部のサービスを書いてあり、axe の違反 0・コンソールの誤り 0", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/privacy/", { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("個人情報の取り扱い");
    await expect(page.locator("main")).toContainText("Resend");
    await expect(page.locator("main")).toContainText("Cloudflare Pages");
    await expect(
      page.getByRole("link", { name: "トップページへ戻る" }),
    ).toHaveAttribute("href", "/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://spark-lp.pages.dev/privacy/",
    );
    await axe(page);
    expect(errors).toEqual([]);
  });
});

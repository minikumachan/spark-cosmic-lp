import { test, expect } from "@playwright/test";

// 本番と同じ CSP（dist/_headers）の下で、3D を読み込んだ後もコンソールにエラーが出ない事を確かめる。
// 2026-11-12: three-stdlib の meshopt の復号器が WebAssembly を読み込もうとして CSP に止められ、本番でだけ
// コンソールにエラーが出ていた。astro preview は _headers を読まないので、手元の試験では見えなかった。
// そのため playwright.config.ts では、_headers を読む wrangler pages dev で配っている。

type CspWindow = Window & { __cspViolations?: string[] };

test("本番と同じ CSP の下で、3D を読み込んでもコンソールにエラーが出ない", async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("spark:guide:v1", "seen");
    } catch {}
    const w = window as CspWindow;
    w.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__cspViolations?.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.emulateMedia({ reducedMotion: "reduce" });
  const res = await page.goto("/");
  // CSP が付いていないサーバーで回すと何も確かめずに通ってしまうので、先に CSP が在る事を確かめる
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(
    csp,
    "CSP のヘッダーが無い（_headers を読まないサーバーで回している）",
  ).toContain("script-src");
  // eval と WebAssembly の読み込みを許していない事（wasm-unsafe-eval にも当たる）
  expect(csp).not.toContain("unsafe-eval");

  // 3D が最初の 1 枚を描くと左下の日付の操作が出る。GLB の読み込みと復号器の用意はその前に始まる
  await expect(
    page.getByRole("region", { name: "惑星の位置の日付" }),
  ).toBeVisible({ timeout: 45000 });
  // 遅れて届くエラーも拾うため、少し待つ
  await page.waitForTimeout(1500);

  const violations = await page.evaluate(
    () => (window as CspWindow).__cspViolations ?? [],
  );
  expect(violations, "CSP に止められた物").toEqual([]);
  expect(errors, "コンソールのエラー").toEqual([]);
});

import type { ClientDirective } from "astro";

// 最初の表示（First Contentful Paint）が済んでから、手の空いた時に読み込む島。
// client:idle は最初の表示より前に発火することがあり、3D の大きな JS が文字の表示を遅らせていた。
// 文字（SSR の HTML）を先に出し、飾りの 3D はその後から来る、という設計の約束をここで守る。
const afterPaint: ClientDirective = (load) => {
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    const run = async () => {
      const hydrate = await load();
      await hydrate();
    };
    if (typeof window.requestIdleCallback === "function")
      window.requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 200);
  };
  try {
    if (performance.getEntriesByName("first-contentful-paint").length) {
      go();
    } else {
      const po = new PerformanceObserver((list) => {
        if (list.getEntriesByName("first-contentful-paint").length) {
          po.disconnect();
          go();
        }
      });
      po.observe({ type: "paint", buffered: true });
    }
  } catch {
    // paint の計測が無いブラウザは下の時間切れで読み込む
  }
  // 計測が届かない場合（裏のタブで開いた等）でも必ず読み込む
  window.setTimeout(go, 3000);
};

export default afterPaint;

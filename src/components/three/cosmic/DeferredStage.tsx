import { lazy, Suspense, useEffect, useState } from "react";

// 重い3D背景(three.js)を初期描画(FCP/LCP)後に遅延ロード＝初期表示を高速化。
// 読み込まれるまでは index.astro の .cosmic-bg(CSSグラデ)がフォールバックとして見える。
const CosmicStage = lazy(() => import("./CosmicStage"));

export default function DeferredStage() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // 低モーション/WebGL未対応でも CosmicStage 内でガードされるため、ここでは起動のみ判断
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idle = 0;
    let to = 0;
    if (w.requestIdleCallback) {
      idle = w.requestIdleCallback(() => setShow(true), { timeout: 1800 });
    } else {
      to = window.setTimeout(() => setShow(true), 900);
    }
    return () => {
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
      if (to) window.clearTimeout(to);
    };
  }, []);
  if (!show) return null;
  return (
    <Suspense fallback={null}>
      <CosmicStage />
    </Suspense>
  );
}

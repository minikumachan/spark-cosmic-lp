import { lazy, Suspense, useEffect, useState } from "react";

// three.js は重いので、対応環境のときだけ動的 import（reduced-motion / WebGL不可は読み込まない）。
const HeroScene = lazy(() => import("./HeroScene"));

export default function Hero3D() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    setEnabled(!reduce && webgl);
  }, []);

  // 非対応時は何も描かず、背後のグラデーション（.hero-visual）をフォールバック表示。
  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <HeroScene />
    </Suspense>
  );
}

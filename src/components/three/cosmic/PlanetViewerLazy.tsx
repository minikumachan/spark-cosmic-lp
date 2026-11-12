import { lazy, Suspense, useEffect, useState } from "react";

// 惑星図鑑は開いた時に初めて読み込む（three.js・drei・postprocessing を最初の表示の邪魔にしない）。
// 釦に指やマウスが乗った時・焦点が来た時に先に取りに行くので、押してからの待ちはほぼ無い。
const load = () => import("./PlanetViewer");
const PlanetViewer = lazy(load);

export default function PlanetViewerLazy() {
  // undefined＝まだ開かれていない／null＝天体の指定なしで開かれた
  const [first, setFirst] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (first !== undefined) return;
    const onOpen = (e: Event) =>
      setFirst((e as CustomEvent).detail?.planet ?? null);
    // 先取りの失敗はここでは投げ上げない（押した時の読み込みで同じ失敗が出る）
    const warm = () => void load().catch(() => {});
    const fab = document.getElementById("viewer-open");
    window.addEventListener("cosmic:open-viewer", onOpen);
    fab?.addEventListener("pointerenter", warm, { once: true });
    fab?.addEventListener("focus", warm, { once: true });
    return () => {
      window.removeEventListener("cosmic:open-viewer", onOpen);
      fab?.removeEventListener("pointerenter", warm);
      fab?.removeEventListener("focus", warm);
    };
  }, [first]);
  if (first === undefined) return null;
  return (
    <Suspense fallback={null}>
      <PlanetViewer initialOpen initialPlanet={first} />
    </Suspense>
  );
}

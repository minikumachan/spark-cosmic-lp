// 描画ティア判定（CosmicStage / PlanetViewer 共有）。
// 非力端末・ソフトウェアGPU（SwiftShader/llvmpipe/GPUアクセラ無効等）では
// 粒子・星雲・Bloom・DPR を抑えて 2fps 級の破綻を防ぐ。

function detectLowGpu(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") ||
      c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return true; // WebGL不可＝最軽量
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    // 調べるためだけに作った文脈はすぐ手放す（ブラウザが同時に持てる WebGL の数には上限がある）
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|software|llvmpipe|microsoft basic|angle \(software|paravirtual|virtualbox|vmware/i.test(
      r,
    );
  } catch {
    return false;
  }
}

/**
 * GPU を使わずに描いている（ソフトウェア描画の）端末。
 * ここでは 1 コマを描き終えるまで頁の処理全体が待たされるので、3D の部品を 0.16 秒ごとに出し（CosmicStage の useStagger）、
 * 惑星の絵は横 512 の版を読む（gpu.ts）。
 * Lighthouse などの計測も GPU の無い環境で動くので、ここに入る。
 */
export const SOFT_GPU = typeof window !== "undefined" && detectLowGpu();

// 軽量ティア（狭幅 or 低コア or 非力/ソフトGPU）
export const LITE =
  typeof window !== "undefined" &&
  (window.innerWidth < 820 ||
    (navigator.hardwareConcurrency || 8) <= 4 ||
    SOFT_GPU);

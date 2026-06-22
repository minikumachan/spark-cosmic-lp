// 描画ティア判定（CosmicStage / PlanetViewer 共有）。
// 非力端末・ソフトウェアGPU（SwiftShader/llvmpipe/GPUアクセラ無効等）では
// 粒子・星雲・Bloom・DPR を抑えて 2fps 級の破綻を防ぐ。

function detectLowGpu(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return true; // WebGL不可＝最軽量
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|software|llvmpipe|microsoft basic|angle \(software|paravirtual|virtualbox|vmware/i.test(r);
  } catch {
    return false;
  }
}

// 軽量ティア（狭幅 or 低コア or 非力/ソフトGPU）
export const LITE =
  typeof window !== "undefined" &&
  (window.innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4 || detectLowGpu());

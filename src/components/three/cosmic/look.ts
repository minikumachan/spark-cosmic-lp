// 光と色の流れ（2026-11-13 から作り直し中）。背景の 3D（CosmicStage）と惑星図鑑（PlanetViewer）の両方で使う。
//
// 今の流れ: 机上は後処理（EffectComposer）が半精度のバッファに HDR のまま描き、ブルームも HDR で掛かるが、
//   描き手の色の曲線（トーンマッピング）を外したまま最後に何も掛けないので、画面へ出す所で 1 を超えた明るさが
//   硬く切り捨てられる（太陽や明るい星の芯が平らな円盤になる）。スマホは後処理を通さず ACES が掛かるので、
//   机上とスマホで色の付き方が違う。
// 新しい流れ（tone=soft・既定）: 1 未満の色は今と 1 つも変えず、knee（既定 0.8）を超えた明るい所だけを
//   なだらかに 1 へ寄せる。机上は後処理の最後に、スマホは描き手の曲線として同じ式を掛け、色の付き方をそろえる。
//   AgX・ACES・Neutral（Blender・Unity・Khronos の標準の曲線）は、今の絵が曲線無しで色を決めてあるため、
//   全体の色相と彩度が変わる（2026-11-13 に撮り比べて確かめた）。見比べのために URL で残している。
//
// 既定は新しい流れ（soft・knee 0.8）。2026-11-13 に撮り比べ、机上は太陽の周りの 255 で潰れた画素が 0.414% → 0.001%、
// 1 未満の色は変わらない事を確かめた。スマホは ACES をやめたので約 2 割明るくなり、机上の色に近づいた。
// 前の流れは ?look=old、他の曲線は ?tone=agx|aces|neutral、強さは ?knee=0.65 や ?exp=1.2 で見比べられる。
import { createElement, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { ToneMapping, wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect, ToneMappingMode } from "postprocessing";
import * as THREE from "three";

export type ToneName = "soft" | "agx" | "aces" | "neutral";

const query =
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search);
const num = (key: string, lo: number, hi: number, fallback: number) => {
  const v = Number(query?.get(key));
  return query?.has(key) && Number.isFinite(v) && v > lo && v < hi
    ? v
    : fallback;
};
const toneParam = query?.get("tone");

export const LOOK = {
  next: query?.get("look") !== "old",
  tone: (toneParam === "agx" || toneParam === "aces" || toneParam === "neutral"
    ? toneParam
    : "soft") as ToneName,
  knee: num("knee", 0.4, 0.98, 0.8),
  exposure: num("exp", 0, 8, 1),
};

// knee までは素通し、その上は傾き 1 で始まって 1 へ近づく曲線（色ごとに掛ける。切り捨ての時と同じく白へ寄る）
const SHOULDER_GLSL = /* glsl */ `
float softShoulder(float x, float k) {
  float r = 1.0 - k;
  return x <= k ? x : k + r * (x - k) / (x - k + r);
}
vec3 softShoulder3(vec3 c, float k) {
  return vec3(softShoulder(c.r, k), softShoulder(c.g, k), softShoulder(c.b, k));
}`;

// 机上: 後処理の最後に掛ける効果（ブルームや周辺減光と同じ 1 回の描画にまとめられるので、増える手間は小さい）
class SoftShoulderEffect extends Effect {
  constructor({
    knee = 0.8,
    exposure = 1,
  }: { knee?: number; exposure?: number } = {}) {
    super(
      "SoftShoulderEffect",
      `${SHOULDER_GLSL}
uniform float knee;
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(softShoulder3(max(inputColor.rgb * exposure, 0.0), knee), inputColor.a);
}`,
      {
        blendFunction: BlendFunction.SRC,
        uniforms: new Map<string, THREE.Uniform>([
          ["knee", new THREE.Uniform(knee)],
          ["exposure", new THREE.Uniform(exposure)],
        ]),
      },
    );
  }
}
const SoftShoulder = wrapEffect(SoftShoulderEffect);

const TONE_PP: Record<Exclude<ToneName, "soft">, ToneMappingMode> = {
  agx: ToneMappingMode.AGX,
  aces: ToneMappingMode.ACES_FILMIC,
  neutral: ToneMappingMode.NEUTRAL,
};

// EffectComposer の最後に置く。今の流れでは何も足さない。
export function FinalCurve() {
  if (!LOOK.next) return null;
  return LOOK.tone === "soft"
    ? createElement(SoftShoulder, { knee: LOOK.knee, exposure: LOOK.exposure })
    : createElement(ToneMapping, { mode: TONE_PP[LOOK.tone] });
}

// スマホ: three の「自前の曲線」の枠に同じ式を入れる。材質を組み立てる前に差し替える必要があるので、読み込んだ時に行う。
const CUSTOM_STUB = "vec3 CustomToneMapping( vec3 color ) { return color; }";
if (LOOK.next && LOOK.tone === "soft") {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (chunk.includes("softShoulder3")) {
    // 既に差し替えてある（別の束から 2 回読まれた時）
  } else if (chunk.includes(CUSTOM_STUB)) {
    THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(
      CUSTOM_STUB,
      `${SHOULDER_GLSL}
vec3 CustomToneMapping( vec3 color ) {
  return softShoulder3( max( color * toneMappingExposure, 0.0 ), ${LOOK.knee.toFixed(4)} );
}`,
    );
  } else {
    console.warn(
      "[look] three の曲線の枠が見つからないため、スマホは前の曲線のまま",
    );
  }
}

const TONE_GL: Record<ToneName, THREE.ToneMapping> = {
  soft: THREE.CustomToneMapping,
  agx: THREE.AgXToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  neutral: THREE.NeutralToneMapping,
};

// 描き手に曲線と露出を入れる。後処理を通す端末（setCurve=false）は、曲線は FinalCurve が掛けるので露出だけ入れる
// （ToneMapping の効果は描き手の露出を読む）。Canvas の中で呼ぶ。
export function useToneCurve(setCurve: boolean) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!LOOK.next) return;
    const prev = { tm: gl.toneMapping, ex: gl.toneMappingExposure };
    if (setCurve) gl.toneMapping = TONE_GL[LOOK.tone];
    gl.toneMappingExposure = LOOK.exposure;
    return () => {
      gl.toneMapping = prev.tm;
      gl.toneMappingExposure = prev.ex;
    };
  }, [gl, setCurve]);
}

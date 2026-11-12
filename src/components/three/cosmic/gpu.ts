// 惑星の絵（テクスチャ）を、画面を止めずに GPU へ載せるための係（CosmicStage / PlanetViewer 共有）。
//
// 2026-11-12 に測った問題: drei の useTexture は <img> で読み、部品が出た瞬間に全部の絵を GPU へ送る。
// <img> の絵は送る時に画面の係（メインスレッド）が展開するので、17 枚・展開後 164MB を一度に送ると、
// 本物の GPU（RTX 3080）でも開いて 1.2 秒後に 0.77 秒、画面が止まっていた（スクロールも押す操作も効かない）。
//
// 直し方は 3 つ。
//  1. 絵の展開を createImageBitmap に任せる（ブラウザの別の係が展開する）。three.js の GLTFLoader と同じ見分け方で、
//     向きの指定が効かない古い Safari（17 未満）と Firefox（98 未満）は前のまま <img> で読む。
//  2. GPU へ送るのは 1 フレームに 1 枚にする（queueUpload）。描く前に要る絵は three が描く時にその場で送る。
//  3. 本番ではシェーダの誤りの確認（checkShaderErrors）を切る（確認のための同期の待ちが無くなる。three.js の説明書の勧め）。
//
// 軽量ティア（tier.ts の LITE。スマホなど）では、横 2048 を超える絵を縮めた版（public/assets/planet/lite/）を読む。
// ImageBitmap は展開した絵をメモリに持ち続けるので、全部で約 164MiB を約 96MiB に減らす。
// 軽量ティアの 3D は等倍（dpr 1）で描くので見た目は変わらない。縮めた版と一覧は scripts/make_lite_textures.mjs が作る。
// GPU を使わずに描いている端末（tier.ts の SOFT_GPU）では、横 512 まで縮めた版（public/assets/planet/soft/）を読む。
// この端末では絵を GPU へ送る処理も CPU がするので、横 2048 の絵 1 枚で頁が 0.05〜0.15 秒止まっていた。
import * as THREE from "three";
import { useEffect } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { LITE, SOFT_GPU } from "./tier";
import liteNames from "./lite-textures.json";
import softNames from "./soft-textures.json";

const LITE_SET = new Set<string>(LITE ? (liteNames as string[]) : []);
const SOFT_SET = new Set<string>(SOFT_GPU ? (softNames as string[]) : []);
function pick(url: string): string {
  const m = /^\/assets\/planet\/([^/]+)\.webp$/.exec(url);
  if (!m) return url;
  if (SOFT_SET.has(m[1])) return `/assets/planet/soft/${m[1]}.webp`;
  if (LITE_SET.has(m[1])) return `/assets/planet/lite/${m[1]}.webp`;
  return url;
}

const BITMAP = (() => {
  if (typeof window === "undefined" || typeof createImageBitmap === "undefined")
    return false;
  const ua = navigator.userAgent;
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  const safariVersion = safari
    ? parseInt(ua.match(/Version\/(\d+)/)?.[1] ?? "-1", 10)
    : -1;
  const firefox = ua.includes("Firefox");
  const firefoxVersion = firefox
    ? parseInt(ua.match(/Firefox\/(\d+)\./)?.[1] ?? "-1", 10)
    : -1;
  return !(safari && safariVersion < 17) && !(firefox && firefoxVersion < 98);
})();

// 同じ道の絵は 1 つの Texture を使い回す（配列で頼んでも 1 枚で頼んでも同じ物になる）
const byUrl = new Map<string, Promise<THREE.Texture>>();

class BitmapTextureLoader extends THREE.Loader<THREE.Texture> {
  private readonly inner: THREE.ImageBitmapLoader;
  constructor(manager?: THREE.LoadingManager) {
    super(manager);
    this.inner = new THREE.ImageBitmapLoader(this.manager);
    // TextureLoader の既定（flipY・アルファを掛けない・色の変換をしない）と同じ絵になるようにそろえる
    this.inner.setOptions({
      imageOrientation: "flipY",
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
    });
  }
  load(
    url: string,
    onLoad: (data: THREE.Texture) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void {
    let p = byUrl.get(url);
    if (!p) {
      p = new Promise<THREE.Texture>((resolve, reject) => {
        this.inner.load(
          pick(url),
          (bitmap) => {
            const tex = new THREE.Texture(
              bitmap as unknown as HTMLImageElement,
            );
            tex.flipY = false; // 向きは展開する時に直してある（ImageBitmap では flipY が効かない）
            tex.needsUpdate = true;
            resolve(tex);
          },
          undefined,
          reject,
        );
      });
      byUrl.set(url, p);
      p.catch(() => byUrl.delete(url));
    }
    p.then(onLoad, (e) => onError?.(e));
  }
}

// 古い Safari・Firefox は <img> で読む。軽量ティアの縮めた版はこちらでも使う（古い iPhone ほどメモリが少ない）
class PickTextureLoader extends THREE.TextureLoader {
  load(
    ...args: Parameters<THREE.TextureLoader["load"]>
  ): ReturnType<THREE.TextureLoader["load"]> {
    const [url, ...rest] = args;
    return super.load(pick(url), ...rest);
  }
}

const Loader = (BITMAP
  ? BitmapTextureLoader
  : PickTextureLoader) as unknown as typeof THREE.TextureLoader;

// GPU へ送る順番待ち。1 フレームに 1 枚だけ送る（renderer ごとに 1 回）
const queued = new WeakMap<THREE.WebGLRenderer, WeakSet<THREE.Texture>>();
const waiting: Array<[THREE.WebGLRenderer, THREE.Texture]> = [];
let frame = 0;
function step() {
  frame = 0;
  const next = waiting.shift();
  if (next) {
    try {
      next[0].initTexture(next[1]); // もう送ってある絵なら three は何もしない
    } catch {
      // renderer が捨てられた後など。描く時に three が送り直す
    }
  }
  if (waiting.length) frame = requestAnimationFrame(step);
}
export function queueUpload(gl: THREE.WebGLRenderer, tex: THREE.Texture) {
  if (!tex.image) return;
  let set = queued.get(gl);
  if (!set) {
    set = new WeakSet();
    queued.set(gl, set);
  }
  if (set.has(tex)) return;
  set.add(tex);
  waiting.push([gl, tex]);
  if (!frame) frame = requestAnimationFrame(step);
}

// drei の useTexture と同じ使い方（1 枚なら Texture、配列なら Texture[]）。違いは GPU へ送る時だけ
export function useTexture(input: string): THREE.Texture;
export function useTexture(input: string[]): THREE.Texture[];
export function useTexture(
  input: string | string[],
): THREE.Texture | THREE.Texture[] {
  const gl = useThree((s) => s.gl);
  const textures = useLoader(Loader, input as string) as unknown as
    | THREE.Texture
    | THREE.Texture[];
  useEffect(() => {
    for (const t of Array.isArray(textures) ? textures : [textures])
      queueUpload(gl, t);
  }, [gl, textures]);
  return textures;
}
useTexture.preload = (input: string | string[]) =>
  useLoader.preload(Loader, input as string);

// Canvas の onCreated に渡す。開発中は誤りを確かめ、本番では切る
export function onGlCreated({ gl }: { gl: THREE.WebGLRenderer }) {
  gl.debug.checkShaderErrors = import.meta.env.DEV;
}

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
import * as THREE from "three";
import { useEffect } from "react";
import { useLoader, useThree } from "@react-three/fiber";

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
          url,
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

const Loader = (BITMAP
  ? BitmapTextureLoader
  : THREE.TextureLoader) as unknown as typeof THREE.TextureLoader;

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

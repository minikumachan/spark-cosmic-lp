import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, Stars, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { LITE } from "./tier";

/* 惑星鑑賞モード：フルスクリーン・OrbitControlsで自由に回転/ズーム。
   惑星セレクタ＋情報パネル。サイトを開くだけで動作（事前準備不要）。
   開いている間だけ Canvas をマウント（軽量）。Esc/×で閉じる。 */

type V = {
  key: string;
  name: string;
  en: string;
  src: string;
  normalSrc?: string;
  rocky?: boolean;
  ring?: boolean;
  sun?: boolean;
  galaxy?: boolean;
  atmo?: string;
  facts: [string, string][];
};
const PLANETS: V[] = [
  { key: "sun", name: "太陽", en: "Sun", src: "/assets/planet/sun.webp", sun: true, facts: [["直径", "1,392,700 km"], ["表面温度", "約 5,500 ℃"], ["太陽系質量", "99.86 %"], ["種別", "G型主系列星"]] },
  { key: "mercury", name: "水星", en: "Mercury", src: "/assets/planet/mercury.webp", normalSrc: "/assets/planet/mercury_n.webp", rocky: true, facts: [["直径", "4,879 km"], ["太陽から", "0.39 AU"], ["公転周期", "88 日"], ["大気", "ほぼ無し"]] },
  { key: "venus", name: "金星", en: "Venus", src: "/assets/planet/venus.webp", atmo: "#e8c87a", facts: [["直径", "12,104 km"], ["太陽から", "0.72 AU"], ["公転周期", "225 日"], ["表面温度", "462 ℃"]] },
  { key: "earth", name: "地球", en: "Earth", src: "/assets/planet/earth_day.webp", rocky: true, atmo: "#5fb8ff", facts: [["直径", "12,742 km"], ["太陽から", "1.0 AU"], ["公転周期", "365 日"], ["衛星", "1（月）"]] },
  { key: "moon", name: "月", en: "Moon", src: "/assets/planet/moon.webp", normalSrc: "/assets/planet/moon_n.webp", rocky: true, facts: [["直径", "3,474 km"], ["地球から", "384,400 km"], ["公転周期", "27.3 日"], ["重力", "地球の 1/6"]] },
  { key: "mars", name: "火星", en: "Mars", src: "/assets/planet/mars.webp", normalSrc: "/assets/planet/mars_n.webp", rocky: true, atmo: "#ff7a4d", facts: [["直径", "6,779 km"], ["太陽から", "1.52 AU"], ["公転周期", "687 日"], ["衛星", "2"]] },
  { key: "jupiter", name: "木星", en: "Jupiter", src: "/assets/planet/jupiter.webp", atmo: "#e8b87a", facts: [["直径", "139,820 km"], ["太陽から", "5.2 AU"], ["公転周期", "11.9 年"], ["衛星", "95+"]] },
  { key: "saturn", name: "土星", en: "Saturn", src: "/assets/planet/saturn.webp", ring: true, atmo: "#e6c77a", facts: [["直径", "116,460 km"], ["太陽から", "9.5 AU"], ["公転周期", "29.5 年"], ["環", "主要 7 本"]] },
  { key: "uranus", name: "天王星", en: "Uranus", src: "/assets/planet/uranus.webp", atmo: "#9fe8e0", facts: [["直径", "50,724 km"], ["太陽から", "19.2 AU"], ["公転周期", "84 年"], ["自転軸", "98°（横倒し）"]] },
  { key: "neptune", name: "海王星", en: "Neptune", src: "/assets/planet/neptune.webp", atmo: "#5b8cff", facts: [["直径", "49,244 km"], ["太陽から", "30 AU"], ["公転周期", "165 年"], ["最大風速", "2,100 km/h"]] },
  { key: "galaxy", name: "銀河", en: "Galaxy", galaxy: true, src: "/assets/planet/sun.webp", facts: [["直径", "約 10 万光年"], ["恒星数", "約 2,000〜4,000 億"], ["所属", "局部銀河群 → おとめ座超銀河団"], ["太陽系の位置", "オリオン腕（中心から約 2.6 万光年）"]] },
];

const atmoVert = /* glsl */ `varying vec3 vN; varying vec3 vView;
void main(){ vec4 vp=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vView=normalize(-vp.xyz); gl_Position=projectionMatrix*vp; }`;
const rimFrag = /* glsl */ `varying vec3 vN; varying vec3 vView; uniform vec3 uColor;
void main(){ float f=pow(1.0-max(dot(vN,vView),0.0),3.0); gl_FragColor=vec4(uColor*f*0.6,f); }`;

function ViewerRing() {
  const tex = useTexture("/assets/planet/saturn_ring.webp");
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(1.35, 2.4, 160);
    const pos = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, (v.length() - 1.35) / (2.4 - 1.35), 0.5);
    }
    return g;
  }, []);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; }, [tex]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2 + 0.3, 0, 0]}>
      <meshStandardMaterial map={tex} transparent side={THREE.DoubleSide} roughness={1} depthWrite={false} />
    </mesh>
  );
}

function ViewerPlanet({ p, pos }: { p: V; pos: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const [map, nrm] = useTexture([p.src, p.normalSrc ?? p.src]);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;
    if (p.normalSrc) nrm.anisotropy = 16;
  }, [map, nrm, p.normalSrc]);
  const u = useMemo(() => ({ uColor: { value: new THREE.Color(p.atmo ?? "#88aaff") } }), [p.atmo]);
  const t = useRef(0);
  useFrame((_, d) => {
    if (t.current < 1) t.current = Math.min(1, t.current + d * 2.0);
    if (ref.current) ref.current.rotation.y += d * (0.06 + (1 - t.current) * 0.55); // 着地時に初速スピン
  });
  return (
    <group position={pos} rotation={[0.25, 0, 0.08]}>
      <mesh ref={ref}>
        <sphereGeometry args={[1, p.rocky ? 200 : 128, p.rocky ? 200 : 128]} />
        {p.sun ? (
          <meshBasicMaterial map={map} toneMapped={false} />
        ) : (
          <meshStandardMaterial
            map={map}
            normalMap={p.normalSrc ? nrm : undefined}
            normalScale={p.normalSrc ? new THREE.Vector2(1.8, 1.8) : undefined}
            bumpMap={p.rocky && !p.normalSrc ? map : null}
            bumpScale={p.rocky && !p.normalSrc ? 0.05 : 0}
            roughness={p.rocky ? 0.96 : 0.55}
            metalness={0}
          />
        )}
      </mesh>
      {p.sun && (
        <>
          <mesh scale={1.22}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color="#ffd98a" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh scale={1.7}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color="#ffb84d" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </>
      )}
      {p.ring && <ViewerRing />}
      {!p.sun && p.atmo && (
        <mesh scale={1.05}>
          <sphereGeometry args={[1, 64, 64]} />
          <shaderMaterial vertexShader={atmoVert} fragmentShader={rimFrag} uniforms={u} side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// 地球は雲＋夜景(街の灯)＋法線＋大気のフル再現
function ViewerEarth({ pos }: { pos: THREE.Vector3 }) {
  const earth = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const [day, normal, clud, lights] = useTexture([
    "/assets/planet/earth_day.webp",
    "/assets/planet/earth_normal.webp",
    "/assets/planet/earth_clouds.webp",
    "/assets/planet/earth_lights.webp",
  ]);
  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    lights.colorSpace = THREE.SRGBColorSpace;
    clud.colorSpace = THREE.SRGBColorSpace;
    for (const t of [day, normal, clud, lights]) t.anisotropy = 16;
  }, [day, normal, clud, lights]);
  const u = useMemo(() => ({ uColor: { value: new THREE.Color("#5fb8ff") } }), []);
  const t = useRef(0);
  useFrame((_, d) => {
    if (t.current < 1) t.current = Math.min(1, t.current + d * 2.0);
    if (earth.current) earth.current.rotation.y += d * (0.05 + (1 - t.current) * 0.5);
    if (clouds.current) clouds.current.rotation.y += d * 0.068;
  });
  return (
    <group position={pos} rotation={[0.25, 0, 0.08]}>
      <mesh ref={earth}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial map={day} normalMap={normal} normalScale={new THREE.Vector2(1, 1)} emissiveMap={lights} emissive={new THREE.Color("#ffd9a0")} emissiveIntensity={0.9} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh ref={clouds} scale={1.012}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={clud} alphaMap={clud} transparent opacity={0.9} depthWrite={false} roughness={1} />
      </mesh>
      <mesh scale={1.045}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={rimFrag} uniforms={u} side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

// 各天体を宇宙空間の別位置に配置（太陽→海王星を一列に）
const VPOS: Record<string, [number, number, number]> = {
  sun: [-70, 0, 0],
  mercury: [-54, 2, -4],
  venus: [-38, -2, 4],
  earth: [-22, 2, -3],
  moon: [-8, -2, 4],
  mars: [8, 1, -5],
  jupiter: [26, 3, -7],
  saturn: [46, -2, -4],
  uranus: [62, 2, -6],
  neptune: [78, -1, -3],
  galaxy: [0, 0, 0],
};
const vpos = (key: string) => new THREE.Vector3(...(VPOS[key] ?? [0, 0, 0]));
const PLANET_MAP: Record<string, V> = Object.fromEntries(PLANETS.map((pl) => [pl.key, pl]));

// 切替時：OrbitControls の target を新天体へ滑らかに移動。
// → カメラは offset を保ったまま「空間を移動し、向き直りながら近づく」飛行になる。
type Controls = { enabled: boolean; update: () => void; target: THREE.Vector3 };
function ViewerCameraRig({ target, controls, galaxy }: { target: THREE.Vector3; controls: React.RefObject<Controls | null>; galaxy?: boolean }) {
  const inited = useRef(false);
  const wasGalaxy = useRef(false);
  // 銀河は天文学的スケール＝遠くから俯瞰する初期枠
  const frameGalaxy = (camera: THREE.Camera) => {
    camera.position.set(0, 26, 92);
    controls.current!.target.set(0, 0, 0);
    controls.current!.update();
  };
  const framePlanet = (camera: THREE.Camera) => {
    camera.position.set(target.x, target.y + 0.4, target.z + 4);
    controls.current!.target.copy(target);
    controls.current!.update();
  };
  useFrame(({ camera }, d) => {
    if (!controls.current) return;
    if (!inited.current) {
      inited.current = true;
      wasGalaxy.current = !!galaxy;
      if (galaxy) frameGalaxy(camera); else framePlanet(camera);
      return;
    }
    // 惑星⇄銀河の切替時はスケールが桁違いなのでカメラ枠を作り直す（lerpでは寄れない/引けない）
    if (galaxy && !wasGalaxy.current) { wasGalaxy.current = true; frameGalaxy(camera); return; }
    if (!galaxy && wasGalaxy.current) { wasGalaxy.current = false; framePlanet(camera); return; }
    if (galaxy) { controls.current.update(); return; } // 銀河中は自由に周回/ズーム/パン
    const k = 1 - Math.exp(-2.6 * d); // 惑星間は滑らかに飛んで近づく
    controls.current.target.lerp(target, k);
    controls.current.update();
  });
  return null;
}

/* ───────── 銀河ビュー：渦巻銀河（天文学的数の星・差動回転）＋衛星銀河群（銀河の中の銀河）
   ＋無数の遠方銀河（集まる銀河／宇宙の大規模構造）＋太陽系の位置。拡大で星・銀河が見えてくる。 ───────── */
let _glow: THREE.Texture | null = null;
function galaxyGlow(): THREE.Texture {
  if (_glow) return _glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,240,210,0.5)");
    g.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  _glow = new THREE.CanvasTexture(c);
  _glow.generateMipmaps = false;
  _glow.minFilter = THREE.LinearFilter;
  return _glow;
}
// 渦巻銀河は差動回転（中心ほど速い）。点は gl_PointCoord で丸く discard。
const galaxyVert = `uniform float uTime; uniform float uSize;
attribute vec3 color; attribute float aScale; varying vec3 vColor;
void main(){
  vColor = color; vec3 p = position; float r = length(p.xz);
  float ang = uTime * 0.10 * (10.0 / (r + 7.0));
  float c = cos(ang), s = sin(ang);
  vec3 rp = vec3(p.x*c - p.z*s, p.y, p.x*s + p.z*c);
  vec4 mv = modelViewMatrix * vec4(rp, 1.0);
  gl_PointSize = uSize * aScale * (320.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const pointVert = `uniform float uSize;
attribute vec3 color; attribute float aScale; varying vec3 vColor;
void main(){
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * aScale * (320.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const pointFrag = `varying vec3 vColor;
void main(){
  float d = distance(gl_PointCoord, vec2(0.5));
  if (d > 0.5) discard;
  float s = pow(1.0 - smoothstep(0.0, 0.5, d), 1.7);
  gl_FragColor = vec4(vColor, s);
}`;
const gR = (power: number) => Math.pow(Math.random(), power) * (Math.random() < 0.5 ? 1 : -1);
function buildGeo(pos: Float32Array, col: Float32Array, sca: Float32Array) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aScale", new THREE.BufferAttribute(sca, 1));
  return g;
}
function spiralGeo(count: number, radius: number, branches: number, spin: number, randomness: number, randPow: number, inside: string, outside: string, thickness: number) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sca = new Float32Array(count);
  const cIn = new THREE.Color(inside), cOut = new THREE.Color(outside), cHII = new THREE.Color("#ff6ab0"), bulgeCol = new THREE.Color("#fff3d6"), t = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = Math.pow(Math.random(), 1.7) * radius;
    const branchAngle = ((i % branches) / branches) * Math.PI * 2;
    const spinAngle = r * spin;
    const bulge = Math.max(0, 1 - r / (radius * 0.18));
    pos[i3] = Math.cos(branchAngle + spinAngle) * r + gR(randPow) * randomness * r;
    pos[i3 + 1] = gR(randPow) * randomness * r * thickness + gR(2.0) * bulge * radius * 0.14;
    pos[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + gR(randPow) * randomness * r;
    t.copy(cIn).lerp(cOut, Math.min(r / radius, 1));
    let sc = 0.6 + Math.random() * 1.2;
    if (r > radius * 0.25 && Math.random() < 0.03) { t.copy(cHII); sc *= 2.4; }       // HII領域（星形成）
    if (bulge > 0) { t.lerp(bulgeCol, bulge * 0.6); sc *= 1 + bulge * 1.6; }           // 中心バルジは明るく大きく
    col[i3] = t.r; col[i3 + 1] = t.g; col[i3 + 2] = t.b; sca[i] = sc;
  }
  return buildGeo(pos, col, sca);
}
function ellipticalGeo(count: number, size: number, edge: string) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sca = new Float32Array(count);
  const cCore = new THREE.Color("#fff2d8"), cEdge = new THREE.Color(edge), t = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = Math.pow(Math.random(), 2.4) * size;
    const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
    pos[i3] = r * Math.sin(th) * Math.cos(ph); pos[i3 + 1] = r * Math.cos(th) * 0.62; pos[i3 + 2] = r * Math.sin(th) * Math.sin(ph);
    t.copy(cCore).lerp(cEdge, Math.min(r / size, 1));
    col[i3] = t.r; col[i3 + 1] = t.g; col[i3 + 2] = t.b; sca[i] = 0.6 + Math.random() * 1.0;
  }
  return buildGeo(pos, col, sca);
}
function fieldGeo(count: number, rMin: number, rMax: number, palette: string[], sMin: number, sMax: number, bright: number) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sca = new Float32Array(count);
  const cols = palette.map((c) => new THREE.Color(c)), t = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = rMin + Math.pow(Math.random(), 0.7) * (rMax - rMin);
    const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
    pos[i3] = r * Math.sin(th) * Math.cos(ph); pos[i3 + 1] = r * Math.cos(th); pos[i3 + 2] = r * Math.sin(th) * Math.sin(ph);
    t.copy(cols[(Math.random() * cols.length) | 0]).multiplyScalar(bright * (0.5 + Math.random() * 0.5));
    col[i3] = t.r; col[i3 + 1] = t.g; col[i3 + 2] = t.b; sca[i] = sMin + Math.random() * (sMax - sMin);
  }
  return buildGeo(pos, col, sca);
}
const GAL_RADIUS = 30, GAL_BRANCHES = 5, GAL_SPIN = 0.26;
function makeMat(vert: string, size: number, withTime = false) {
  return new THREE.ShaderMaterial({
    uniforms: withTime ? { uTime: { value: 0 }, uSize: { value: size } } : { uSize: { value: size } },
    vertexShader: vert, fragmentShader: pointFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// ── 実在の恒星を高品質に再現：粒状の対流セル（fbmノイズ）＋周縁減光＋自発光。テクスチャ不要＝軽量。 ──
const starVert = `varying vec3 vP; varying vec3 vN; varying vec3 vView;
void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const starFrag = `varying vec3 vP; varying vec3 vN; varying vec3 vView; uniform vec3 uColor; uniform float uTime; uniform float uBright;
vec3 hash3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return -1.0+2.0*fract(sin(p)*43758.5453123); }
float gnoise(vec3 p){ vec3 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash3(i+vec3(0,0,0)),f-vec3(0,0,0)),dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                 mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                 mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z); }
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<3;i++){ s+=a*gnoise(p); p*=2.02; a*=0.5; } return s; }
void main(){
  vec3 q=vP*2.6; float n=fbm(q+vec3(0.0,uTime*0.16,0.0)); float hi=gnoise(q*5.0-uTime*0.12);
  float gran=0.5+0.7*n+0.16*hi; float limb=pow(max(dot(vN,vView),0.0),0.5); float hot=smoothstep(0.25,0.95,gran);
  vec3 col=uColor*gran + uColor*hot*0.6; col*=(0.5+0.75*limb);
  gl_FragColor=vec4(col*uBright,1.0);
}`;
function HQStar({ color, size }: { color: string; size: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uTime: { value: Math.random() * 40 }, uBright: { value: 1.55 } }), [color]);
  useFrame((_, d) => { if (matRef.current) matRef.current.uniforms.uTime.value += d; });
  return (
    <mesh>
      <sphereGeometry args={[size, LITE ? 28 : 44, LITE ? 28 : 44]} />
      <shaderMaterial ref={matRef} vertexShader={starVert} fragmentShader={starFrag} uniforms={uniforms} />
    </mesh>
  );
}
type IBody = { kind: "star" | "planet"; name: string; color: string; glow: string; size: number; planetKey?: string; pos: [number, number, number] };
const _wp = new THREE.Vector3();
const _ZERO = new THREE.Vector3();
// 1天体：俯瞰では明るい塊（コロナ）、寄ると高品質メッシュ（恒星=粒状表面 / 惑星=地球レベルのテクスチャ）を
// 遅延マウント。離れると破棄＝同時に高品質なのは画面近傍の数個だけ＝軽量。
function InnerBody({ body }: { body: IBody }) {
  const grp = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);
  useFrame(({ camera }) => {
    if (!grp.current) return;
    const dist = camera.position.distanceTo(grp.current.getWorldPosition(_wp));
    const n = dist < body.size * 9 + 5; // 本当に寄った時だけ高品質版を生成＝同時マウントは数個＝軽量
    if (n !== near) setNear(n);
  });
  const planet = body.planetKey ? PLANET_MAP[body.planetKey] : undefined;
  const coronaS = body.size * (body.kind === "star" ? 7 : 3.0);
  return (
    <group ref={grp} position={body.pos}>
      <sprite scale={[coronaS, coronaS, 1]}>
        <spriteMaterial map={galaxyGlow()} color={body.glow} transparent opacity={near ? (body.kind === "star" ? 0.5 : 0) : 0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {near && (
        <Suspense fallback={null}>
          {body.kind === "star" ? (
            <HQStar color={body.color} size={body.size} />
          ) : planet?.key === "earth" ? (
            <group scale={body.size}><ViewerEarth pos={_ZERO} /></group>
          ) : planet ? (
            <group scale={body.size}><ViewerPlanet p={planet} pos={_ZERO} /></group>
          ) : null}
          {body.name && (
            <Html position={[0, body.size + 0.7, 0]} center distanceFactor={11} style={{ pointerEvents: "none", color: "#eef3ff", font: "700 12px 'Zen Kaku Gothic New',sans-serif", whiteSpace: "nowrap", textShadow: "0 1px 8px #000" }}>{body.name}</Html>
          )}
        </Suspense>
      )}
    </group>
  );
}
function GalaxyScene() {
  const satGroup = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const markerG = useRef<THREE.Group>(null);
  const mainGeo = useMemo(() => spiralGeo(LITE ? 26000 : 110000, GAL_RADIUS, GAL_BRANCHES, GAL_SPIN, 0.22, 3, "#fff0d0", "#3f78ff", 0.07), []);
  const satellites = useMemo(() => {
    const N = LITE ? 9 : 16;
    const sp: [string, string][] = [["#ffe0b0", "#5fa0ff"], ["#ffd0b0", "#8a6aff"], ["#fff0d8", "#4d8aff"]];
    const ell = ["#9fb6ff", "#ffc0a0", "#cfd6ff"];
    const out: { pos: [number, number, number]; scale: number; rot: [number, number, number]; geo: THREE.BufferGeometry }[] = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + Math.random(), dist = 40 + Math.random() * 72, elev = (Math.random() - 0.5) * 52;
      const spiral = Math.random() < 0.62;
      const pair = sp[(Math.random() * sp.length) | 0];
      const geo = spiral
        ? spiralGeo(LITE ? 900 : 2600, 4, 2 + ((Math.random() * 3) | 0), 0.8 + Math.random() * 0.7, 0.4, 3, pair[0], pair[1], 0.16)
        : ellipticalGeo(LITE ? 700 : 1700, 3.4, ell[(Math.random() * ell.length) | 0]);
      out.push({ pos: [Math.cos(ang) * dist, elev, Math.sin(ang) * dist], scale: 2.2 + Math.random() * 5, rot: [Math.random() * 0.9, Math.random() * Math.PI, Math.random() * 0.9], geo });
    }
    return out;
  }, []);
  // ディスク内に埋め込む高品質天体。実在の恒星（名前＋スペクトル色）＋実在系外惑星（既存テクスチャ流用）＋
  // 穴埋めの恒星。俯瞰では明るい塊、寄ると一つ一つが高品質天体に解像する。
  const innerBodies = useMemo<IBody[]>(() => {
    const STARS: [string, string, number][] = [
      ["シリウス", "#cdd9ff", 0.5], ["ベテルギウス", "#ff7a55", 1.6], ["リゲル", "#aabfff", 1.0], ["ベガ", "#d2dcff", 0.5],
      ["アークトゥルス", "#ffcf9a", 0.85], ["アルデバラン", "#ffb877", 0.9], ["アンタレス", "#ff6f4d", 1.5], ["スピカ", "#9fb6ff", 0.6],
      ["カペラ", "#fff0d8", 0.7], ["プロキオン", "#fbf6ea", 0.42], ["アルタイル", "#e8eeff", 0.42], ["デネブ", "#e6ecff", 1.2],
      ["カノープス", "#f3f5ff", 1.0], ["フォーマルハウト", "#dbe4ff", 0.5], ["ポルックス", "#ffd0a0", 0.7], ["レグルス", "#c2d2ff", 0.55],
    ];
    const EXO: [string, string, number][] = [
      ["ケプラー452b", "earth", 0.5], ["TRAPPIST-1e", "earth", 0.42], ["プロキシマb", "mars", 0.4], ["HD 189733b", "neptune", 0.62],
      ["55カンクリe", "venus", 0.46], ["ケプラー22b", "neptune", 0.55], ["WASP-12b", "jupiter", 0.72], ["グリーゼ667Cc", "mars", 0.44],
    ];
    const SPECTRAL = ["#9bb0ff", "#aabfff", "#cad7ff", "#f6f5ff", "#fff4e8", "#ffd2a1", "#ff9966"];
    const place = (): [number, number, number] => { const r = 6 + Math.pow(Math.random(), 0.85) * 22, a = Math.random() * Math.PI * 2; return [Math.cos(a) * r, (Math.random() - 0.5) * 2.2, Math.sin(a) * r]; };
    const out: IBody[] = [];
    for (const [n, c, s] of STARS) out.push({ kind: "star", name: n, color: c, glow: c, size: s, pos: place() });
    for (const [n, k, s] of EXO) out.push({ kind: "planet", name: n, color: "#ffffff", glow: "#bcd6ff", size: s, planetKey: k, pos: place() });
    const fillerN = LITE ? 8 : 18;
    for (let i = 0; i < fillerN; i++) { const c = SPECTRAL[(Math.random() * SPECTRAL.length) | 0]; out.push({ kind: "star", name: "", color: c, glow: c, size: 0.12 + Math.pow(Math.random(), 2) * 0.45, pos: place() }); }
    return out;
  }, []);
  const distantGeo = useMemo(() => fieldGeo(LITE ? 1200 : 2600, 70, 135, ["#ffd9a0", "#bcd0ff", "#ffb0d0", "#a0d8ff", "#fff0d0"], 1.4, 3.6, 0.7), []);
  const starGeo = useMemo(() => fieldGeo(LITE ? 5000 : 16000, 20, 132, ["#ffffff", "#cfe0ff", "#ffe6c2"], 0.5, 1.4, 1.0), []);
  const mainMat = useMemo(() => makeMat(galaxyVert, 1.05, true), []);
  const satMat = useMemo(() => makeMat(pointVert, 0.9), []);
  const distantMat = useMemo(() => makeMat(pointVert, 2.4), []);
  const starMat = useMemo(() => makeMat(pointVert, 0.7), []);
  const markerLocal = useMemo<[number, number, number]>(() => {
    const r = 18, a = r * GAL_SPIN; // branch 0 のアーム上
    return [Math.cos(a) * r, 0.4, Math.sin(a) * r];
  }, []);
  useEffect(() => () => {
    mainGeo.dispose(); distantGeo.dispose(); starGeo.dispose();
    satellites.forEach((s) => s.geo.dispose());
    mainMat.dispose(); satMat.dispose(); distantMat.dispose(); starMat.dispose();
  }, [mainGeo, distantGeo, starGeo, satellites, mainMat, satMat, distantMat, starMat]);
  useFrame((_, d) => {
    mainMat.uniforms.uTime.value += d;
    if (satGroup.current) satGroup.current.rotation.y += d * 0.015;
    if (innerGroup.current) innerGroup.current.rotation.y += d * 0.006; // 寄って観察しやすいよう極ゆっくり公転
    if (markerG.current) markerG.current.rotation.y += d * 0.04; // アームと同じ差動角(r=18)で公転
  });
  return (
    <group>
      <sprite scale={[9, 9, 1]}><spriteMaterial map={galaxyGlow()} color="#fff0d0" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[22, 22, 1]}><spriteMaterial map={galaxyGlow()} color="#ffcaa0" transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <points geometry={mainGeo} material={mainMat} />
      <group ref={satGroup}>
        {satellites.map((s, i) => (
          <group key={i} position={s.pos} rotation={s.rot} scale={s.scale}>
            <points geometry={s.geo} material={satMat} />
          </group>
        ))}
      </group>
      {/* ディスク内の高品質天体（俯瞰=明るい塊 / 寄ると一つ一つが高品質天体に解像。遅延マウントで軽量） */}
      <group ref={innerGroup}>
        {innerBodies.map((b, i) => <InnerBody key={i} body={b} />)}
      </group>
      <points geometry={distantGeo} material={distantMat} />
      <points geometry={starGeo} material={starMat} />
      <group ref={markerG}>
        <group position={markerLocal}>
          <sprite scale={[2.6, 2.6, 1]}><spriteMaterial map={galaxyGlow()} color="#ffe08a" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        </group>
      </group>
    </group>
  );
}

export default function PlanetViewer() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const controls = useRef<Controls | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  // 選択中の天体チップを常にビューポート中央へスクロール（モバイルで探しやすい）
  useEffect(() => {
    if (!open) return;
    const el = selectorRef.current?.querySelector('[aria-selected="true"]') as HTMLElement | null;
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [idx, open]);
  // 遷移中だけ「前の天体」も描画（飛び去る様子が見える）
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const prevRef = useRef(idx);
  useEffect(() => {
    if (prevRef.current !== idx) {
      setPrevIdx(prevRef.current);
      prevRef.current = idx;
      const t = setTimeout(() => setPrevIdx(null), 1500);
      return () => clearTimeout(t);
    }
  }, [idx]);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const k = (e as CustomEvent).detail?.planet;
      if (k) {
        const i = PLANETS.findIndex((x) => x.key === k);
        if (i >= 0) setIdx(i);
      }
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (open && e.key === "ArrowRight") setIdx((v) => (v + 1) % PLANETS.length);
      if (open && e.key === "ArrowLeft") setIdx((v) => (v - 1 + PLANETS.length) % PLANETS.length);
    };
    window.addEventListener("cosmic:open-viewer", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("cosmic:open-viewer", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    // 背景3Dへ開閉を通知（オープン中は背景の描画を停止＝二重描画の解消）
    window.dispatchEvent(new CustomEvent("cosmic:viewer", { detail: { open } }));
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  const p = PLANETS[idx];
  return (
    <div role="dialog" aria-modal="true" aria-label="惑星鑑賞" className="pv-overlay">
      <style>{PV_CSS}</style>
      <Canvas camera={{ position: [0, 0.3, 4], fov: 45, near: 0.05, far: 700 }} dpr={LITE ? 1 : [1, 2]} gl={{ antialias: !LITE, alpha: false, stencil: false, powerPreference: "high-performance" }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={["#04050b"]} />
        <ambientLight intensity={0.06} />
        <directionalLight position={[-16, 12, 24]} intensity={3.2} color="#fff4e6" />
        <directionalLight position={[12, -4, -12]} intensity={0.35} color="#6f9cff" />
        {!p.galaxy && <Stars radius={130} depth={80} count={LITE ? 1500 : 6000} factor={3.5} saturation={0.5} fade speed={0.22} />}
        <Suspense fallback={null}>
          {p.galaxy ? <GalaxyScene /> : p.key === "earth" ? <ViewerEarth pos={vpos(p.key)} /> : <ViewerPlanet p={p} pos={vpos(p.key)} key={p.key} />}
        </Suspense>
        {prevIdx !== null && prevIdx !== idx && !p.galaxy && !PLANETS[prevIdx].galaxy && (
          <Suspense fallback={null}>
            {PLANETS[prevIdx].key === "earth" ? (
              <ViewerEarth pos={vpos(PLANETS[prevIdx].key)} />
            ) : (
              <ViewerPlanet p={PLANETS[prevIdx]} pos={vpos(PLANETS[prevIdx].key)} key={`prev-${PLANETS[prevIdx].key}`} />
            )}
          </Suspense>
        )}
        <ViewerCameraRig target={vpos(p.key)} controls={controls} galaxy={p.galaxy} />
        {!LITE && (
          <EffectComposer>
            <Bloom luminanceThreshold={0.68} luminanceSmoothing={0.22} intensity={0.42} mipmapBlur radius={0.4} />
          </EffectComposer>
        )}
        <OrbitControls ref={controls as never} enablePan={!!p.galaxy} zoomToCursor={!!p.galaxy} autoRotate={!p.galaxy} autoRotateSpeed={0.4} minDistance={p.galaxy ? 1.4 : 2.2} maxDistance={p.galaxy ? 170 : 9} enableDamping dampingFactor={0.07} />
      </Canvas>

      <header className="pv-top">
        <div className="pv-title vinfo" key={p.key}>
          <p className="pv-en">
            ✦ {p.en}<span className="pv-hint">　{p.galaxy ? "ドラッグで回転 / 見たい所へズームすると銀河の中の銀河が見えてきます" : "ドラッグで回転 / スクロール・ピンチでズーム"}</span>
          </p>
          <h2 className="pv-name">{p.name}</h2>
        </div>
        <button className="pv-close" onClick={() => setOpen(false)} aria-label="閉じる" title="閉じる">✕</button>
      </header>

      <div className="pv-bottom">
        <dl className="pv-facts vinfo" key={`f-${p.key}`}>
          {p.facts.map(([k, v]) => (
            <div className="pv-fact" key={k}>
              <dt className="pv-fact-k">{k}</dt>
              <dd className="pv-fact-v">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="pv-selector" role="tablist" aria-label="惑星を選択" ref={selectorRef}>
          {PLANETS.map((x, i) => (
            <button key={x.key} role="tab" aria-selected={i === idx} className="pv-chip" onClick={() => setIdx(i)}>
              {x.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 全デバイス対応の鑑賞モードUI（上=名前/閉じる・中央=惑星・下=情報帯＋セレクタ帯。重なり無し・横スクロール・safe-area対応）
const PV_CSS = `
.pv-overlay{position:fixed;inset:0;z-index:200;background:#04050b;}
@keyframes vinfoIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.vinfo{animation:vinfoIn .5s cubic-bezier(.16,1,.3,1) both}

.pv-top{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;
  padding:max(.9rem,env(safe-area-inset-top, 0px)) max(.9rem,env(safe-area-inset-right, 0px)) .9rem max(.9rem,env(safe-area-inset-left, 0px));
  background:linear-gradient(to bottom,rgba(4,5,11,.92),rgba(4,5,11,.45) 60%,transparent);pointer-events:none}
.pv-title{pointer-events:none;min-width:0}
.pv-en{font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.2em;text-transform:uppercase;color:#7fb2ff;margin:0}
.pv-hint{display:none;color:#6b73a0;letter-spacing:.04em}
.pv-name{font-family:"Clash Display","Zen Kaku Gothic New",sans-serif;font-weight:900;font-size:clamp(1.7rem,5.2vw,3rem);line-height:1.05;margin:.12rem 0 0;color:#fff;text-shadow:0 2px 20px rgba(0,0,0,.6)}
.pv-close{pointer-events:auto;cursor:pointer;flex:0 0 auto;width:44px;height:44px;border-radius:999px;
  background:rgba(140,150,255,.14);border:1px solid rgba(160,175,255,.32);color:#eef1ff;display:inline-flex;align-items:center;justify-content:center;font-size:1.05rem;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:background .2s,transform .15s}
.pv-close:hover{background:rgba(47,107,255,.42)}
.pv-close:active{transform:scale(.92)}

.pv-bottom{position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;flex-direction:column;gap:.7rem;
  padding:1.1rem max(.6rem,env(safe-area-inset-right, 0px)) max(.9rem,env(safe-area-inset-bottom, 0px)) max(.6rem,env(safe-area-inset-left, 0px));
  background:linear-gradient(to top,rgba(4,5,11,.94),rgba(4,5,11,.5) 60%,transparent);pointer-events:none}
.pv-facts{margin:0;display:flex;gap:.7rem 1.3rem;overflow-x:auto;pointer-events:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.pv-facts::-webkit-scrollbar{display:none}
.pv-fact{flex:0 0 auto;border-left:2px solid rgba(127,178,255,.35);padding-left:.55rem}
.pv-fact-k{font-family:"JetBrains Mono",monospace;font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;color:#8b93c4;white-space:nowrap}
.pv-fact-v{font-family:"Clash Display",sans-serif;font-weight:700;font-size:.92rem;color:#eef1ff;white-space:nowrap;margin:.1rem 0 0}
.pv-selector{display:flex;gap:.45rem;overflow-x:auto;pointer-events:auto;scrollbar-width:none;scroll-snap-type:x proximity;padding:.15rem 0}
.pv-selector::-webkit-scrollbar{display:none}
.pv-chip{flex:0 0 auto;cursor:pointer;scroll-snap-align:center;min-height:42px;display:inline-flex;align-items:center;
  background:rgba(140,150,255,.08);border:1px solid rgba(160,175,255,.2);color:#aab2dc;border-radius:999px;padding:0 1rem;white-space:nowrap;
  font-family:"Zen Kaku Gothic New",sans-serif;font-size:.9rem;transition:background .2s,color .2s,border-color .2s,transform .15s}
.pv-chip:active{transform:scale(.95)}
.pv-chip[aria-selected="true"]{background:#2f6bff;border-color:#2f6bff;color:#fff;box-shadow:0 6px 20px rgba(47,107,255,.45)}

@media (min-width:760px){
  .pv-top{padding-top:1.5rem}
  .pv-hint{display:inline}
  .pv-bottom{align-items:center;gap:1rem;padding-bottom:1.6rem}
  .pv-facts{justify-content:center;flex-wrap:wrap;overflow:visible;max-width:90vw}
  .pv-selector{justify-content:center;flex-wrap:wrap;overflow:visible;max-width:90vw}
  .pv-chip{font-size:.95rem}
}
@media (max-height:480px){
  .pv-name{font-size:1.4rem}
  .pv-bottom{gap:.4rem;padding-top:.55rem}
  .pv-fact-v{font-size:.82rem}
  .pv-chip{min-height:38px}
}
@media (prefers-reduced-motion:reduce){.vinfo{animation:none}}
`;

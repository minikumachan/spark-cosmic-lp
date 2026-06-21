import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/* 惑星鑑賞モード：フルスクリーン・OrbitControlsで自由に回転/ズーム。
   惑星セレクタ＋情報パネル。サイトを開くだけで動作（事前準備不要）。
   開いている間だけ Canvas をマウント（軽量）。Esc/×で閉じる。 */

type V = {
  key: string;
  name: string;
  en: string;
  src: string;
  rocky?: boolean;
  ring?: boolean;
  sun?: boolean;
  atmo?: string;
  facts: [string, string][];
};
const PLANETS: V[] = [
  { key: "sun", name: "太陽", en: "Sun", src: "/assets/planet/sun.webp", sun: true, facts: [["直径", "1,392,700 km"], ["表面温度", "約 5,500 ℃"], ["太陽系質量", "99.86 %"], ["種別", "G型主系列星"]] },
  { key: "mercury", name: "水星", en: "Mercury", src: "/assets/planet/mercury.webp", rocky: true, facts: [["直径", "4,879 km"], ["太陽から", "0.39 AU"], ["公転周期", "88 日"], ["大気", "ほぼ無し"]] },
  { key: "venus", name: "金星", en: "Venus", src: "/assets/planet/venus.webp", atmo: "#e8c87a", facts: [["直径", "12,104 km"], ["太陽から", "0.72 AU"], ["公転周期", "225 日"], ["表面温度", "462 ℃"]] },
  { key: "earth", name: "地球", en: "Earth", src: "/assets/planet/earth_day.webp", rocky: true, atmo: "#5fb8ff", facts: [["直径", "12,742 km"], ["太陽から", "1.0 AU"], ["公転周期", "365 日"], ["衛星", "1（月）"]] },
  { key: "moon", name: "月", en: "Moon", src: "/assets/planet/moon.webp", rocky: true, facts: [["直径", "3,474 km"], ["地球から", "384,400 km"], ["公転周期", "27.3 日"], ["重力", "地球の 1/6"]] },
  { key: "mars", name: "火星", en: "Mars", src: "/assets/planet/mars.webp", rocky: true, atmo: "#ff7a4d", facts: [["直径", "6,779 km"], ["太陽から", "1.52 AU"], ["公転周期", "687 日"], ["衛星", "2"]] },
  { key: "jupiter", name: "木星", en: "Jupiter", src: "/assets/planet/jupiter.webp", atmo: "#e8b87a", facts: [["直径", "139,820 km"], ["太陽から", "5.2 AU"], ["公転周期", "11.9 年"], ["衛星", "95+"]] },
  { key: "saturn", name: "土星", en: "Saturn", src: "/assets/planet/saturn.webp", ring: true, atmo: "#e6c77a", facts: [["直径", "116,460 km"], ["太陽から", "9.5 AU"], ["公転周期", "29.5 年"], ["環", "主要 7 本"]] },
  { key: "uranus", name: "天王星", en: "Uranus", src: "/assets/planet/uranus.webp", atmo: "#9fe8e0", facts: [["直径", "50,724 km"], ["太陽から", "19.2 AU"], ["公転周期", "84 年"], ["自転軸", "98°（横倒し）"]] },
  { key: "neptune", name: "海王星", en: "Neptune", src: "/assets/planet/neptune.webp", atmo: "#5b8cff", facts: [["直径", "49,244 km"], ["太陽から", "30 AU"], ["公転周期", "165 年"], ["最大風速", "2,100 km/h"]] },
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
  const map = useTexture(p.src);
  useMemo(() => { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 16; }, [map]);
  const u = useMemo(() => ({ uColor: { value: new THREE.Color(p.atmo ?? "#88aaff") } }), [p.atmo]);
  const t = useRef(0);
  useFrame((_, d) => {
    if (t.current < 1) t.current = Math.min(1, t.current + d * 2.0);
    if (ref.current) ref.current.rotation.y += d * (0.06 + (1 - t.current) * 0.55); // 着地時に初速スピン
  });
  return (
    <group position={pos} rotation={[0.25, 0, 0.08]}>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 128, 128]} />
        {p.sun ? (
          <meshBasicMaterial map={map} toneMapped={false} />
        ) : (
          <meshStandardMaterial map={map} bumpMap={p.rocky ? map : null} bumpScale={p.rocky ? 0.07 : 0} roughness={p.rocky ? 0.96 : 0.55} metalness={0} />
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
};
const vpos = (key: string) => new THREE.Vector3(...(VPOS[key] ?? [0, 0, 0]));

// 切替時：OrbitControls の target を新天体へ滑らかに移動。
// → カメラは offset を保ったまま「空間を移動し、向き直りながら近づく」飛行になる。
type Controls = { enabled: boolean; update: () => void; target: THREE.Vector3 };
function ViewerCameraRig({ target, controls }: { target: THREE.Vector3; controls: React.RefObject<Controls | null> }) {
  const inited = useRef(false);
  useFrame(({ camera }, d) => {
    if (!controls.current) return;
    if (!inited.current) {
      // 開いた瞬間は飛ばずに最初の天体を即フレーミング
      inited.current = true;
      controls.current.target.copy(target);
      camera.position.set(target.x, target.y + 0.4, target.z + 4);
      controls.current.update();
      return;
    }
    const k = 1 - Math.exp(-2.6 * d); // フレームレート非依存の滑らかな追従＝惑星へ飛んで近づく
    controls.current.target.lerp(target, k);
    controls.current.update();
  });
  return null;
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
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  const p = PLANETS[idx];
  return (
    <div role="dialog" aria-modal="true" aria-label="惑星鑑賞" className="pv-overlay">
      <style>{PV_CSS}</style>
      <Canvas camera={{ position: [0, 0.3, 4], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: false, stencil: false }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={["#04050b"]} />
        <ambientLight intensity={0.06} />
        <directionalLight position={[-16, 12, 24]} intensity={3.2} color="#fff4e6" />
        <directionalLight position={[12, -4, -12]} intensity={0.35} color="#6f9cff" />
        <Stars radius={130} depth={80} count={6000} factor={3.5} saturation={0.5} fade speed={0.22} />
        <Suspense fallback={null}>
          {p.key === "earth" ? <ViewerEarth pos={vpos(p.key)} /> : <ViewerPlanet p={p} pos={vpos(p.key)} key={p.key} />}
        </Suspense>
        {prevIdx !== null && prevIdx !== idx && (
          <Suspense fallback={null}>
            {PLANETS[prevIdx].key === "earth" ? (
              <ViewerEarth pos={vpos(PLANETS[prevIdx].key)} />
            ) : (
              <ViewerPlanet p={PLANETS[prevIdx]} pos={vpos(PLANETS[prevIdx].key)} key={`prev-${PLANETS[prevIdx].key}`} />
            )}
          </Suspense>
        )}
        <ViewerCameraRig target={vpos(p.key)} controls={controls} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.68} luminanceSmoothing={0.22} intensity={0.42} mipmapBlur radius={0.4} />
        </EffectComposer>
        <OrbitControls ref={controls as never} enablePan={false} autoRotate autoRotateSpeed={0.4} minDistance={2.2} maxDistance={9} enableDamping dampingFactor={0.07} />
      </Canvas>

      <header className="pv-top">
        <div className="pv-title vinfo" key={p.key}>
          <p className="pv-en">
            ✦ {p.en}<span className="pv-hint">　ドラッグで回転 / スクロール・ピンチでズーム</span>
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

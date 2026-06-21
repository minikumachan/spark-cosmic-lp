import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
        <sphereGeometry args={[1, 160, 160]} />
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
        <sphereGeometry args={[1, 200, 200]} />
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
    <div role="dialog" aria-modal="true" aria-label="惑星鑑賞" style={S.overlay}>
      <style>{`@keyframes vinfoIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}.vinfo{animation:vinfoIn .55s cubic-bezier(.16,1,.3,1) both}.vchip{transition:all .25s cubic-bezier(.16,1,.3,1)}`}</style>
      <Canvas camera={{ position: [0, 0.3, 4], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: false }} style={{ position: "absolute", inset: 0 }}>
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

      <div style={S.topbar}>
        <span style={S.kicker}>✦ 惑星図鑑 — ドラッグで回転・スクロールでズーム</span>
        <button onClick={() => setOpen(false)} style={S.close} aria-label="閉じる">✕ 閉じる</button>
      </div>

      <div style={S.info} className="vinfo" key={p.key}>
        <p style={S.en}>{p.en}</p>
        <h2 style={S.name}>{p.name}</h2>
        <dl style={S.facts}>
          {p.facts.map(([k, v]) => (
            <div key={k} style={S.fact}>
              <dt style={S.factK}>{k}</dt>
              <dd style={S.factV}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div style={S.selector} role="tablist" aria-label="惑星を選択">
        {PLANETS.map((x, i) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={i === idx}
            onClick={() => setIdx(i)}
            style={{ ...S.chip, ...(i === idx ? S.chipOn : {}) }}
          >
            {x.name}
          </button>
        ))}
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  overlay: { position: "fixed", inset: 0, zIndex: 200, background: "#05060d" },
  topbar: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "clamp(1rem,3vw,2rem)", pointerEvents: "none" },
  kicker: { fontFamily: '"JetBrains Mono",monospace', fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#9db4ff" },
  close: { pointerEvents: "auto", cursor: "pointer", background: "rgba(140,150,255,0.1)", border: "1px solid rgba(160,175,255,0.3)", color: "#eef1ff", borderRadius: 999, padding: "0.55rem 1.1rem", fontFamily: '"JetBrains Mono",monospace', fontSize: "0.72rem" },
  info: { position: "absolute", left: "clamp(1rem,4vw,3.5rem)", bottom: "clamp(5.5rem,12vw,7rem)", maxWidth: 320, pointerEvents: "none", textShadow: "0 1px 20px rgba(0,0,0,0.8)" },
  en: { fontFamily: '"JetBrains Mono",monospace', fontSize: "0.72rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#7fb2ff" },
  name: { fontFamily: '"Clash Display","Zen Kaku Gothic New",sans-serif', fontWeight: 900, fontSize: "clamp(2.4rem,6vw,4rem)", lineHeight: 1, margin: "0.3rem 0 1.2rem", color: "#fff" },
  facts: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem 1.4rem", margin: 0 },
  fact: { borderTop: "1px solid rgba(160,175,255,0.18)", paddingTop: "0.5rem" },
  factK: { fontFamily: '"JetBrains Mono",monospace', fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8b93c4" },
  factV: { fontFamily: '"Clash Display",sans-serif', fontWeight: 700, fontSize: "1.05rem", color: "#eef1ff", margin: "0.15rem 0 0" },
  selector: { position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "clamp(1.2rem,3vw,2rem)", display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center", maxWidth: "92vw" },
  chip: { cursor: "pointer", background: "rgba(140,150,255,0.06)", border: "1px solid rgba(160,175,255,0.2)", color: "#aab2dc", borderRadius: 999, padding: "0.5rem 1rem", fontFamily: '"Zen Kaku Gothic New",sans-serif', fontSize: "0.85rem", transition: "all 0.2s" },
  chipOn: { background: "#2f6bff", border: "1px solid #2f6bff", color: "#fff", boxShadow: "0 8px 24px rgba(47,107,255,0.4)" },
};

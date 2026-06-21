import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad, useTexture, PerformanceMonitor, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/* ── 永続コズミック背景：星雲 + 星 + フォトリアル惑星群 + 粒子銀河。
   スクロールで各セクションごとに別の実在惑星へ遷移する「旅」。
   地球(hero)→月→火星→木星→土星(環)→海王星→銀河(contact)。
   軽量化: 全テクスチャWebP(計~0.6MB)、モバイルは粒子/星雲/dpr削減、非表示時は描画停止。 ── */

const GX = -22, GY = 6.5, GZ = -40; // 銀河の位置（旅の終点・遠方）

const MOBILE =
  typeof window !== "undefined" &&
  (window.innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4);

// ── nebula（オクターブ数を端末で出し分け＝軽量化） ──
const nebulaVert = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const nebulaFrag = (oct: number) => /* glsl */ `
precision highp float;
uniform float uTime; uniform vec2 uRes;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p);
  float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<${oct};i++){ v+=a*noise(p); p=m*p; a*=0.5; } return v; }
void main(){
  vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  float t=uTime*0.012;
  vec2 q=p*1.4+vec2(t,-t*0.6);
  float n1=fbm(q), n2=fbm(q*2.1+n1*1.4+vec2(-t*0.8,t*0.6));
  vec3 col=vec3(0.012,0.016,0.05);
  vec3 neb=mix(vec3(0.09,0.05,0.30),vec3(0.55,0.11,0.45),smoothstep(0.25,0.85,n1));
  neb=mix(neb,vec3(0.08,0.42,0.85),smoothstep(0.35,0.95,n2));
  col+=neb*pow(n1,2.4)*0.85;
  col*=1.0-0.5*dot(p,p);
  gl_FragColor=vec4(col,1.0);
}`;
function Nebula() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((s) => s.gl);
  const res = useThree((s) => s.size);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } }), []);
  const frag = useMemo(() => nebulaFrag(MOBILE ? 4 : 6), []);
  // uRes は resize 時のみ更新（毎フレーム読み回避）
  useEffect(() => {
    uniforms.uRes.value.set(res.width * gl.getPixelRatio(), res.height * gl.getPixelRatio());
  }, [res, gl, uniforms]);
  useFrame((_, d) => { if (mat.current) mat.current.uniforms.uTime.value += d; });
  return (
    <ScreenQuad renderOrder={-10}>
      <shaderMaterial ref={mat} vertexShader={nebulaVert} fragmentShader={frag} uniforms={uniforms} depthTest={false} depthWrite={false} />
    </ScreenQuad>
  );
}

// ── earth（hero・フル：雲/大気/夜景/法線） ──
const atmoVert = /* glsl */ `varying vec3 vN; varying vec3 vView;
void main(){ vec4 vp=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vView=normalize(-vp.xyz); gl_Position=projectionMatrix*vp; }`;
const atmoFrag = /* glsl */ `varying vec3 vN; varying vec3 vView; uniform vec3 uColor;
void main(){ float f=pow(1.0-max(dot(vN,vView),0.0),2.8); gl_FragColor=vec4(uColor*f*0.45,f); }`;
function Earth() {
  const earth = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
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
  const atmo = useMemo(() => ({ uColor: { value: new THREE.Color("#5fb8ff") } }), []);
  useFrame((_, d) => {
    if (earth.current) earth.current.rotation.y += d * 0.025;
    if (clouds.current) clouds.current.rotation.y += d * 0.034;
    if (shadow.current && clouds.current) shadow.current.rotation.y = clouds.current.rotation.y - 0.05; // 雲影を反太陽側へオフセット
  });
  return (
    <group rotation={[0.33, 0, 0.1]} scale={2.0} position={[2.15, -1.75, 0]}>
      <mesh ref={earth}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={day} normalMap={normal} normalScale={new THREE.Vector2(0.8, 0.8)} emissiveMap={lights} emissive={new THREE.Color("#ffd9a0")} emissiveIntensity={0.55} roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh ref={shadow} scale={1.004}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={clud} alphaMap={clud} color="#000000" transparent opacity={0.32} depthWrite={false} roughness={1} />
      </mesh>
      <mesh ref={clouds} scale={1.013}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={clud} alphaMap={clud} transparent opacity={0.88} depthWrite={false} roughness={1} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={atmo} side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Planet（高画質：バンプ起伏＋大気リム＋任意の環。遅延ロード対応） ──
function SaturnRing() {
  const tex = useTexture("/assets/planet/saturn_ring.webp");
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(1.32, 2.45, 160);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = (v.length() - 1.32) / (2.45 - 1.32);
      uv.setXY(i, r, 0.5);
    }
    return g;
  }, []);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
  }, [tex]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2 + 0.16, 0, 0]}>
      <meshStandardMaterial map={tex} transparent side={THREE.DoubleSide} roughness={0.85} metalness={0.05} depthWrite={false} />
    </mesh>
  );
}
const rimFrag = /* glsl */ `varying vec3 vN; varying vec3 vView; uniform vec3 uColor;
void main(){ float f=pow(1.0-max(dot(vN,vView),0.0),3.0); gl_FragColor=vec4(uColor*f*0.5,f); }`;
function AtmosphereRim({ color }: { color: string }) {
  const u = useMemo(() => ({ uColor: { value: new THREE.Color(color) } }), [color]);
  return (
    <mesh scale={1.045}>
      <sphereGeometry args={[1, 48, 48]} />
      <shaderMaterial vertexShader={atmoVert} fragmentShader={rimFrag} uniforms={u} side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
    </mesh>
  );
}

type PlanetDef = {
  src: string;
  pos: [number, number, number];
  scale: number;
  rot: number;
  tilt: number;
  ring?: boolean;
  faintRing?: boolean;
  rocky?: boolean;
  bump?: number;
  normalSrc?: string;
  atmo?: string;
};
// rot は実際の自転の向き/速さの比率（ガス惑星=速い・内惑星=遅い・金星/天王星=逆行）
const PLANETS: PlanetDef[] = [
  { src: "/assets/planet/moon.webp", normalSrc: "/assets/planet/moon_n.webp", pos: [-3, 1.8, -5.5], scale: 0.5, rot: 0.004, tilt: 0.2, rocky: true },
  { src: "/assets/planet/mars.webp", normalSrc: "/assets/planet/mars_n.webp", pos: [-7.5, -2.6, -11.5], scale: 0.9, rot: 0.038, tilt: 0.35, rocky: true, atmo: "#ff7a4d" },
  { src: "/assets/planet/jupiter.webp", pos: [-11.5, 4.2, -18.5], scale: 2.3, rot: 0.1, tilt: 0.18, atmo: "#e8b87a" },
  { src: "/assets/planet/saturn.webp", pos: [-15.5, -2, -26], scale: 1.6, rot: 0.09, tilt: 0.42, ring: true, atmo: "#e6c77a" },
  { src: "/assets/planet/neptune.webp", pos: [-19, 5.6, -33], scale: 1.2, rot: 0.06, tilt: 0.25, atmo: "#5b8cff" },
];
// 太陽系を完全再現する常在天体（水星・金星・天王星・冥王星）
const AMBIENT: PlanetDef[] = [
  { src: "/assets/planet/mercury.webp", normalSrc: "/assets/planet/mercury_n.webp", pos: [16, 5, 9], scale: 0.42, rot: 0.004, tilt: 0.03, rocky: true },
  { src: "/assets/planet/venus.webp", pos: [10, 1.5, 5], scale: 0.85, rot: -0.002, tilt: 0.05, atmo: "#e8c87a" },
  { src: "/assets/planet/uranus.webp", pos: [-17.5, 1.5, -30], scale: 1.3, rot: -0.055, tilt: 1.6, faintRing: true, atmo: "#9fe8e0" },
  { src: "/assets/planet/moon.webp", normalSrc: "/assets/planet/moon_n.webp", pos: [-24, 3, -46], scale: 0.28, rot: 0.003, tilt: 0.1, rocky: true }, // 冥王星(遠方の準惑星)
];

function FaintRing() {
  const geo = useMemo(() => new THREE.RingGeometry(1.4, 1.95, 96), []);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2 + 0.05, 0, 0]}>
      <meshBasicMaterial color="#9fe8e0" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
    </mesh>
  );
}

function Planet({ src, pos, scale, rot, tilt, ring, faintRing, rocky, normalSrc, atmo }: PlanetDef) {
  const ref = useRef<THREE.Mesh>(null);
  const [map, nrm] = useTexture([src, normalSrc ?? src]);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;
  }, [map]);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * rot;
  });
  return (
    <group position={pos} rotation={[tilt, 0, 0.04]} scale={scale}>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial
          map={map}
          normalMap={normalSrc ? nrm : null}
          normalScale={normalSrc ? new THREE.Vector2(1.4, 1.4) : undefined}
          roughness={rocky ? 0.95 : 0.6}
          metalness={0}
        />
      </mesh>
      {ring && <SaturnRing />}
      {faintRing && <FaintRing />}
      {atmo && <AtmosphereRim color={atmo} />}
    </group>
  );
}

// 常在天体（水星/金星/天王星）＝太陽系の完全再現
function AmbientBodies() {
  return (
    <>
      {AMBIENT.map((p) => (
        <Suspense key={p.src} fallback={null}>
          <Planet {...p} />
        </Suspense>
      ))}
    </>
  );
}

// 衛星（ガス惑星を周回）：木星=ガリレオ衛星4＋土星=タイタン
type MoonDef = { center: [number, number, number]; radius: number; size: number; color: string; speed: number; phase: number; incline: number };
const MOONS: MoonDef[] = [
  // Jupiter [-11.5,4.2,-18.5]（ガリレオ衛星）
  { center: [-11.5, 4.2, -18.5], radius: 3.4, size: 0.12, color: "#e8d27a", speed: 0.5, phase: 0, incline: 0.2 }, // Io
  { center: [-11.5, 4.2, -18.5], radius: 4.2, size: 0.11, color: "#e8e0d0", speed: 0.38, phase: 1.6, incline: 0.15 }, // Europa
  { center: [-11.5, 4.2, -18.5], radius: 5.1, size: 0.16, color: "#b9a98a", speed: 0.3, phase: 3.0, incline: 0.25 }, // Ganymede
  { center: [-11.5, 4.2, -18.5], radius: 6.2, size: 0.15, color: "#8a8378", speed: 0.24, phase: 4.5, incline: 0.1 }, // Callisto
  // Saturn [-15.5,-2,-26]（タイタン）
  { center: [-15.5, -2, -26], radius: 3.6, size: 0.14, color: "#d8a85a", speed: 0.3, phase: 2.0, incline: 0.3 }, // Titan
];
function Moon3D({ m }: { m: MoonDef }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const a = clock.elapsedTime * m.speed + m.phase;
    ref.current.position.set(
      m.center[0] + Math.cos(a) * m.radius,
      m.center[1] + Math.sin(a) * m.radius * m.incline,
      m.center[2] + Math.sin(a) * m.radius,
    );
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[m.size, 20, 20]} />
      <meshStandardMaterial color={m.color} roughness={1} metalness={0} />
    </mesh>
  );
}
function Moons() {
  return (
    <>
      {MOONS.map((m, i) => (
        <Moon3D key={i} m={m} />
      ))}
    </>
  );
}

// 遅延ロード：接近したセクションの惑星のみマウント（初期は地球＋月だけ＝とてつもなく軽い）
function Planets() {
  const [upTo, setUpTo] = useState(1);
  useEffect(() => {
    const sels = ["#services", "#works", "#strengths", "#pricing", "#faq"];
    let centers: number[] = [];
    const measure = () => {
      centers = sels.map((s) => {
        const el = document.querySelector(s) as HTMLElement | null;
        if (!el) return Number.POSITIVE_INFINITY;
        const r = el.getBoundingClientRect();
        return r.top + window.scrollY + r.height / 2;
      });
    };
    const onScroll = () => {
      const probe = window.scrollY + window.innerHeight;
      let reached = 0;
      for (let i = 0; i < centers.length; i++)
        if (probe > centers[i] - window.innerHeight * 0.9) reached = i + 1;
      setUpTo((v) => Math.max(v, Math.min(reached + 1, PLANETS.length))); // 次も先読み（ポップイン防止）
    };
    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const t = window.setTimeout(() => {
      measure();
      onScroll();
    }, 800);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, []);
  return (
    <>
      {PLANETS.slice(0, upTo).map((p) => (
        <Suspense key={p.src} fallback={null}>
          <Planet {...p} />
        </Suspense>
      ))}
    </>
  );
}

// FPS監視でDPRを自動調整（弱GPUで自動的に軽量化＝かくつかない）
function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr);
  return (
    <PerformanceMonitor
      onChange={({ factor }) => setDpr((MOBILE ? 0.75 : 0.9) + (MOBILE ? 0.25 : 0.6) * factor)}
    />
  );
}

// 星：色/明るさに変化のある密な層＋疎で明るい層
function Stars() {
  const tint = useMemo(
    () => [new THREE.Color("#ffffff"), new THREE.Color("#bcd0ff"), new THREE.Color("#ffe6c2"), new THREE.Color("#cfe0ff")],
    [],
  );
  const make = (count: number, rMin: number, rMax: number, bMin: number) => {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3, r = rMin + Math.random() * (rMax - rMin);
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
      pos[i3] = r * Math.sin(th) * Math.cos(ph);
      pos[i3 + 1] = r * Math.cos(th);
      pos[i3 + 2] = r * Math.sin(th) * Math.sin(ph);
      const c = tint[(Math.random() * tint.length) | 0];
      const b = bMin + Math.random() * (1 - bMin);
      col[i3] = c.r * b; col[i3 + 1] = c.g * b; col[i3 + 2] = c.b * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  };
  const dense = useMemo(() => make(MOBILE ? 3000 : 7000, 20, 80, 0.3), []);
  const bright = useMemo(() => make(MOBILE ? 150 : 360, 14, 55, 0.82), []);
  useEffect(() => () => { dense.dispose(); bright.dispose(); }, [dense, bright]);
  return (
    <>
      <points geometry={dense}>
        <pointsMaterial size={0.085} sizeAttenuation vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </points>
      <points geometry={bright}>
        <pointsMaterial size={0.32} sizeAttenuation vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </points>
    </>
  );
}

// 多周波ノイズで凹凸させた不規則な岩ジオメトリ（球ベース・高ポリ・seedで形を変える）
function makeRockGeometry(seed: number) {
  const g = new THREE.SphereGeometry(1, 26, 20);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const s = seed * 1.7;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = v.clone().normalize();
    const d =
      1 +
      0.3 * Math.sin(u.x * 2.6 + 0.5 + s) +
      0.24 * Math.sin(u.y * 2.4 + 1.3 + s) +
      0.2 * Math.sin(u.z * 2.9 + 2.1 + s) +
      0.15 * Math.sin(u.x * 5.5 + u.y * 4.5 + s) +
      0.11 * Math.sin(u.z * 7.5 - u.x * 5.5 + s) +
      0.08 * Math.sin(u.y * 11.0 + u.z * 9.0 + s) +
      0.05 * Math.sin(u.x * 16.0 - u.z * 13.0 + s);
    v.copy(u).multiplyScalar(Math.max(0.48, d));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

type RockProps = {
  pos: [number, number, number]; rot: [number, number, number];
  radMin: number; radMax: number; yJit: number; sMin: number; sMax: number;
  tints: [number, number, number][]; spin: number;
};
// 1つのバリアント（固有形状の岩を InstancedMesh で多数配置）
function RockVariant({
  geo, map, nrm, n, radMin, radMax, yJit, sMin, sMax, tints,
}: { geo: THREE.BufferGeometry; map: THREE.Texture; nrm: THREE.Texture; n: number } & Omit<RockProps, "pos" | "rot" | "spin">) {
  const inst = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!inst.current) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, rad = radMin + Math.random() * (radMax - radMin);
      dummy.position.set(Math.cos(ang) * rad, (Math.random() - 0.5) * yJit, Math.sin(ang) * rad);
      dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const sc = sMin + Math.random() * (sMax - sMin);
      dummy.scale.set(sc * (0.55 + Math.random() * 0.8), sc * (0.55 + Math.random() * 0.8), sc * (0.55 + Math.random() * 0.8));
      dummy.updateMatrix();
      inst.current.setMatrixAt(i, dummy.matrix);
      const t = tints[(Math.random() * tints.length) | 0], k = 0.65 + Math.random() * 0.55;
      col.setRGB(t[0] * k, t[1] * k, t[2] * k);
      inst.current.setColorAt(i, col);
    }
    inst.current.instanceMatrix.needsUpdate = true;
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true;
  }, [n, radMin, radMax, yJit, sMin, sMax, tints]);
  return (
    <instancedMesh ref={inst} args={[geo, undefined, n]}>
      <meshStandardMaterial map={map} normalMap={nrm} normalScale={new THREE.Vector2(2.6, 2.6)} roughness={0.96} metalness={0.02} />
    </instancedMesh>
  );
}
// 岩の帯：3つの固有形状を混在＝石一つ一つが別形状
function RockBelt({ count, pos, rot, spin, ...rest }: { count: number } & RockProps) {
  const grp = useRef<THREE.Group>(null);
  const [map, nrm] = useTexture(["/assets/planet/moon.webp", "/assets/planet/moon_n.webp"]);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    nrm.anisotropy = 8;
  }, [map, nrm]);
  const geos = useMemo(() => [makeRockGeometry(0), makeRockGeometry(1.3), makeRockGeometry(2.7)], []);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  useFrame((_, d) => { if (grp.current) grp.current.rotation.y += d * spin; });
  const per = Math.ceil(count / geos.length);
  return (
    <group ref={grp} position={pos} rotation={rot}>
      {geos.map((g, i) => (
        <RockVariant key={i} geo={g} map={map} nrm={nrm} n={per} {...rest} />
      ))}
    </group>
  );
}
function AsteroidBelt() {
  return (
    <RockBelt
      count={MOBILE ? 70 : 135}
      pos={[-9.5, -1, -15]}
      rot={[0.34, 0, 0.08]}
      radMin={6}
      radMax={14}
      yJit={1.4}
      sMin={0.04}
      sMax={0.17}
      spin={0.03}
      tints={[[0.54, 0.49, 0.42], [0.46, 0.42, 0.38], [0.6, 0.52, 0.44], [0.4, 0.38, 0.36]]}
    />
  );
}

// 太陽（実テクスチャの表面＋コロナのグロー・光源）
function Sun() {
  const tex = useTexture("/assets/planet/sun.webp");
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; }, [tex]);
  const core = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (core.current) core.current.rotation.y += d * 0.012; });
  return (
    <group position={[24, 8, 16]}>
      <mesh ref={core}>
        <sphereGeometry args={[1.7, 48, 48]} />
        <meshBasicMaterial map={tex} toneMapped={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.2, 24, 24]} />
        <meshBasicMaterial color="#ffd98a" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.6, 24, 24]} />
        <meshBasicMaterial color="#ffb84d" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[7, 20, 20]} />
        <meshBasicMaterial color="#ff9a3d" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

// 柔らかい放射状テクスチャ（星雲雲/銀河/彗星のグローに流用・キャンバス生成）
let _soft: THREE.Texture | null = null;
function softTexture(): THREE.Texture {
  if (_soft) return _soft;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  _soft = new THREE.CanvasTexture(c);
  return _soft;
}

// 散光星雲（色とりどりの発光雲）
function NebulaClouds() {
  const tex = useMemo(() => softTexture(), []);
  const data = useMemo(() => {
    const cols = ["#ff6abf", "#5fd0ff", "#a06bff", "#ff9a5a", "#4d7bff", "#ff5f8a", "#3fd0a8"];
    const n = MOBILE ? 9 : 18;
    return Array.from({ length: n }, () => ({
      pos: [(-0.5 + Math.random()) * 70, (-0.5 + Math.random()) * 34, -8 - Math.random() * 50] as [number, number, number],
      sx: 10 + Math.random() * 22,
      sy: 6 + Math.random() * 16,
      color: cols[(Math.random() * cols.length) | 0],
      op: 0.05 + Math.random() * 0.13,
    }));
  }, []);
  return (
    <>
      {data.map((c, i) => (
        <sprite key={i} position={c.pos} scale={[c.sx, c.sy, 1]}>
          <spriteMaterial map={tex} color={c.color} transparent opacity={c.op} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </sprite>
      ))}
    </>
  );
}

// 遠方の銀河（楕円のグロー＋輝く核）
function DistantGalaxies() {
  const tex = useMemo(() => softTexture(), []);
  const data = useMemo(() => {
    const cols = ["#ffd9a0", "#bcd0ff", "#ffb0d0", "#a0d8ff"];
    const n = MOBILE ? 4 : 7;
    return Array.from({ length: n }, () => ({
      pos: [(-0.5 + Math.random()) * 84, (-0.5 + Math.random()) * 42, -28 - Math.random() * 45] as [number, number, number],
      s: 1.6 + Math.random() * 2.8,
      flat: 0.28 + Math.random() * 0.3,
      rot: Math.random() * Math.PI,
      color: cols[(Math.random() * cols.length) | 0],
    }));
  }, []);
  return (
    <>
      {data.map((g, i) => (
        <group key={i} position={g.pos}>
          <sprite scale={[g.s * 2.6, g.s * 2.6 * g.flat, 1]}>
            <spriteMaterial map={tex} color={g.color} rotation={g.rot} transparent opacity={0.17} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
          </sprite>
          <sprite scale={[g.s * 0.6, g.s * 0.6, 1]}>
            <spriteMaterial map={tex} color="#ffffff" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
          </sprite>
        </group>
      ))}
    </>
  );
}

// 流れ星（周期的に夜空を流れるメテオ）
function ShootingStars() {
  const count = MOBILE ? 2 : 4;
  const refs = useRef<(THREE.Line | null)[]>([]);
  const meteors = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        next: Math.random() * 5,
        life: -1,
        start: new THREE.Vector3(),
        dir: new THREE.Vector3(),
      })),
    [count],
  );
  const T = 1.1;
  useFrame((_, d) => {
    for (let i = 0; i < count; i++) {
      const m = meteors[i];
      const line = refs.current[i];
      if (!line) continue;
      if (m.life < 0) {
        m.next -= d;
        line.visible = false;
        if (m.next <= 0) {
          m.start.set((-0.5 + Math.random()) * 50, 10 + Math.random() * 16, -8 - Math.random() * 34);
          m.dir.set(-1 - Math.random(), -0.8 - Math.random() * 0.6, -0.15).normalize();
          m.life = 0;
        }
        continue;
      }
      m.life += d;
      if (m.life > T) {
        m.life = -1;
        m.next = 2 + Math.random() * 6;
        line.visible = false;
        continue;
      }
      line.visible = true;
      const head = m.start.clone().addScaledVector(m.dir, m.life * 34);
      const tail = head.clone().addScaledVector(m.dir, -3.4);
      line.geometry.setFromPoints([tail, head]);
      (line.material as THREE.LineBasicMaterial).opacity = Math.sin((m.life / T) * Math.PI);
    }
  });
  return (
    <>
      {meteors.map((_, i) => (
        <line key={i} ref={(el) => { refs.current[i] = el as unknown as THREE.Line; }}>
          <bufferGeometry />
          <lineBasicMaterial color="#dce8ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </line>
      ))}
    </>
  );
}

// 彗星（核＋たなびく尾・ゆっくり漂う）
function Comet() {
  const tex = useMemo(() => softTexture(), []);
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (grp.current) {
      const t = clock.elapsedTime * 0.03;
      grp.current.position.set(8 + Math.sin(t) * 3, 6 + Math.cos(t * 0.8) * 2, -14 + Math.sin(t * 0.5) * 3);
    }
  });
  return (
    <group ref={grp} position={[8, 6, -14]}>
      <sprite scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={tex} color="#cfe6ff" transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <sprite position={[1.6, 0.7, 0]} scale={[5.5, 1.1, 1]}>
        <spriteMaterial map={tex} color="#9fd0ff" rotation={-0.4} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    </group>
  );
}

// 天の川（銀河面に集中する濃い星の帯）
function MilkyWay() {
  const geo = useMemo(() => {
    const count = MOBILE ? 2600 : 6000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c1 = new THREE.Color("#fff0d8"), c2 = new THREE.Color("#bcd0ff"), c3 = new THREE.Color("#ffd9b0");
    const cs = [c1, c2, c3];
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const ph = Math.random() * Math.PI * 2;
      const r = 48 + Math.random() * 26;
      const x = Math.cos(ph) * r, z = Math.sin(ph) * r;
      const y = (Math.random() - 0.5) * 7 * Math.pow(Math.random(), 2); // 帯状に薄く
      pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
      const c = cs[(Math.random() * cs.length) | 0].clone().multiplyScalar(0.35 + Math.random() * 0.5);
      col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group rotation={[0.5, 0.3, 0.62]}>
      <points geometry={geo}>
        <pointsMaterial size={0.11} sizeAttenuation vertexColors transparent opacity={0.82} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </points>
    </group>
  );
}

// 星座線（遠方に淡い星座のパターン）
const CONSTELLATIONS: { pos: [number, number, number]; pts: [number, number][] }[] = [
  { pos: [-32, 15, -30], pts: [[0, 0], [2.2, 1.2], [4.4, 0.6], [5.6, 2.4], [3.4, 3.2]] }, // W
  { pos: [30, -8, -34], pts: [[0, 0], [1.6, 1.4], [3.4, 1.8], [5, 0.8], [3.6, -1.2], [1.6, -1]] }, // 多角形
  { pos: [-24, -18, -38], pts: [[0, 0], [2.4, 2], [4.2, 2.8], [6, 4.4]] }, // 線
  { pos: [22, 16, -32], pts: [[0, 0], [1.2, 2.2], [2.8, 1.6], [2.0, -0.6], [0.4, -1.4]] }, // 小星座
];
function ConstellationLines() {
  const items = useMemo(
    () =>
      CONSTELLATIONS.map((c) => {
        const points = c.pts.map((p) => new THREE.Vector3(c.pos[0] + p[0] * 2.2, c.pos[1] + p[1] * 2.2, c.pos[2]));
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: "#9db4ff", transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const ptsMat = new THREE.PointsMaterial({ size: 0.55, sizeAttenuation: true, color: "#dce8ff", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        return { line: new THREE.Line(geo, lineMat), pts: new THREE.Points(geo, ptsMat), geo, lineMat, ptsMat };
      }),
    [],
  );
  useEffect(
    () => () => items.forEach((o) => { o.geo.dispose(); o.lineMat.dispose(); o.ptsMat.dispose(); }),
    [items],
  );
  return (
    <>
      {items.map((o, i) => (
        <group key={i}>
          <primitive object={o.line} />
          <primitive object={o.pts} />
        </group>
      ))}
    </>
  );
}

// カイパーベルト（海王星以遠の氷天体の帯）
function KuiperBelt() {
  return (
    <RockBelt
      count={MOBILE ? 50 : 95}
      pos={[-20, 4, -38]}
      rot={[0.3, 0, 0.05]}
      radMin={26}
      radMax={40}
      yJit={2.5}
      sMin={0.05}
      sMax={0.17}
      spin={0.008}
      tints={[[0.6, 0.66, 0.75], [0.52, 0.58, 0.68], [0.66, 0.7, 0.78], [0.46, 0.5, 0.6]]}
    />
  );
}

// HDR環境光（手続き的・反射のリアル化）。デスクトップのみ
function SpaceEnv() {
  if (MOBILE) return null;
  return (
    <Environment resolution={64} frames={1}>
      <Lightformer intensity={2.2} color="#fff4e0" position={[10, 5, 8]} scale={[7, 7, 1]} />
      <Lightformer intensity={0.35} color="#4d6bff" position={[-9, 0, -6]} scale={[12, 12, 1]} />
      <Lightformer intensity={0.18} color="#ff7ac0" position={[0, -8, -10]} scale={[10, 10, 1]} />
    </Environment>
  );
}

// ── galaxy（局所空間で差動回転→配置） ──
const galaxyVert = /* glsl */ `
uniform float uTime; uniform float uSize;
attribute float aScale; attribute vec3 aColor; varying vec3 vColor;
void main(){
  float ang=atan(position.x, position.z);
  float dist=length(position.xz);
  ang += (1.0/(dist+0.6)) * uTime * 0.26;
  vec3 sp=vec3(cos(ang)*dist, position.y, sin(ang)*dist);
  vec4 mp=modelMatrix*vec4(sp,1.0);
  vec4 vp=viewMatrix*mp;
  gl_Position=projectionMatrix*vp;
  gl_PointSize=min(uSize*aScale*(1.0/-vp.z), 14.0);
  vColor=aColor;
}`;
const galaxyFrag = /* glsl */ `
varying vec3 vColor;
void main(){ float dd=distance(gl_PointCoord,vec2(0.5)); float s=1.0-smoothstep(0.0,0.5,dd); s=pow(s,2.2); gl_FragColor=vec4(vColor*s,s); }`;
function Galaxy() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const tex = useMemo(() => softTexture(), []);
  const geometry = useMemo(() => {
    // 天の川級の規模：中心バルジ＋多腕の円盤＋HII領域
    const count = MOBILE ? 22000 : 60000;
    const radius = 11, branches = 5, spin = 1.18, randomness = 0.42, power = 2.9;
    const cCore = new THREE.Color("#fff3d2"), cInner = new THREE.Color("#ffb060"),
      cMid = new THREE.Color("#d24dff"), cOuter = new THREE.Color("#4d7bff"), cPink = new THREE.Color("#ff5fa8");
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sc = new Float32Array(count);
    const rnd = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1);
    const bulge = Math.floor(count * 0.2);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      if (i < bulge) {
        // 中心バルジ（球状・密・明るい暖色）
        const r = Math.pow(Math.random(), 2.4) * radius * 0.24;
        const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
        pos[i3] = r * Math.sin(th) * Math.cos(ph);
        pos[i3 + 1] = r * Math.cos(th) * 0.65;
        pos[i3 + 2] = r * Math.sin(th) * Math.sin(ph);
        c.copy(cCore).lerp(cInner, Math.random() * 0.55);
        sc[i] = Math.random() * 1.1 + 0.55;
      } else {
        // 渦巻きの腕（薄い円盤）
        const r = Math.pow(Math.random(), power) * radius;
        const br = ((i % branches) / branches) * Math.PI * 2, sa = r * spin;
        pos[i3] = Math.cos(br + sa) * r + rnd() * randomness * r;
        pos[i3 + 1] = rnd() * randomness * r * 0.32;
        pos[i3 + 2] = Math.sin(br + sa) * r + rnd() * randomness * r;
        const t = r / radius;
        c.copy(cInner).lerp(cMid, Math.min(t * 1.8, 1)).lerp(cOuter, t);
        if (Math.random() < 0.05) c.copy(cPink); // 散在するHII領域
        sc[i] = Math.random() * 0.7 + 0.22;
      }
      col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aScale", new THREE.BufferAttribute(sc, 1));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 42 } }), []);
  useFrame((_, d) => { if (mat.current) mat.current.uniforms.uTime.value += d; });
  return (
    <group position={[GX, GY, GZ]} rotation={[0.52, 0.4, 0.08]} scale={1.6}>
      <points geometry={geometry}>
        <shaderMaterial ref={mat} vertexShader={galaxyVert} fragmentShader={galaxyFrag} uniforms={uniforms} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
      </points>
      {/* 銀河中心の輝き（バルジのグロー） */}
      <sprite scale={[8, 8, 1]}>
        <spriteMaterial map={tex} color="#ffe6b0" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <sprite scale={[24, 16, 1]}>
        <spriteMaterial map={tex} color="#6a5aff" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    </group>
  );
}

// ── camera stops（各セクション＝各惑星）。DOMセクション位置で補間（セクション数に非依存） ──
const STOPS: { sel: string; p: [number, number, number]; l: [number, number, number] }[] = [
  { sel: "header.hero", p: [0, 0.2, 3.6], l: [2.15, -1.75, 0] }, // 地球
  { sel: "#services", p: [-1.6, 2.4, -1.0], l: [-3, 1.8, -5.5] }, // 月
  { sel: "#works", p: [-5.4, -1.6, -5.5], l: [-7.5, -2.6, -11.5] }, // 火星
  { sel: "#strengths", p: [-8.8, 5.4, -9.5], l: [-11.5, 4.2, -18.5] }, // 木星
  { sel: "#pricing", p: [-12.8, -0.6, -18], l: [-15.5, -2, -26] }, // 土星
  { sel: "#faq", p: [-16.4, 6.8, -25], l: [-19, 5.6, -33] }, // 海王星
  { sel: "#contact", p: [GX + 3, GY + 4.5, GZ + 15], l: [GX, GY, GZ] }, // 天の川級の銀河（接近・一粒一粒が巨大）
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Rig() {
  const centers = useRef<number[]>([]);
  const scrollY = useRef(0);
  useEffect(() => {
    const measure = () => {
      centers.current = STOPS.map((s) => {
        const el = document.querySelector(s.sel) as HTMLElement | null;
        if (!el) return Number.NaN;
        const r = el.getBoundingClientRect();
        return r.top + window.scrollY + r.height / 2;
      });
    };
    const onScroll = () => { scrollY.current = window.scrollY; };
    measure(); onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const tid = window.setTimeout(measure, 700);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.clearTimeout(tid);
    };
  }, []);
  const target = useMemo(() => new THREE.Vector3(...STOPS[0].p), []);
  const look = useMemo(() => new THREE.Vector3(...STOPS[0].l), []);
  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    const c = centers.current;
    const probe = scrollY.current + window.innerHeight / 2;
    let i = 0;
    if (c.length === STOPS.length) {
      while (i < STOPS.length - 2 && Number.isFinite(c[i + 1]) && probe > c[i + 1]) i++;
    }
    const c0 = c[i], c1 = c[i + 1];
    let f = Number.isFinite(c0) && Number.isFinite(c1) && c1 > c0 ? (probe - c0) / (c1 - c0) : 0;
    f = Math.min(Math.max(f, 0), 1);
    f = f * f * (3 - 2 * f);
    const w0 = STOPS[i], w1 = STOPS[i + 1] ?? STOPS[i];
    target.set(
      lerp(w0.p[0], w1.p[0], f) + Math.sin(t * 0.06) * 0.22,
      lerp(w0.p[1], w1.p[1], f) + Math.sin(t * 0.08) * 0.16,
      lerp(w0.p[2], w1.p[2], f),
    );
    look.set(lerp(w0.l[0], w1.l[0], f), lerp(w0.l[1], w1.l[1], f), lerp(w0.l[2], w1.l[2], f));
    const k = 1 - Math.exp(-5 * delta);
    camera.position.lerp(target, k);
    camera.lookAt(look);
  });
  return (
    <>
      <AdaptiveQuality />
      <SpaceEnv />
      <fog attach="fog" args={["#0a0c1a", 18, 62]} />
      <ambientLight intensity={0.045} />
      <directionalLight position={[24, 8, 16]} intensity={3.6} color="#fff4e6" />
      <directionalLight position={[-9, 1, -12]} intensity={0.4} color="#6f9cff" />
      <Nebula />
      <NebulaClouds />
      <DistantGalaxies />
      <MilkyWay />
      <ConstellationLines />
      <Stars />
      <Suspense fallback={null}>
        <Sun />
      </Suspense>
      <ShootingStars />
      <Comet />
      <Suspense fallback={null}>
        <AsteroidBelt />
        <KuiperBelt />
      </Suspense>
      <Galaxy />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Planets />
      <AmbientBodies />
      <Moons />
      {!MOBILE && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.62} luminanceSmoothing={0.25} intensity={0.7} mipmapBlur radius={0.6} />
          <Vignette eskil={false} offset={0.28} darkness={0.62} />
        </EffectComposer>
      )}
    </>
  );
}

export default function CosmicStage() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(true);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    setEnabled(!reduce && webgl);
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  if (!enabled) return null;
  return (
    <Canvas
      aria-hidden="true"
      tabIndex={-1}
      style={{ position: "fixed", inset: 0 }}
      dpr={MOBILE ? [1, 1] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.2, 3.6], fov: 50 }}
      gl={{ antialias: !MOBILE, alpha: false, stencil: false, powerPreference: "high-performance" }}
    >
      <Rig />
    </Canvas>
  );
}

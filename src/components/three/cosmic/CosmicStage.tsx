import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad, useTexture, PerformanceMonitor } from "@react-three/drei";
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
    for (const t of [day, normal, clud, lights]) t.anisotropy = 8;
  }, [day, normal, clud, lights]);
  const atmo = useMemo(() => ({ uColor: { value: new THREE.Color("#5fb8ff") } }), []);
  useFrame((_, d) => {
    if (earth.current) earth.current.rotation.y += d * 0.025;
    if (clouds.current) clouds.current.rotation.y += d * 0.034;
  });
  return (
    <group rotation={[0.33, 0, 0.1]} scale={2.0} position={[2.15, -1.75, 0]}>
      <mesh ref={earth}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={day} normalMap={normal} normalScale={new THREE.Vector2(0.8, 0.8)} emissiveMap={lights} emissive={new THREE.Color("#ffd9a0")} emissiveIntensity={0.5} roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh ref={clouds} scale={1.012}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={clud} alphaMap={clud} transparent opacity={0.85} depthWrite={false} roughness={1} />
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
    const g = new THREE.RingGeometry(1.35, 2.4, 128);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = (v.length() - 1.35) / (2.4 - 1.35);
      uv.setXY(i, r, 0.5);
    }
    return g;
  }, []);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2 + 0.18, 0, 0]}>
      <meshStandardMaterial map={tex} transparent side={THREE.DoubleSide} roughness={1} depthWrite={false} />
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
  rocky?: boolean;
  atmo?: string;
};
const PLANETS: PlanetDef[] = [
  { src: "/assets/planet/moon.webp", pos: [-3, 1.8, -5.5], scale: 0.5, rot: 0.02, tilt: 0.2, rocky: true },
  { src: "/assets/planet/mars.webp", pos: [-7.5, -2.6, -11.5], scale: 0.9, rot: 0.05, tilt: 0.35, rocky: true, atmo: "#ff7a4d" },
  { src: "/assets/planet/jupiter.webp", pos: [-11.5, 4.2, -18.5], scale: 2.3, rot: 0.07, tilt: 0.18, atmo: "#e8b87a" },
  { src: "/assets/planet/saturn.webp", pos: [-15.5, -2, -26], scale: 1.6, rot: 0.06, tilt: 0.42, ring: true, atmo: "#e6c77a" },
  { src: "/assets/planet/neptune.webp", pos: [-19, 5.6, -33], scale: 1.2, rot: 0.05, tilt: 0.25, atmo: "#5b8cff" },
];

function Planet({ src, pos, scale, rot, tilt, ring, rocky, atmo }: PlanetDef) {
  const ref = useRef<THREE.Mesh>(null);
  const map = useTexture(src);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
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
          bumpMap={rocky ? map : null}
          bumpScale={rocky ? 0.035 : 0}
          roughness={rocky ? 0.95 : 0.6}
          metalness={0}
        />
      </mesh>
      {ring && <SaturnRing />}
      {atmo && <AtmosphereRim color={atmo} />}
    </group>
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
  const dense = useMemo(() => make(MOBILE ? 2000 : 4200, 20, 70, 0.35), []);
  const bright = useMemo(() => make(MOBILE ? 120 : 280, 14, 50, 0.8), []);
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

// 小惑星帯（InstancedMesh・静的行列＋親グループを回転＝安価）
function AsteroidBelt() {
  const count = MOBILE ? 130 : 320;
  const grp = useRef<THREE.Group>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!inst.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2, rad = 6 + Math.random() * 8;
      dummy.position.set(Math.cos(ang) * rad, (Math.random() - 0.5) * 1.4, Math.sin(ang) * rad);
      dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      dummy.scale.setScalar(0.04 + Math.random() * 0.12);
      dummy.updateMatrix();
      inst.current.setMatrixAt(i, dummy.matrix);
    }
    inst.current.instanceMatrix.needsUpdate = true;
  }, [count]);
  useFrame((_, d) => { if (grp.current) grp.current.rotation.y += d * 0.03; });
  return (
    <group ref={grp} position={[-9.5, -1, -15]} rotation={[0.34, 0, 0.08]}>
      <instancedMesh ref={inst} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8a7d6b" roughness={1} metalness={0} flatShading />
      </instancedMesh>
    </group>
  );
}

// 遠方の太陽（光源の視覚化・グロー）
function Sun() {
  return (
    <group position={[24, 8, 16]}>
      <mesh>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshBasicMaterial color="#fff3d8" fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3, 20, 20]} />
        <meshBasicMaterial color="#ffd98a" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[6.5, 20, 20]} />
        <meshBasicMaterial color="#ffba52" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
    </group>
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
  gl_PointSize=min(uSize*aScale*(1.0/-vp.z), 9.0);
  vColor=aColor;
}`;
const galaxyFrag = /* glsl */ `
varying vec3 vColor;
void main(){ float dd=distance(gl_PointCoord,vec2(0.5)); float s=1.0-smoothstep(0.0,0.5,dd); s=pow(s,2.2); gl_FragColor=vec4(vColor*s,s); }`;
function Galaxy() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const count = MOBILE ? 9000 : 30000, radius = 6, branches = 4, spin = 1.0, randomness = 0.45, power = 2.6;
    const inside = new THREE.Color("#ffb066"), mid = new THREE.Color("#c84dff"), outside = new THREE.Color("#4d7bff");
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sc = new Float32Array(count);
    const rnd = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3, r = Math.pow(Math.random(), power) * radius;
      const br = ((i % branches) / branches) * Math.PI * 2, sa = r * spin;
      pos[i3] = Math.cos(br + sa) * r + rnd() * randomness * r;
      pos[i3 + 1] = rnd() * randomness * r * 0.5;
      pos[i3 + 2] = Math.sin(br + sa) * r + rnd() * randomness * r;
      const c = inside.clone(), t = r / radius;
      c.lerp(mid, Math.min(t * 1.7, 1)); c.lerp(outside, t);
      col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
      sc[i] = Math.random() * 0.9 + 0.3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aScale", new THREE.BufferAttribute(sc, 1));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 36 } }), []);
  useFrame((_, d) => { if (mat.current) mat.current.uniforms.uTime.value += d; });
  return (
    <points geometry={geometry} position={[GX, GY, GZ]} rotation={[0.52, 0.4, 0.08]} scale={1.5}>
      <shaderMaterial ref={mat} vertexShader={galaxyVert} fragmentShader={galaxyFrag} uniforms={uniforms} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
    </points>
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
  { sel: "#contact", p: [GX + 2.5, GY + 4, GZ + 12], l: [GX, GY, GZ] }, // 銀河
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
      <fog attach="fog" args={["#0a0c1a", 18, 62]} />
      <ambientLight intensity={0.11} />
      <directionalLight position={[24, 8, 16]} intensity={3.0} color="#fff4e6" />
      <directionalLight position={[-8, 2, -10]} intensity={0.5} color="#7da6ff" />
      <Nebula />
      <Stars />
      <Sun />
      <AsteroidBelt />
      <Galaxy />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Planets />
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
      style={{ position: "fixed", inset: 0 }}
      dpr={MOBILE ? [1, 1] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.2, 3.6], fov: 50 }}
      gl={{ antialias: !MOBILE, alpha: false, powerPreference: "high-performance" }}
    >
      <Rig />
    </Canvas>
  );
}

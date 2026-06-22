import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad, useTexture, useGLTF, PerformanceMonitor, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { LITE } from "./tier";

/* ── 永続コズミック背景：星雲 + 星 + フォトリアル惑星群 + 粒子銀河。
   スクロールで各セクションごとに別の実在惑星へ遷移する「旅」。
   地球(hero)→月→火星→木星→土星(環)→海王星→銀河(contact)。
   軽量化: 全テクスチャWebP(計~0.6MB)、モバイルは粒子/星雲/dpr削減、非表示時は描画停止。 ── */

const GX = 0, GY = 16, GZ = -110; // 銀河の位置（太陽系の外・旅の終点・遠方）

// 軽量ティア（狭幅 or 低コア or 非力/ソフトGPU）。判定は ./tier に集約。
const MOBILE = LITE;

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

// ── 太陽系（heliocentric）。太陽を中心に、軌道半径順に惑星を黄道面(XZ)で公転させる。
//    位置は「初期角 + 経過時間×公転速度」で決定論的に算出するので、カメラ側も同じ式で
//    各惑星の現在位置を読み、公転する惑星を追従フレーミングできる。
//    軌道半径Rは可視化のため圧縮している(実AU比 Neptune/Mercury≒77倍は描画不能)が、
//    公転角速度 orbit はケプラーの第3法則 T²∝R³ ⇔ ω∝R^(-3/2) に厳密に従わせる
//    （= orbit ≒ 1.0207·R^-1.5、地球R=10.5でω=0.030に正規化）。これで内惑星ほど速く
//    外惑星ほど遅い、物理的に正しい相対公転になる。検証: 全惑星で T²/R³ が一定。 ──
const SUN_POS = new THREE.Vector3(0, 0, 0);
type Body = {
  key: string; src: string; normalSrc?: string;
  R: number; ang0: number; orbit: number; incl: number; // 軌道半径 / 初期角 / 公転角速度(rad/s) / 軌道傾斜
  scale: number; rot: number; tilt: number;             // rot=自転(金星/天王星は逆行)
  ring?: boolean; faintRing?: boolean; rocky?: boolean; atmo?: string;
};
const BODIES: Body[] = [
  { key: "mercury", src: "/assets/planet/mercury.webp", normalSrc: "/assets/planet/mercury_n.webp", R: 5.0,  ang0: 0.6, orbit: 0.0913, incl: 0.10, scale: 0.30, rot: 0.004,  tilt: 0.03, rocky: true },
  { key: "venus",   src: "/assets/planet/venus.webp",   R: 7.5,  ang0: 2.3, orbit: 0.0497, incl: 0.06, scale: 0.50, rot: -0.002, tilt: 0.05, atmo: "#e8c87a" },
  { key: "earth",   src: "/assets/planet/earth_day.webp", normalSrc: "/assets/planet/earth_normal.webp", R: 10.5, ang0: 4.0, orbit: 0.030, incl: 0.0,  scale: 0.55, rot: 0.05, tilt: 0.33, rocky: true, atmo: "#5fb8ff" },
  { key: "mars",    src: "/assets/planet/mars.webp",    normalSrc: "/assets/planet/mars_n.webp", R: 14.5, ang0: 5.4, orbit: 0.0185, incl: 0.05, scale: 0.40, rot: 0.048,  tilt: 0.35, rocky: true, atmo: "#ff7a4d" },
  { key: "jupiter", src: "/assets/planet/jupiter.webp", R: 23,   ang0: 1.1, orbit: 0.00925, incl: 0.03, scale: 1.8,  rot: 0.10,   tilt: 0.05, atmo: "#e8b87a" },
  { key: "saturn",  src: "/assets/planet/saturn.webp",  R: 31,   ang0: 3.4, orbit: 0.00591, incl: 0.04, scale: 1.5,  rot: 0.09,   tilt: 0.46, ring: true, atmo: "#e6c77a" },
  { key: "uranus",  src: "/assets/planet/uranus.webp",  R: 39,   ang0: 5.9, orbit: 0.00419, incl: 0.08, scale: 1.05, rot: -0.05,  tilt: 1.5,  faintRing: true, atmo: "#9fe8e0" },
  { key: "neptune", src: "/assets/planet/neptune.webp", R: 47,   ang0: 0.3, orbit: 0.00317, incl: 0.05, scale: 1.0,  rot: 0.06,   tilt: 0.30, atmo: "#5b8cff" },
];
const BODY: Record<string, Body> = Object.fromEntries(BODIES.map((b) => [b.key, b]));
// 惑星の現在位置（決定論的＝カメラも同式で追従可能）
function orbitPos(b: Body, t: number, out: THREE.Vector3) {
  const a = b.ang0 + t * b.orbit;
  return out.set(Math.cos(a) * b.R, Math.sin(a) * b.R * b.incl, Math.sin(a) * b.R);
}

function FaintRing() {
  const geo = useMemo(() => new THREE.RingGeometry(1.4, 1.95, 96), []);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2 + 0.05, 0, 0]}>
      <meshBasicMaterial color="#9fe8e0" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
    </mesh>
  );
}

// 1天体：太陽を公転（位置）＋自転（mesh回転）。図鑑(ViewerPlanet)と同等の品質：
// 高分割球＋法線マップ＋岩石は変位マップ(本物の起伏)＝のっぺり/カクつき解消。
function SolarBody({ b }: { b: Body }) {
  const grp = useRef<THREE.Group>(null);
  const ref = useRef<THREE.Mesh>(null);
  const [map, nrm] = useTexture([b.src, b.normalSrc ?? b.src]);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;
    if (b.normalSrc) nrm.anisotropy = 16;
  }, [map, nrm, b.normalSrc]);
  const pos = useMemo(() => new THREE.Vector3(), []);
  // 128分割で球の輪郭は完全に滑らか（視覚的に200分割と区別不可）＝品質を保ちつつ頂点数を節約。
  const seg = b.rocky ? (MOBILE ? 96 : 128) : (MOBILE ? 80 : 128);
  useFrame(({ clock }, d) => {
    if (grp.current) grp.current.position.copy(orbitPos(b, clock.elapsedTime, pos));
    if (ref.current) ref.current.rotation.y += d * b.rot;
  });
  return (
    <group ref={grp}>
      <group rotation={[b.tilt, 0, 0.04]} scale={b.scale}>
        <mesh ref={ref}>
          <sphereGeometry args={[1, seg, seg]} />
          <meshStandardMaterial
            map={map}
            normalMap={b.normalSrc ? nrm : null}
            normalScale={b.normalSrc ? new THREE.Vector2(1.5, 1.5) : undefined}
            bumpMap={b.rocky && !b.normalSrc ? map : null}
            bumpScale={b.rocky && !b.normalSrc ? 0.06 : 0}
            displacementMap={b.rocky ? map : undefined}
            displacementScale={b.rocky ? 0.05 : 0}
            displacementBias={b.rocky ? -0.025 : 0}
            roughness={b.rocky ? 0.96 : 0.6}
            metalness={0}
          />
        </mesh>
        {b.ring && <SaturnRing />}
        {b.faintRing && <FaintRing />}
        {b.atmo && <AtmosphereRim color={b.atmo} />}
      </group>
    </group>
  );
}
// 地球（背景・公転）：昼面＋法線＋雲＋夜景の灯＋大気＝図鑑(ViewerEarth)と同等のフル再現。
function SolarEarth() {
  const b = BODY.earth;
  const grp = useRef<THREE.Group>(null);
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
  const pos = useMemo(() => new THREE.Vector3(), []);
  const seg = MOBILE ? 96 : 128;
  useFrame(({ clock }, d) => {
    if (grp.current) grp.current.position.copy(orbitPos(b, clock.elapsedTime, pos));
    if (earth.current) earth.current.rotation.y += d * b.rot;
    if (clouds.current) clouds.current.rotation.y += d * (b.rot + 0.012);
  });
  return (
    <group ref={grp}>
      <group rotation={[b.tilt, 0, 0.04]} scale={b.scale}>
        <mesh ref={earth}>
          <sphereGeometry args={[1, seg, seg]} />
          <meshStandardMaterial map={day} normalMap={normal} normalScale={new THREE.Vector2(1, 1)} emissiveMap={lights} emissive={new THREE.Color("#ffd9a0")} emissiveIntensity={0.9} roughness={0.85} metalness={0.05} />
        </mesh>
        {/* 雲レイヤーは全画面オーバードロー＝フィルレート負荷。弱デバイス(MOBILE/LITE)では省略して保護 */}
        {!MOBILE && (
          <mesh ref={clouds} scale={1.012}>
            <sphereGeometry args={[1, 96, 96]} />
            <meshStandardMaterial map={clud} alphaMap={clud} transparent opacity={0.9} depthWrite={false} roughness={1} />
          </mesh>
        )}
        <AtmosphereRim color="#5fb8ff" />
      </group>
    </group>
  );
}
// 太陽系の全惑星（公転）。地球のみフル再現（雲/夜景）。
function SolarSystem() {
  return (
    <>
      {BODIES.map((b) => (
        <Suspense key={b.key} fallback={null}>
          {b.key === "earth" ? <SolarEarth /> : <SolarBody b={b} />}
        </Suspense>
      ))}
    </>
  );
}
// 軌道リング（黄道面の同心円）＝「太陽系の形」を可視化。淡い加算光。
function OrbitRings() {
  const rings = useMemo(
    () => BODIES.map((b) => new THREE.RingGeometry(b.R - 0.035, b.R + 0.035, 160)),
    [],
  );
  useEffect(() => () => rings.forEach((g) => g.dispose()), [rings]);
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {rings.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color="#6f93dd" transparent opacity={0.26} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

// （旧 AmbientBodies は廃止。全惑星は SolarSystem が公転描画する）

// 衛星：親惑星を周回（親も公転で動くので毎フレーム親の現在位置を基準にする）。
type MoonDef = { parent: string; radius: number; size: number; color: string; speed: number; phase: number; incline: number };
const MOONS: MoonDef[] = [
  { parent: "earth",   radius: 1.4, size: 0.10, color: "#ffffff", speed: 0.45, phase: 0.5, incline: 0.2 },  // 月（実テクスチャを素のまま）
  { parent: "jupiter", radius: 3.2, size: 0.12, color: "#e8d27a", speed: 0.5,  phase: 0,   incline: 0.2 },  // Io
  { parent: "jupiter", radius: 4.0, size: 0.11, color: "#e8e0d0", speed: 0.38, phase: 1.6, incline: 0.15 }, // Europa
  { parent: "jupiter", radius: 4.9, size: 0.16, color: "#b9a98a", speed: 0.3,  phase: 3.0, incline: 0.25 }, // Ganymede
  { parent: "jupiter", radius: 6.0, size: 0.15, color: "#8a8378", speed: 0.24, phase: 4.5, incline: 0.1 },  // Callisto
  { parent: "saturn",  radius: 3.6, size: 0.14, color: "#d8a85a", speed: 0.3,  phase: 2.0, incline: 0.3 },  // Titan
];
function Moon3D({ m }: { m: MoonDef }) {
  const ref = useRef<THREE.Mesh>(null);
  // 月の実テクスチャ＋法線＋変位を全衛星で共有（drei が URL でキャッシュ＝GPU上は1枚）。
  // 個別テクスチャの無いガリレオ衛星/タイタンは color で色付けし、クレーター質感を流用＝のっぺり/ギザギザ解消。
  const [map, nrm] = useTexture(["/assets/planet/moon.webp", "/assets/planet/moon_n.webp"]);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    nrm.anisotropy = 8;
  }, [map, nrm]);
  const pp = useMemo(() => new THREE.Vector3(), []);
  const seg = MOBILE ? 56 : 96; // 旧20分割のギザギザを解消
  useFrame(({ clock }, d) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    orbitPos(BODY[m.parent], t, pp);
    const a = t * m.speed + m.phase;
    ref.current.position.set(
      pp.x + Math.cos(a) * m.radius,
      pp.y + Math.sin(a) * m.radius * m.incline,
      pp.z + Math.sin(a) * m.radius,
    );
    ref.current.rotation.y += d * 0.06;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[m.size, seg, seg]} />
      <meshStandardMaterial
        map={map}
        color={m.color}
        normalMap={nrm}
        normalScale={new THREE.Vector2(1.3, 1.3)}
        displacementMap={map}
        displacementScale={m.size * 0.05}
        displacementBias={-m.size * 0.025}
        roughness={1}
        metalness={0}
      />
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

// （旧 Planets[遅延ロード] は廃止。SolarSystem が全惑星を常時公転描画。画面外は視錐台カリングで非描画、
//   初露出時のアップロードストールは SceneWarmer のジオメトリ先食いで回避済み。）

// DPRは固定（下記Canvas）。連続的なsetDprはレンダーターゲット再確保→スクロール中のストール(カクつき)を
// 招くため避ける。PerformanceMonitorは「持続的に重い時に一段だけ下げる」用途に限定（弱GPU保護）。
function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr);
  const lowered = useRef(false);
  return (
    <PerformanceMonitor
      onDecline={() => {
        if (lowered.current) return;
        lowered.current = true;
        setDpr(MOBILE ? 0.8 : 1.0); // 一度だけ軽量化（以降は固定＝再確保ストールを出さない）
      }}
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
  const fine = useMemo(() => make(MOBILE ? 2400 : 5500, 28, 95, 0.16), []); // 細かい遠星（本物の星空の密度）
  const dense = useMemo(() => make(MOBILE ? 3000 : 7000, 20, 80, 0.3), []);
  const bright = useMemo(() => make(MOBILE ? 150 : 340, 14, 55, 0.82), []);
  useEffect(() => () => { fine.dispose(); dense.dispose(); bright.dispose(); }, [fine, dense, bright]);
  return (
    <>
      <points geometry={fine}>
        <pointsMaterial size={0.04} sizeAttenuation vertexColors transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </points>
      <points geometry={dense}>
        <pointsMaterial size={0.08} sizeAttenuation vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
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
      count={MOBILE ? 110 : 220}
      pos={[0, 0, 0]}
      rot={[0.06, 0, 0.04]}
      radMin={16.5}
      radMax={20}
      yJit={0.35}
      sMin={0.025}
      sMax={0.055}
      spin={0.02}
      tints={[[0.54, 0.49, 0.42], [0.46, 0.42, 0.38], [0.6, 0.52, 0.44], [0.4, 0.38, 0.36]]}
    />
  );
}

// ヒーロー小惑星（Blender彫刻・works→strengthsの通過経路で大きく映る詳細岩。3個=数draw call・
//   常時マウントでシェーダを初期コンパイル＝スクロール時ヒッチ無し。画面外はフラスタムカリングで描画スキップ）。
const HERO_ROCKS_URL = "/assets/3d/hero-asteroids.glb";
// カメラ経路から外側/下方へ逃がし、フレーム端で大きく映るが埋め尽くさない配置にする。
const HERO_ROCKS: { key: string; pos: [number, number, number]; scale: number; tint: string; spin: number }[] = [
  { key: "HeroRockA", pos: [-2.6, -4.2, -7.5], scale: 1.35, tint: "#9b8f80", spin: 0.05 },
  { key: "HeroRockB", pos: [-5.6, -3.4, -12.2], scale: 1.7, tint: "#8f877c", spin: 0.035 },
  { key: "HeroRockC", pos: [-14.2, 0.6, -16.0], scale: 1.5, tint: "#a39584", spin: 0.06 },
];
function HeroAsteroids() {
  const gltf = useGLTF(HERO_ROCKS_URL);
  const [moonMap, moonNrm] = useTexture(["/assets/planet/moon.webp", "/assets/planet/moon_n.webp"]);
  useMemo(() => {
    moonMap.colorSpace = THREE.SRGBColorSpace;
    moonMap.anisotropy = 8;
    moonNrm.anisotropy = 8;
  }, [moonMap, moonNrm]);
  const geos = useMemo(() => {
    const out: Record<string, THREE.BufferGeometry> = {};
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) out[m.name] = m.geometry as THREE.BufferGeometry;
    });
    return out;
  }, [gltf]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, d) => {
    for (let i = 0; i < refs.current.length; i++) {
      const m = refs.current[i];
      if (m) {
        m.rotation.y += d * HERO_ROCKS[i].spin;
        m.rotation.x += d * 0.015;
      }
    }
  });
  return (
    <>
      {HERO_ROCKS.map((r, i) =>
        geos[r.key] ? (
          <mesh
            key={r.key}
            ref={(el) => { refs.current[i] = el; }}
            geometry={geos[r.key]}
            position={r.pos}
            scale={r.scale}
          >
            <meshStandardMaterial
              map={moonMap}
              normalMap={moonNrm}
              normalScale={new THREE.Vector2(2.3, 2.3)}
              color={r.tint}
              roughness={0.96}
              metalness={0.02}
            />
          </mesh>
        ) : null,
      )}
    </>
  );
}

// 太陽（実テクスチャの表面＋コロナのグロー・光源）
function Sun() {
  const tex = useTexture("/assets/planet/sun.webp");
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; }, [tex]);
  const core = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (core.current) core.current.rotation.y += d * 0.012; });
  return (
    <group position={[0, 0, 0]}>
      <mesh ref={core}>
        <sphereGeometry args={[2.4, 48, 48]} />
        <meshBasicMaterial map={tex} toneMapped={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.1, 24, 24]} />
        <meshBasicMaterial color="#ffd98a" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[5.2, 24, 24]} />
        <meshBasicMaterial color="#ffb84d" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[12, 20, 20]} />
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
  _soft.generateMipmaps = false; // スプライトは近似サイズ運用＝mipmap不要（軽量化・見た目不変）
  _soft.minFilter = THREE.LinearFilter;
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

// 彗星（Blender製の氷岩核＋コマ＋たなびく尾・ゆっくり漂う）
const COMET_URL = "/assets/3d/comet-nucleus.glb";
function CometNucleusMesh() {
  const gltf = useGLTF(COMET_URL);
  const geo = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !g) g = m.geometry as THREE.BufferGeometry;
    });
    return g;
  }, [gltf]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (ref.current) {
      ref.current.rotation.y += d * 0.16;
      ref.current.rotation.x += d * 0.05;
    }
  });
  if (!geo) return null;
  return (
    <mesh ref={ref} geometry={geo} scale={0.42}>
      <meshStandardMaterial
        color="#b2c2d8"
        roughness={0.85}
        metalness={0}
        emissive={new THREE.Color("#3a5f8f")}
        emissiveIntensity={0.28}
      />
    </mesh>
  );
}
function Comet() {
  const tex = useMemo(() => softTexture(), []);
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!grp.current) return;
    const a = clock.elapsedTime * 0.05 + 1.0; // 太陽を公転（傾いた楕円軌道）
    grp.current.position.set(Math.cos(a) * 38, Math.sin(a) * 13, Math.sin(a) * 20);
  });
  return (
    <group ref={grp} position={[20, 11, 0]}>
      <Suspense fallback={null}>
        <CometNucleusMesh />
      </Suspense>
      <sprite scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={tex} color="#cfe6ff" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <sprite position={[1.6, 0.7, 0]} scale={[5.5, 1.1, 1]}>
        <spriteMaterial map={tex} color="#9fd0ff" rotation={-0.4} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    </group>
  );
}

// 天の川（銀河面に集中する濃い星の帯）
// 天の川：銀河中心へ密度バイアスした星の帯＋流れる拡散光（本物のミルキーな帯）
function MilkyWay() {
  const tex = useMemo(() => softTexture(), []);
  const center = Math.PI * 0.3; // 銀河中心の方向
  const geo = useMemo(() => {
    const count = MOBILE ? 3400 : 8000;
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const cs = [new THREE.Color("#fff0d8"), new THREE.Color("#bcd0ff"), new THREE.Color("#ffd9b0"), new THREE.Color("#ffe8c8")];
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const ph = Math.random() < 0.45 ? center + (Math.random() - 0.5) * 2.0 : Math.random() * Math.PI * 2;
      const r = 48 + Math.random() * 28;
      pos[i3] = Math.cos(ph) * r;
      pos[i3 + 1] = (Math.random() - 0.5) * 8 * Math.pow(Math.random(), 2);
      pos[i3 + 2] = Math.sin(ph) * r;
      const dC = Math.abs(((ph - center + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / Math.PI; // 0(中心)..1
      const b = (0.3 + (1 - dC) * 0.55) * (0.5 + Math.random() * 0.7);
      const c = cs[(Math.random() * cs.length) | 0].clone().multiplyScalar(b);
      col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const glows = useMemo(() => {
    const n = MOBILE ? 3 : 5; // 加算オーバードロー抑制（フィルレート軽量化）
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const near = 1 - Math.abs(((a - center + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / Math.PI;
      return {
        pos: [Math.cos(a) * 56, Math.sin(a * 2) * 1.5, Math.sin(a) * 56] as [number, number, number],
        rot: a + Math.PI / 2,
        w: 18 + near * 16,
        o: 0.04 + near * 0.07,
        c: near > 0.6 ? "#5b4a72" : "#383650",
      };
    });
  }, [center]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group rotation={[0.5, 0.3, 0.62]}>
      <points geometry={geo}>
        <pointsMaterial size={0.085} sizeAttenuation vertexColors transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </points>
      {glows.map((g, i) => (
        <sprite key={i} position={g.pos} scale={[g.w, 5, 1]}>
          <spriteMaterial map={tex} color={g.c} rotation={g.rot} transparent opacity={g.o} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </sprite>
      ))}
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
      count={MOBILE ? 70 : 130}
      pos={[0, 0, 0]}
      rot={[0.05, 0, 0.03]}
      radMin={53}
      radMax={66}
      yJit={3}
      sMin={0.04}
      sMax={0.09}
      spin={0.006}
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
      {/* 円盤の拡散光（星の間のミルキーな銀河光・円盤面に水平配置） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 32]} />
        <meshBasicMaterial map={tex} color="#6a5a8c" transparent opacity={0.13} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} side={THREE.DoubleSide} />
      </mesh>
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

// ── spark emblem（旅の終点・銀河手前の到達点ビーコン）。Blender製の結晶外殻＋スパーク核GLB。
//    高コストな屈折は使わず「自発光核(Bloom内光)＋半透明標準外殻＋フレネルリム」で表現＝1オブジェクト・低コスト。 ──
const EMBLEM_URL = "/assets/3d/spark-emblem.glb";
function SparkEmblem() {
  const gltf = useGLTF(EMBLEM_URL);
  const grp = useRef<THREE.Group>(null);
  // 名前でジオメトリを分離（glTFの名前サニタイズに頑健）
  const { core, shell } = useMemo(() => {
    let core: THREE.BufferGeometry | null = null;
    let shell: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (/crystal/i.test(m.name)) shell = m.geometry as THREE.BufferGeometry;
      else core = m.geometry as THREE.BufferGeometry;
    });
    return { core, shell };
  }, [gltf]);
  const rim = useMemo(() => ({ uColor: { value: new THREE.Color("#5fb0ff") } }), []);
  useFrame((_, d) => {
    if (grp.current) grp.current.rotation.y += d * 0.22;
  });
  if (!core || !shell) return null;
  return (
    <group ref={grp} position={[-22.3, 10.5, -30.7]} scale={1.9} rotation={[0.16, 0, 0.05]}>
      {/* グロー核（常時発光の光の心臓・Bloomで内側から光る） */}
      <mesh renderOrder={0}>
        <sphereGeometry args={[0.17, 16, 16]} />
        <meshBasicMaterial color="#eaf4ff" toneMapped={false} />
      </mesh>
      {/* スパーク核（回転でファセットがきらめく・自発光） */}
      <mesh geometry={core} scale={1.15} renderOrder={1}>
        <meshStandardMaterial
          color="#dceaff"
          emissive={new THREE.Color("#5ab4ff")}
          emissiveIntensity={5.0}
          roughness={0.3}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {/* 結晶外殻（半透明・低roughnessで環境反射＝宝石質感） */}
      <mesh geometry={shell} renderOrder={2}>
        <meshStandardMaterial
          color="#2a5ae0"
          metalness={0}
          roughness={0.06}
          transparent
          opacity={0.34}
          envMapIntensity={1.3}
          depthWrite={false}
        />
      </mesh>
      {/* フレネルリム（エッジの発光） */}
      <mesh geometry={shell} scale={1.015} renderOrder={3}>
        <shaderMaterial
          vertexShader={atmoVert}
          fragmentShader={rimFrag}
          uniforms={rim}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── camera stops（各セクション＝各惑星）。DOMセクション位置で補間（セクション数に非依存） ──
// 各セクション＝太陽系を外へ旅する停止点（天体キー）。位置/注視点は天体の「現在の公転位置」から算出＝追従。
const STOPS: { sel: string; key: string }[] = [
  { sel: "header.hero", key: "earth" },
  { sel: "#services", key: "mars" },
  { sel: "#works", key: "jupiter" },
  { sel: "#strengths", key: "saturn" },
  { sel: "#pricing", key: "uranus" },
  { sel: "#faq", key: "neptune" },
  { sel: "#contact", key: "galaxy" },
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const _up = new THREE.Vector3(0, 1, 0);
const _radial = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _focus = new THREE.Vector3();
// 天体 key を t 時点で良く見るカメラ位置(outP)・注視点(outL)を算出。惑星は公転で動くのでこれで追従できる。
function bodyCamera(key: string, t: number, outP: THREE.Vector3, outL: THREE.Vector3) {
  if (key === "galaxy") {
    outL.set(GX, GY, GZ);
    outP.set(0, 18, -96); // 太陽系の外縁から銀河を望む
    return;
  }
  const b = BODY[key];
  orbitPos(b, t, outL); // 注視点＝惑星の現在位置
  _radial.copy(outL).normalize(); // 太陽→惑星方向
  _tan.crossVectors(_radial, _up).normalize(); // 黄道面の接線
  const dist = b.scale * 1.5 + 1.1; // 惑星を主役にしつつ近隣/太陽も少し入る
  outP
    .copy(outL)
    .addScaledVector(_radial, -dist * 0.32) // やや太陽側＝昼側(明るい面)を見る
    .addScaledVector(_tan, dist * 0.7) // 斜め＝3/4ビュー
    .addScaledVector(_up, dist * 0.5 + 0.6); // やや上から（薄い小惑星帯の上を滑空）
}

// スクロールが閾値を超えたら latch（重い銀河/カイパーを終盤接近時のみマウント＝中盤までGPU軽量）
function useScrollPast(frac: number) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (past) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > frac) setPast(true);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [past, frac]);
  return past;
}

// 初回ロード(LCP後)のアイドル中に発火＝重い遅延マウントを「スクロール前」に前倒しする合図。
// これで全テクスチャ/ジオメトリ/シェーダがスクロール到達前に温まり、スクロール中のストール(カクつき)が消える。
function useWarmup(delayMs = 700) {
  const [warmed, setWarmed] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idle = 0;
    const to = window.setTimeout(() => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setWarmed(true), { timeout: 1200 });
      else setWarmed(true);
    }, delayMs);
    return () => {
      window.clearTimeout(to);
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    };
  }, [delayMs]);
  return warmed;
}

// ウォーム時に全シェーダを非同期コンパイル＋全テクスチャをGPUへ事前アップロード（同期ストール回避）。
// 遅れてデコードされるテクスチャを取りこぼさないよう、ウォームパスを数回反復する。
function SceneWarmer({ warmed }: { warmed: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(false);
  useEffect(() => {
    if (!warmed || done.current) return;
    done.current = true;
    const anyGl = gl as unknown as {
      compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown>;
      compile: (s: THREE.Scene, c: THREE.Camera) => void;
      initTexture: (t: THREE.Texture) => void;
    };
    const uploaded = new WeakSet<THREE.Texture>();
    const warmPass = () => {
      try {
        if (anyGl.compileAsync) anyGl.compileAsync(scene, camera).catch(() => {});
        else anyGl.compile(scene, camera);
      } catch {}
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        const mats = Array.isArray(m) ? m : m ? [m] : [];
        for (const mat of mats) {
          for (const key of ["map", "normalMap", "bumpMap", "alphaMap", "emissiveMap", "displacementMap"] as const) {
            const tex = (mat as unknown as Record<string, THREE.Texture | null>)[key];
            if (tex && tex.image && !uploaded.has(tex)) {
              try { anyGl.initTexture(tex); uploaded.add(tex); } catch {}
            }
          }
        }
      });
    };
    // ジオメトリのGPUアップロードを強制：frustumCulledを一時OFFにし数フレーム描画→全バッファがアイドル中に
    // アップロードされる（compileAsyncはシェーダのみ＝カリングされた遠方オブジェクトのジオメトリは初露出時に
    // アップロードされスクロール中ストールになる。それをここで先食いする）。
    let culledBack: THREE.Object3D[] = [];
    const restoreCulling = () => {
      for (const o of culledBack) o.frustumCulled = true;
      culledBack = [];
    };
    const forceGeometryUpload = () => {
      scene.traverse((o) => {
        if (o.frustumCulled) { o.frustumCulled = false; culledBack.push(o); }
      });
      // frameloop="always"で毎フレーム描画されるので、数フレーム後にカリングを戻す
      let n = 0;
      const tick = () => {
        if (++n < 6) { raf = requestAnimationFrame(tick); return; }
        restoreCulling();
      };
      raf = requestAnimationFrame(tick);
    };

    // 最初は数フレーム待ち、その後 ~420ms 間隔で計7回（=遅延デコードのテクスチャも回収）、最後にジオメトリ強制アップロード
    let raf = 0;
    let timer = 0;
    let pass = 0;
    const schedule = () => {
      warmPass();
      if (++pass < 7) timer = window.setTimeout(schedule, 420);
      else timer = window.setTimeout(forceGeometryUpload, 200);
    };
    let f = 0;
    const startAfterFrames = () => {
      if (++f < 6) { raf = requestAnimationFrame(startAfterFrames); return; }
      schedule();
    };
    raf = requestAnimationFrame(startAfterFrames);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); restoreCulling(); };
  }, [warmed, gl, scene, camera]);
  return null;
}

function Rig() {
  const centers = useRef<number[]>([]);
  const scrollY = useRef(0);
  const smoothScroll = useRef(0); // スクロール入力の平滑化値（離散ホイールを滑らかに）
  const warmed = useWarmup(); // LCP後アイドルで全要素を先行ウォーム＝スクロール中のストール(カクつき)を消す
  const showGalaxy = useScrollPast(0.32) || warmed; // 銀河は終盤接近時 or アイドルウォーム時にマウント
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
    smoothScroll.current = window.scrollY; // 初期化（ロード時に0からアニメしない）
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const tid = window.setTimeout(measure, 700);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.clearTimeout(tid);
    };
  }, []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useRef(new THREE.Vector3());
  const p0 = useMemo(() => new THREE.Vector3(), []);
  const l0 = useMemo(() => new THREE.Vector3(), []);
  const p1 = useMemo(() => new THREE.Vector3(), []);
  const l1 = useMemo(() => new THREE.Vector3(), []);
  const inited = useRef(false);
  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    const c = centers.current;
    const d = Math.min(delta, 0.05); // 大きなフレーム飛びでも破綻しないようクランプ
    // スクロール入力をフレームレート非依存で平滑化（離散的なホイールジャンプも滑らかに）
    smoothScroll.current += (scrollY.current - smoothScroll.current) * (1 - Math.exp(-7.5 * d));
    const probe = smoothScroll.current + window.innerHeight / 2;
    let i = 0;
    if (c.length === STOPS.length) {
      while (i < STOPS.length - 2 && Number.isFinite(c[i + 1]) && probe > c[i + 1]) i++;
    }
    const c0 = c[i], c1 = c[i + 1];
    let f = Number.isFinite(c0) && Number.isFinite(c1) && c1 > c0 ? (probe - c0) / (c1 - c0) : 0;
    f = Math.min(Math.max(f, 0), 1);
    f = f * f * (3 - 2 * f); // smoothstep（区間内をなめらかに）
    // 2つの停止天体の「現在の公転位置」からカメラ枠を算出し補間＝公転する惑星を追従フレーミング
    bodyCamera(STOPS[i].key, t, p0, l0);
    bodyCamera((STOPS[i + 1] ?? STOPS[i]).key, t, p1, l1);
    target.set(
      lerp(p0.x, p1.x, f) + Math.sin(t * 0.06) * 0.22,
      lerp(p0.y, p1.y, f) + Math.sin(t * 0.08) * 0.16,
      lerp(p0.z, p1.z, f),
    );
    look.set(lerp(l0.x, l1.x, f), lerp(l0.y, l1.y, f), lerp(l0.z, l1.z, f));
    // ── 惑星間の「引き→寄り」演出 ──
    // セクション間(f:0→1)の中盤でカメラを黄道面の外・上へ大きく退避させ、太陽系全体を俯瞰してから
    // 次の惑星へ再接近する。pull=sin(πf) は f=0,1(停止点)で0・f=0.5(中間)で最大＝停止時は通常フレーミングに一致。
    const aKey = STOPS[i].key, bKey = (STOPS[i + 1] ?? STOPS[i]).key;
    if (aKey !== "galaxy" && bKey !== "galaxy") {
      // 銀河への最終遷移は元から大きく引くので追加の引きはしない
      const segR = Math.max(BODY[aKey].R, BODY[bKey].R);
      const pull = Math.sin(Math.PI * f);
      _radial.set(target.x, 0, target.z); // 太陽(原点)→カメラの放射方向（黄道面内）
      if (_radial.lengthSq() > 1e-4) _radial.normalize();
      target.addScaledVector(_radial, pull * segR * 0.7); // 外側へ後退（系の外から見る）
      target.y += pull * (segR * 0.5 + 5); // 上昇（黄道面を見下ろす広い画）
      // 注視点：太陽を中心に保ちつつ、対象天体(l1=次の惑星)へ f に応じて徐々にフォーカス。
      //   focusPoint = 太陽→対象を (0.18→0.85) で内分＝序盤は太陽中心の俯瞰、終盤は対象へ寄る。
      //   これで海王星/冥王星など遠い対象が「一瞬で過ぎる」のを防ぎ、ずっと画面内で徐々に主役化する。
      _focus.copy(SUN_POS).lerp(l1, 0.18 + 0.67 * f);
      look.lerp(_focus, pull); // 引きの最中だけ俯瞰中心へ寄せる（停止点 pull=0 では通常フレーミング）
    }
    // 初回はスナップ（ロード時に原点からスウープしない）
    if (!inited.current) {
      inited.current = true;
      camera.position.copy(target);
      smoothLook.current.copy(look);
      camera.lookAt(smoothLook.current);
      return;
    }
    // 位置・注視点とも追従lerp（スクロール平滑化と二段で滑らかさ＋僅かな遅延＝快適）
    const k = 1 - Math.exp(-9 * d);
    camera.position.lerp(target, k);
    smoothLook.current.lerp(look, k);
    camera.lookAt(smoothLook.current);
  });
  return (
    <>
      <AdaptiveQuality />
      <SceneWarmer warmed={warmed} />
      <SpaceEnv />
      <fog attach="fog" args={["#070912", 130, 460]} />
      <ambientLight intensity={0.08} />
      {/* 太陽（原点）からの点光源。decay=0で距離減衰なし＝外惑星も照らす。各惑星は太陽方向に昼/夜の境界ができる */}
      <pointLight position={[0, 0, 0]} intensity={2.6} color="#fff4e6" decay={0} />
      <directionalLight position={[0, 6, 2]} intensity={0.18} color="#6f9cff" />
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
        {showGalaxy && <KuiperBelt />}
      </Suspense>
      {showGalaxy && <Galaxy />}
      <OrbitRings />
      <SolarSystem />
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

// テクスチャ404やWebGLロストでCanvasが落ちても、CSSのcosmic-bgへ安全に退避
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export default function CosmicStage() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(true);
  useEffect(() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    // WebGLがあれば常に背景3Dを表示・アニメーションさせる。OSの「モーション軽減/アニメ効果オフ」
    // でも装飾的な宇宙背景は止めない（＝惑星図鑑と同じ挙動。以前は reduced-motion で
    // 非表示や静止にしていたため「映らない」「一瞬で消える」「すぐ固まる」と報告された）。
    // DOMコンテンツの入場アニメ側は別途 CSS で prefers-reduced-motion を尊重している。
    setEnabled(webgl);
    // タブ非表示中＋惑星図鑑オープン中は背景3Dを停止（二重描画による高負荷を回避）
    let viewerOpen = false;
    const update = () => setActive(!document.hidden && !viewerOpen);
    const onVis = () => update();
    const onViewer = (e: Event) => { viewerOpen = !!(e as CustomEvent).detail?.open; update(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("cosmic:viewer", onViewer);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("cosmic:viewer", onViewer);
    };
  }, []);
  if (!enabled) return null;
  return (
    <CanvasErrorBoundary>
      <Canvas
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "fixed", inset: 0 }}
        dpr={MOBILE ? 1 : 1.5}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0.2, 3.6], fov: 50 }}
        gl={{ antialias: !MOBILE, alpha: false, stencil: false, powerPreference: "high-performance" }}
      >
        <Rig />
      </Canvas>
    </CanvasErrorBoundary>
  );
}

// 接近時のポップイン防止＝GLBを先読み（CosmicStage自体が遅延ロードのためLCP後に発火）
// 3Dが実際に描画される時だけ先読みする。WebGL非対応では CosmicStage は何も描画しないため、
// ここで6MB超のテクスチャ/GLBを取得すると LCP を無駄に悪化させる（＝先読みは3D有効時のみ）。
// reduced-motion でも背景3Dは描画するので、ここでも reduced-motion を除外しない。
const CAN_RENDER_3D =
  typeof window !== "undefined" &&
  (() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  })();

if (CAN_RENDER_3D) {
  // GLB（接近時のポップイン防止。CosmicStage自体が遅延ロードのためLCP後に発火）
  useGLTF.preload(COMET_URL);
  // 全惑星テクスチャ（アイドルウォームで確実にGPUへ載せ、スクロール接近時のアップロード由来のカクつきを消す）
  for (const u of [
    "/assets/planet/earth_day.webp", "/assets/planet/earth_normal.webp",
    "/assets/planet/earth_clouds.webp", "/assets/planet/earth_lights.webp",
    "/assets/planet/moon.webp", "/assets/planet/moon_n.webp",
    "/assets/planet/mars.webp", "/assets/planet/mars_n.webp",
    "/assets/planet/jupiter.webp", "/assets/planet/saturn.webp", "/assets/planet/saturn_ring.webp",
    "/assets/planet/neptune.webp", "/assets/planet/mercury.webp", "/assets/planet/mercury_n.webp",
    "/assets/planet/venus.webp", "/assets/planet/uranus.webp", "/assets/planet/sun.webp",
  ]) {
    useTexture.preload(u);
  }
}

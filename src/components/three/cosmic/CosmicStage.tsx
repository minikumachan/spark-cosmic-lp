import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad, useTexture } from "@react-three/drei";
import * as THREE from "three";

/* ── 永続コズミック背景：星雲(1パス) + 星 + フォトリアル地球 + 粒子銀河。
   ページのスクロール量でカメラがウェイポイントを補間し、
   地球 → 深宇宙 → 粒子銀河 へと「旅」する。装飾(aria-hidden)。 ── */

const GX = -13,
  GY = 4.5,
  GZ = -22;

// ── nebula ──
const nebulaVert = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const nebulaFrag = /* glsl */ `
precision highp float;
uniform float uTime; uniform vec2 uRes;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p);
  float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<6;i++){ v+=a*noise(p); p=m*p; a*=0.5; } return v; }
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
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } }), []);
  useFrame((state, d) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value += d;
    const dpr = gl.getPixelRatio();
    mat.current.uniforms.uRes.value.set(state.size.width * dpr, state.size.height * dpr);
  });
  return (
    <ScreenQuad renderOrder={-10}>
      <shaderMaterial ref={mat} vertexShader={nebulaVert} fragmentShader={nebulaFrag} uniforms={uniforms} depthTest={false} depthWrite={false} />
    </ScreenQuad>
  );
}

// ── earth ──
const atmoVert = /* glsl */ `varying vec3 vN; varying vec3 vView;
void main(){ vec4 vp=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vView=normalize(-vp.xyz); gl_Position=projectionMatrix*vp; }`;
const atmoFrag = /* glsl */ `varying vec3 vN; varying vec3 vView; uniform vec3 uColor;
void main(){ float f=pow(1.0-max(dot(vN,vView),0.0),2.8); gl_FragColor=vec4(uColor*f*0.45,f); }`;
function Earth() {
  const earth = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const [day, normal, clud, lights] = useTexture([
    "/assets/planet/earth_atmos_2048.jpg",
    "/assets/planet/earth_normal_2048.jpg",
    "/assets/planet/earth_clouds_1024.png",
    "/assets/planet/earth_lights_2048.png",
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
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial map={day} normalMap={normal} normalScale={new THREE.Vector2(0.85, 0.85)} emissiveMap={lights} emissive={new THREE.Color("#ffd9a0")} emissiveIntensity={0.5} roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh ref={clouds} scale={1.012}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={clud} alphaMap={clud} transparent opacity={0.85} depthWrite={false} roughness={1} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={atmo} side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── galaxy（局所空間で差動回転 → modelMatrix で配置） ──
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
  gl_PointSize=uSize*aScale*(1.0/-vp.z);
  vColor=aColor;
}`;
const galaxyFrag = /* glsl */ `
varying vec3 vColor;
void main(){ float dd=distance(gl_PointCoord,vec2(0.5)); float s=1.0-smoothstep(0.0,0.5,dd); s=pow(s,2.2); gl_FragColor=vec4(vColor*s,s); }`;
function Galaxy() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const count = 30000, radius = 6, branches = 4, spin = 1.0, randomness = 0.45, power = 2.6;
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
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 36 } }), []);
  useFrame((_, d) => { if (mat.current) mat.current.uniforms.uTime.value += d; });
  return (
    <points geometry={geometry} position={[GX, GY, GZ]} rotation={[0.52, 0.4, 0.08]} scale={1.5}>
      <shaderMaterial ref={mat} vertexShader={galaxyVert} fragmentShader={galaxyFrag} uniforms={uniforms} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
    </points>
  );
}

function Stars() {
  const geometry = useMemo(() => {
    const count = 2800, pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3, r = 18 + Math.random() * 48;
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
      pos[i3] = r * Math.sin(th) * Math.cos(ph);
      pos[i3 + 1] = r * Math.cos(th);
      pos[i3 + 2] = r * Math.sin(th) * Math.sin(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.1} sizeAttenuation color="#cfe0ff" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── camera waypoints（地球 → 深宇宙 → 銀河） ──
const WP: { a: number; p: [number, number, number]; l: [number, number, number] }[] = [
  { a: 0.0, p: [0, 0.2, 3.6], l: [2.15, -1.75, 0] },
  { a: 0.4, p: [-1, 3, 9], l: [GX * 0.4, GY * 0.45, GZ * 0.4] },
  { a: 0.7, p: [GX + 2, GY + 4.5, GZ + 11], l: [GX, GY, GZ] },
  { a: 1.0, p: [GX - 1, GY + 2, GZ + 7.5], l: [GX, GY, GZ] },
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Rig() {
  const scroll = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll.current = max > 0 ? window.scrollY / max : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const target = useMemo(() => new THREE.Vector3(0, 0.2, 3.6), []);
  const look = useMemo(() => new THREE.Vector3(2.15, -1.75, 0), []);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const s = Math.min(Math.max(scroll.current, 0), 1);
    let i = 0;
    while (i < WP.length - 2 && s > WP[i + 1].a) i++;
    const w0 = WP[i], w1 = WP[i + 1];
    let f = (s - w0.a) / (w1.a - w0.a);
    f = Math.min(Math.max(f, 0), 1);
    f = f * f * (3 - 2 * f);
    target.set(
      lerp(w0.p[0], w1.p[0], f) + Math.sin(t * 0.06) * 0.25,
      lerp(w0.p[1], w1.p[1], f) + Math.sin(t * 0.08) * 0.18,
      lerp(w0.p[2], w1.p[2], f),
    );
    look.set(lerp(w0.l[0], w1.l[0], f), lerp(w0.l[1], w1.l[1], f), lerp(w0.l[2], w1.l[2], f));
    camera.position.lerp(target, 0.055);
    camera.lookAt(look);
  });
  return (
    <>
      <ambientLight intensity={0.07} />
      <directionalLight position={[5, 2.5, 4]} intensity={2.6} color="#fff6e8" />
      <Nebula />
      <Stars />
      <Galaxy />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
    </>
  );
}

export default function CosmicStage() {
  if (typeof window !== "undefined") {
    try {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const c = document.createElement("canvas");
      const webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
      if (reduce || !webgl) return null;
    } catch {
      return null;
    }
  }
  return (
    <Canvas
      style={{ position: "fixed", inset: 0 }}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.2, 3.6], fov: 50 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <Rig />
    </Canvas>
  );
}

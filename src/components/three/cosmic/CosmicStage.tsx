import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad, useTexture } from "@react-three/drei";
import * as THREE from "three";

/* ── 永続コズミック背景：星雲(1パス) + 星 + フォトリアル地球。
   ページのスクロール量でカメラを連動させ、地球が静かに後退/移動する。
   装飾レイヤー（aria-hidden）。WebGL/低モーション不可時は null（CSS フォールバック）。 ── */

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

function Stars() {
  const geometry = useMemo(() => {
    const count = 2800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 18 + Math.random() * 48;
      const th = Math.acos(2 * Math.random() - 1);
      const ph = Math.random() * Math.PI * 2;
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
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const s = scroll.current;
    const e = Math.pow(Math.min(s, 1), 0.7);
    // スクロールで地球から強く離れ、深宇宙を旅する。地球はヒーローの主役。
    const tx = Math.sin(t * 0.05) * 0.3;
    const ty = 0.2 + e * 3.6 + Math.sin(t * 0.08) * 0.15;
    const tz = 3.6 + e * 22.0;
    camera.position.x += (tx - camera.position.x) * 0.05;
    camera.position.y += (ty - camera.position.y) * 0.05;
    camera.position.z += (tz - camera.position.z) * 0.05;
    camera.lookAt(2.15, -1.75 + e * 5.0, 0);
  });
  return (
    <>
      <ambientLight intensity={0.07} />
      <directionalLight position={[5, 2.5, 4]} intensity={2.6} color="#fff6e8" />
      <Nebula />
      <Stars />
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

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

const atmoVert = /* glsl */ `
varying vec3 vN; varying vec3 vView;
void main(){
  vec4 vp = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-vp.xyz);
  gl_Position = projectionMatrix * vp;
}`;
const atmoFrag = /* glsl */ `
varying vec3 vN; varying vec3 vView; uniform vec3 uColor;
void main(){
  float f = pow(1.0 - max(dot(vN, vView), 0.0), 2.8);
  gl_FragColor = vec4(uColor * f * 0.45, f);
}`;

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
  const atmoUniforms = useMemo(() => ({ uColor: { value: new THREE.Color("#5fb8ff") } }), []);

  useFrame((_, d) => {
    if (earth.current) earth.current.rotation.y += d * 0.03;
    if (clouds.current) clouds.current.rotation.y += d * 0.041;
  });

  return (
    <group rotation={[0.33, 0, 0.12]} scale={1.32}>
      <mesh ref={earth}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial
          map={day}
          normalMap={normal}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          emissiveMap={lights}
          emissive={new THREE.Color("#ffd9a0")}
          emissiveIntensity={0.55}
          roughness={0.82}
          metalness={0.05}
        />
      </mesh>
      <mesh ref={clouds} scale={1.012}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial
          map={clud}
          alphaMap={clud}
          transparent
          opacity={0.85}
          depthWrite={false}
          roughness={1}
        />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          uniforms={atmoUniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Stars() {
  const geometry = useMemo(() => {
    const count = 2600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 16 + Math.random() * 44;
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
      <pointsMaterial
        size={0.09}
        sizeAttenuation
        color="#cfe0ff"
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Rig() {
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.08) * 0.5;
    camera.position.y = 0.25 + Math.sin(t * 0.11) * 0.12;
    camera.lookAt(0, 0, 0);
  });
  return (
    <>
      <ambientLight intensity={0.07} />
      <directionalLight position={[5, 2.5, 4]} intensity={2.6} color="#fff6e8" />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Stars />
    </>
  );
}

export default function CelestialScene() {
  if (typeof window !== "undefined") {
    try {
      const c = document.createElement("canvas");
      if (!(c.getContext("webgl2") || c.getContext("webgl"))) return null;
    } catch {
      return null;
    }
  }
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, 2]}
      camera={{ position: [0, 0.3, 3.7], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Rig />
    </Canvas>
  );
}

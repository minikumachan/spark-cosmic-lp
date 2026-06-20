import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "./shaders";

// Blender で作った bespoke トーラスノット（Draco不使用＝CSP 'self' のみで動く）。
// 既存の自作GLSL（墨基調＋電撃ブルーfresnel）を適用。ノイズ振幅は控えめにし造形を活かす。
function Knot() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { nodes } = useGLTF("/models/hero.glb", false);

  const geometry = useMemo(() => {
    const m = Object.values(nodes).find(
      (n): n is THREE.Mesh => (n as THREE.Mesh).isMesh === true,
    );
    return m?.geometry;
  }, [nodes]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.12 },
      // editorial: 墨基調 → 電撃ブルー → 明るいフレネルリム
      uColorA: { value: new THREE.Color("#16161c") },
      uColorB: { value: new THREE.Color("#0747e0") },
      uColorC: { value: new THREE.Color("#6db8ff") },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (mat.current) mat.current.uniforms.uTime.value += delta;
    if (mesh.current) mesh.current.rotation.y += delta * 0.22;
  });

  if (!geometry) return null;

  return (
    <mesh ref={mesh} geometry={geometry} scale={0.92} rotation={[0.5, 0, 0.18]}>
      <shaderMaterial
        ref={mat}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

useGLTF.preload("/models/hero.glb", false);

export default function HeroScene() {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3.4], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Float speed={1.1} rotationIntensity={0.5} floatIntensity={0.5}>
        <Knot />
      </Float>
    </Canvas>
  );
}

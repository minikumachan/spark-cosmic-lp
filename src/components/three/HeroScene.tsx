import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "./shaders";

function Blob() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.32 },
      uColorA: { value: new THREE.Color("#0757ff") },
      uColorB: { value: new THREE.Color("#854dff") },
      uColorC: { value: new THREE.Color("#4db8ff") },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (mat.current) mat.current.uniforms.uTime.value += delta;
    if (mesh.current) mesh.current.rotation.y += delta * 0.15;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.3, 24]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3.4], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6}>
        <Blob />
      </Float>
    </Canvas>
  );
}

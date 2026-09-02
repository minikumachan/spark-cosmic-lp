import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const galaxyVert = /* glsl */ `
uniform float uTime;
uniform float uSize;
attribute float aScale;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vec4 mp = modelMatrix * vec4(position, 1.0);
  float ang = atan(mp.x, mp.z);
  float dist = length(mp.xz);
  ang += (1.0 / (dist + 0.6)) * uTime * 0.28;     // 中心ほど速く回る差動回転
  mp.x = cos(ang) * dist;
  mp.z = sin(ang) * dist;
  vec4 vp = viewMatrix * mp;
  gl_Position = projectionMatrix * vp;
  gl_PointSize = uSize * aScale * (1.0 / -vp.z);
  vColor = aColor;
}`;

const galaxyFrag = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  float s = 1.0 - smoothstep(0.0, 0.5, d);
  s = pow(s, 2.2);
  gl_FragColor = vec4(vColor * s, s);
}`;

function Galaxy() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const count = 38000;
    const radius = 6,
      branches = 4,
      spin = 1.0,
      randomness = 0.45,
      power = 2.6;
    const inside = new THREE.Color("#ffb066");
    const mid = new THREE.Color("#c84dff");
    const outside = new THREE.Color("#4d7bff");
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const rnd = () => (Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1));
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = Math.pow(Math.random(), power) * radius;
      const branch = ((i % branches) / branches) * Math.PI * 2;
      const spinA = r * spin;
      positions[i3] = Math.cos(branch + spinA) * r + rnd() * randomness * r;
      positions[i3 + 1] = rnd() * randomness * r * 0.5;
      positions[i3 + 2] = Math.sin(branch + spinA) * r + rnd() * randomness * r;
      const c = inside.clone();
      const t = r / radius;
      c.lerp(mid, Math.min(t * 1.7, 1));
      c.lerp(outside, t);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
      scales[i] = Math.random() * 0.9 + 0.3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 32 } }), []);
  useFrame((_, d) => {
    if (mat.current) mat.current.uniforms.uTime.value += d;
  });
  return (
    <points geometry={geometry} rotation={[0, 0, 0]}>
      <shaderMaterial
        ref={mat}
        vertexShader={galaxyVert}
        fragmentShader={galaxyFrag}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
      />
    </points>
  );
}

function Starfield() {
  const geometry = useMemo(() => {
    const count = 2600;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const tint = [new THREE.Color("#ffffff"), new THREE.Color("#bcd0ff"), new THREE.Color("#ffe6c2")];
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 18 + Math.random() * 42;
      const th = Math.acos(2 * Math.random() - 1);
      const ph = Math.random() * Math.PI * 2;
      pos[i3] = r * Math.sin(th) * Math.cos(ph);
      pos[i3 + 1] = r * Math.cos(th);
      pos[i3 + 2] = r * Math.sin(th) * Math.sin(ph);
      const c = tint[(Math.random() * tint.length) | 0];
      const b = 0.5 + Math.random() * 0.5;
      col[i3] = c.r * b;
      col[i3 + 1] = c.g * b;
      col[i3 + 2] = c.b * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.12}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Rig() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    if (group.current) group.current.rotation.y = t * 0.04;
    camera.position.x = Math.sin(t * 0.1) * 2.6;
    camera.position.y = 4.4 + Math.sin(t * 0.14) * 0.4;
    camera.lookAt(0, 0, 0);
  });
  return (
    <group ref={group}>
      <Galaxy />
      <Starfield />
    </group>
  );
}

export default function GalaxyScene() {
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
      camera={{ position: [0, 4.4, 6.4], fov: 55 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Rig />
    </Canvas>
  );
}

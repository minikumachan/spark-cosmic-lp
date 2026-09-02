import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad } from "@react-three/drei";
import * as THREE from "three";

// フルスクリーン1パスで星雲＋星＋ドリフトを描く（ジオメトリ最小・ポストエフェクト無し＝GPU安価）。
const vert = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<6;i++){ v+=a*noise(p); p=m*p; a*=0.5; }
  return v;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float t = uTime*0.015;

  // 星雲（2層のfbmを重ねて色を作る）
  vec2 q = p*1.5 + vec2(t, -t*0.6);
  float n1 = fbm(q);
  float n2 = fbm(q*2.1 + n1*1.5 + vec2(-t*0.9, t*0.7));
  vec3 base = vec3(0.015, 0.02, 0.06);
  vec3 neb = mix(vec3(0.10,0.05,0.32), vec3(0.62,0.12,0.48), smoothstep(0.25,0.85,n1));
  neb = mix(neb, vec3(0.10,0.48,0.92), smoothstep(0.35,0.95,n2));
  vec3 col = base + neb * pow(n1, 2.2) * 1.05;
  col += vec3(0.18,0.32,0.7) * pow(n2, 3.0) * 0.5;   // 青いハイライト

  // 星（疎にして閾値で点在＋微twinkle）
  vec2 g = gl_FragCoord.xy;
  for(int L=0; L<2; L++){
    float sc = (L==0)? 1.4 : 2.6;
    vec2 cell = floor(g/sc);
    float h = hash(cell + float(L)*37.0);
    float star = step(0.996, h);
    float tw = 0.6 + 0.4*sin(uTime*2.5 + h*30.0);
    col += vec3(0.9,0.95,1.0) * star * tw * (L==0?1.0:0.6);
  }

  // ビネット
  col *= 1.0 - 0.45*dot(p,p);
  col = pow(col, vec3(0.92));        // 軽いトーン
  gl_FragColor = vec4(col, 1.0);
}`;

function Cosmos() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((s) => s.gl);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } }),
    [],
  );
  useFrame((state, d) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value += d;
    const dpr = gl.getPixelRatio();
    mat.current.uniforms.uRes.value.set(state.size.width * dpr, state.size.height * dpr);
  });
  return (
    <ScreenQuad>
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </ScreenQuad>
  );
}

export default function LightCosmosScene() {
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
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
    >
      <Cosmos />
    </Canvas>
  );
}

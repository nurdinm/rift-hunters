import { Component, useMemo, useRef, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PublicRoom } from "@rift/protocol";

const colors = { red: "#ff4a3d", blue: "#29f2df", combo: "#d9ff45" } as const;

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn("3D arena unavailable; using 2D fallback", error, info); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Portal({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!active || !group.current) return;
    group.current.rotation.z += delta * 0.12;
    group.current.rotation.x = Math.sin(performance.now() * 0.00035) * 0.08;
  });
  return <group ref={group} position={[0, 0, -2.8]} rotation={[0.18, 0, 0]}>
    {[0, 1, 2].map((ring) => <mesh key={ring} rotation={[ring * 0.22, ring * 0.15, ring * 0.3]} scale={1 + ring * 0.22}>
      <torusGeometry args={[2.25, 0.035 + ring * 0.012, 10, 96]} />
      <meshBasicMaterial color={ring === 1 ? "#29f2df" : "#d9ff45"} transparent opacity={0.24 - ring * 0.045} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>)}
    <mesh>
      <circleGeometry args={[2.05, 96]} />
      <meshBasicMaterial color="#06231f" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  </group>;
}

function Debris({ active }: { active: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const radius = 2.3 + Math.random() * 3.8;
      const angle = Math.random() * Math.PI * 2;
      values[i * 3] = Math.cos(angle) * radius;
      values[i * 3 + 1] = Math.sin(angle) * radius * 0.62;
      values[i * 3 + 2] = -1 - Math.random() * 5;
    }
    return values;
  }, []);
  useFrame((_, delta) => { if (active && points.current) points.current.rotation.z -= delta * 0.025; });
  return <points ref={points}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color="#bfffd9" size={0.025} transparent opacity={0.6} sizeAttenuation />
  </points>;
}

function RiftTarget({ target, active }: { target: NonNullable<PublicRoom["target"]>; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const color = colors[target.kind];
  const viewport = useThree((state) => state.viewport);
  const x = (target.x - 0.5) * viewport.width;
  const y = (0.5 - target.y) * viewport.height;
  const scale = Math.max(0.38, target.radius * viewport.width);
  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    if (active) group.current.rotation.y += delta * 1.35;
    const pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.08;
    group.current.scale.setScalar(scale * pulse);
  });
  return <group ref={group} position={[x, y, 0.2]} scale={scale}>
    <pointLight color={color} intensity={2.2} distance={3.5} />
    <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
      {target.kind === "combo" ? <icosahedronGeometry args={[0.55, 1]} /> : <octahedronGeometry args={[0.58, 1]} />}
      <meshStandardMaterial color="#06110f" emissive={color} emissiveIntensity={1.35} roughness={0.2} metalness={0.62} />
    </mesh>
    <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]} scale={1.04}>
      {target.kind === "combo" ? <icosahedronGeometry args={[0.55, 1]} /> : <octahedronGeometry args={[0.58, 1]} />}
      <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.78, 0.025, 8, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.75} blending={THREE.AdditiveBlending} />
    </mesh>
  </group>;
}

function Scene({ state }: { state: PublicRoom }) {
  const active = state.phase === "playing";
  return <>
    <ambientLight intensity={0.32} />
    <directionalLight position={[3, 4, 5]} intensity={0.7} color="#c6fff4" />
    <Portal active={active} />
    <Debris active={active} />
    {state.target && <RiftTarget key={state.target.id} target={state.target} active={active} />}
  </>;
}

export function RiftScene({ state, fallback }: { state: PublicRoom; fallback: ReactNode }) {
  return <SceneBoundary fallback={fallback}>
    <div className="rift-scene" aria-hidden="true">
      <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 100 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} dpr={[1, 1.5]}>
        <Scene state={state} />
      </Canvas>
    </div>
  </SceneBoundary>;
}

import { Suspense, useEffect, useMemo, useRef, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useTelemetry, type DriveAction } from "./TelemetryContext";

class WebGLErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex items-center justify-center h-full bg-slate-950 text-muted-foreground font-mono text-[10px] tracking-widest flex-col gap-2">
          <span className="text-2xl">🚀</span>
          <span>3D VIEW · WebGL unavailable in this environment</span>
          <span className="text-[9px] opacity-50">macOS .app では正常に動作します</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const MODEL_URL = `${import.meta.env.BASE_URL}lumos1.glb`;

const WHEEL_NODES: Record<"FL" | "FR" | "RL" | "RR", string[]> = {
  FL: ["Wheel_FL", "Wheel\uFF3FFL"],
  FR: ["Wheel_FR", "Wheel\uFF3FFR"],
  RL: ["Wheel_RL", "Wheel\uFF3FRL"],
  RR: ["Wheel_RR", "Wheel\uFF3FRR"],
};

type Side = "L" | "R";

// Sign of wheel rotation per side based on current drive intent.
// Positive = rolls the rover forward.
function wheelSignFor(action: DriveAction, side: Side, signedSpeed: number): number {
  const mag = Math.abs(signedSpeed);
  if (mag === 0 || action === "stop") return 0;
  switch (action) {
    case "forward":
      return 1;
    case "backward":
      return -1;
    case "rotate_left":
      return side === "L" ? -1 : 1;
    case "rotate_right":
      return side === "L" ? 1 : -1;
    case "strafe_left":
      // Mecanum-ish visual: front-left/rear-right roll back, others roll forward.
      return 0; // see strafe override below
    case "strafe_right":
      return 0;
  }
}

function findNode(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  for (const name of names) {
    const found = root.getObjectByName(name);
    if (found) return found;
  }
  return null;
}

function RoverModel() {
  const gltf = useGLTF(MODEL_URL);
  const { intent } = useTelemetry();
  const intentRef = useRef(intent);
  intentRef.current = intent;

  const wheels = useMemo(() => {
    return {
      FL: findNode(gltf.scene, WHEEL_NODES.FL),
      FR: findNode(gltf.scene, WHEEL_NODES.FR),
      RL: findNode(gltf.scene, WHEEL_NODES.RL),
      RR: findNode(gltf.scene, WHEEL_NODES.RR),
    };
  }, [gltf.scene]);

  useEffect(() => {
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [gltf.scene]);

  useFrame((_state, delta) => {
    const { action, speed } = intentRef.current;
    const mag = Math.abs(speed) / 100; // 0..1
    // angular speed in rad/s at full throttle; tuned for visual feedback
    const omega = mag * 6 * delta;
    if (omega === 0) return;

    const rotateAxle = (node: THREE.Object3D | null, sign: number) => {
      if (!node || sign === 0) return;
      // Wheels' axle is the local X axis (left/right body axis).
      node.rotateX(sign * omega);
    };

    // Right-side wheels are mounted mirrored on this rover, so to roll the
    // body forward they spin opposite to the left wheels. We compute the "L"
    // sign for each action and flip it for right wheels.
    const RIGHT_FLIP = -1;

    // VEER (differential drive): all wheels roll forward, but the inner
    // side spins slower so the rover gradually turns toward the inner side.
    // Matches the firmware mapping in tools/rover-bridge.mjs (inner = s*0.3).
    const INNER_RATIO = 0.3;
    if (action === "strafe_left") {
      // Turning LEFT → left side is inner (slow), right side is outer (fast).
      rotateAxle(wheels.FL, INNER_RATIO);
      rotateAxle(wheels.RL, INNER_RATIO);
      rotateAxle(wheels.FR, 1 * RIGHT_FLIP);
      rotateAxle(wheels.RR, 1 * RIGHT_FLIP);
      return;
    }
    if (action === "strafe_right") {
      // Turning RIGHT → right side is inner (slow), left side is outer (fast).
      rotateAxle(wheels.FL, 1);
      rotateAxle(wheels.RL, 1);
      rotateAxle(wheels.FR, INNER_RATIO * RIGHT_FLIP);
      rotateAxle(wheels.RR, INNER_RATIO * RIGHT_FLIP);
      return;
    }
    const leftSign = wheelSignFor(action, "L", speed);
    const rightSign = wheelSignFor(action, "R", speed) * RIGHT_FLIP;
    rotateAxle(wheels.FL, leftSign);
    rotateAxle(wheels.RL, leftSign);
    rotateAxle(wheels.FR, rightSign);
    rotateAxle(wheels.RR, rightSign);
  });

  // Model is in millimetres; scale down to ~metres and lift so wheels sit on Y=0.
  return <primitive object={gltf.scene} scale={0.01} position={[0, 0, 0]} />;
}

useGLTF.preload(MODEL_URL);

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[2, 0.6, 1.5]} />
      <meshStandardMaterial color="#1f2937" wireframe />
    </mesh>
  );
}

export function RoverViewer() {
  return (
    <div className="relative h-[200px] md:h-[220px] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-black border border-border overflow-hidden">
      <WebGLErrorBoundary>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [3.2, 2.4, 3.6], fov: 38, near: 0.1, far: 100 }}
      >
        <color attach="background" args={["#05070d"]} />
        <fog attach="fog" args={["#05070d", 8, 18]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#7dd3fc" />
        <Suspense fallback={<LoadingFallback />}>
          <group position={[0, 0, 0]}>
            <RoverModel />
          </group>
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.55}
            scale={10}
            blur={2.4}
            far={4}
          />
          <Environment preset="warehouse" />
        </Suspense>
        <gridHelper args={[20, 40, "#1e293b", "#0f172a"]} position={[0, 0.001, 0]} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={10}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0.4, 0]}
        />
      </Canvas>
      <div className="pointer-events-none absolute top-2 left-3 font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
        3D View · Drag to orbit · Scroll to zoom
      </div>
      </WebGLErrorBoundary>
    </div>
  );
}

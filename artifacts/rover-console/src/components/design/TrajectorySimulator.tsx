import { useRef, useEffect, useCallback, useState } from "react";
import { useRoverParams } from "./RoverParamsContext";
import { Play, Square, Trash2, ChevronDown, ChevronUp, RotateCcw as RotateCCW, RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

type Action = "forward" | "backward" | "rotate_left" | "rotate_right" | "veer_left" | "veer_right" | "stop";

interface Pose {
  x: number;
  y: number;
  heading: number; // radians
}

interface TrailPoint extends Pose {
  action: Action;
}

const SCALE = 0.8; // px per mm
const DT = 0.05;   // simulation step seconds
const STEPS_PER_FRAME = 3;

function simulateStep(pose: Pose, action: Action, params: ReturnType<typeof useRoverParams>["params"]): Pose {
  const { wheelBase, wheelRadius, innerRatio, veerThrottle, rotateThrottle, maxSpeed } = params;
  const mm_per_rad = wheelRadius;

  // Convert PWM ratio to angular velocity (rad/s) — linear approximation
  // Assume 100 PWM → 6 rad/s at the wheel
  const PWM_TO_OMEGA = 6 / 100;
  const outer = (maxSpeed * veerThrottle / 100) * PWM_TO_OMEGA * mm_per_rad; // mm/s
  const inner = outer * innerRatio;
  const rot   = (maxSpeed * rotateThrottle / 100) * PWM_TO_OMEGA * mm_per_rad;

  let vL = 0, vR = 0;
  switch (action) {
    case "forward":      vL = outer; vR = outer; break;
    case "backward":     vL = -outer; vR = -outer; break;
    case "rotate_left":  vL = -rot; vR = rot; break;
    case "rotate_right": vL = rot;  vR = -rot; break;
    case "veer_left":    vL = inner; vR = outer; break;
    case "veer_right":   vL = outer; vR = inner; break;
    default:             return pose;
  }

  // Differential drive kinematics
  const v = (vL + vR) / 2;
  const omega = (vR - vL) / wheelBase;

  const dh = omega * DT;
  let dx: number, dy: number;
  if (Math.abs(omega) < 1e-6) {
    dx = v * DT * Math.cos(pose.heading);
    dy = v * DT * Math.sin(pose.heading);
  } else {
    const R = v / omega;
    dx = R * (Math.sin(pose.heading + dh) - Math.sin(pose.heading));
    dy = -R * (Math.cos(pose.heading + dh) - Math.cos(pose.heading));
  }

  return {
    x: pose.x + dx * SCALE,
    y: pose.y + dy * SCALE,
    heading: pose.heading + dh,
  };
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading - Math.PI / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, size * 0.5);
  ctx.lineTo(-size * 0.6, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function actionColor(action: Action): string {
  switch (action) {
    case "forward":      return "#22d3ee";
    case "backward":     return "#f97316";
    case "rotate_left":
    case "rotate_right": return "#a78bfa";
    case "veer_left":
    case "veer_right":   return "#34d399";
    default:             return "#6b7280";
  }
}

export function TrajectorySimulator() {
  const { params } = useRoverParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose>({ x: 0, y: 0, heading: 0 });
  const trailRef = useRef<TrailPoint[]>([]);
  const activeRef = useRef<Set<Action>>(new Set());
  const rafRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Canvas offset (pan origin)
  const originRef = useRef({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridPx = 50 * SCALE; // 50mm grid
    const ox = (originRef.current.x % gridPx + gridPx) % gridPx;
    const oy = (originRef.current.y % gridPx + gridPx) % gridPx;
    for (let x = ox - gridPx; x < W; x += gridPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = oy - gridPx; y < H; y += gridPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    const cx = W / 2 + originRef.current.x;
    const cy = H / 2 + originRef.current.y;

    // Origin cross
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
    ctx.restore();

    // Trail
    const trail = trailRef.current;
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        ctx.beginPath();
        ctx.strokeStyle = actionColor(b.action);
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.moveTo(cx + a.x, cy - a.y);
        ctx.lineTo(cx + b.x, cy - b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Rover arrow
    const pose = poseRef.current;
    drawArrow(ctx, cx + pose.x, cy - pose.y, -pose.heading, 10, "#ffffff");
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const active = activeRef.current;
    if (active.size > 0) {
      const action = [...active][0];
      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        poseRef.current = simulateStep(poseRef.current, action, paramsRef.current);
      }
      trailRef.current.push({ ...poseRef.current, action });
    }
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (!running) draw();
  }, [params, running, draw]);

  const start = () => {
    runningRef.current = true;
    setRunning(true);
    rafRef.current = requestAnimationFrame(loop);
  };
  const stop = () => {
    runningRef.current = false;
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    draw();
  };
  const clear = () => {
    poseRef.current = { x: 0, y: 0, heading: 0 };
    trailRef.current = [];
    originRef.current = { x: 0, y: 0 };
    draw();
  };

  const press = (action: Action) => activeRef.current.add(action);
  const release = (action: Action) => activeRef.current.delete(action);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!runningRef.current) return;
      switch (e.key.toLowerCase()) {
        case "w": case "arrowup":    press("forward"); break;
        case "s": case "arrowdown":  press("backward"); break;
        case "a": case "arrowleft":  press("rotate_left"); break;
        case "d": case "arrowright": press("rotate_right"); break;
        case "q": press("veer_left"); break;
        case "e": press("veer_right"); break;
      }
    };
    const up = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w": case "arrowup":    release("forward"); break;
        case "s": case "arrowdown":  release("backward"); break;
        case "a": case "arrowleft":  release("rotate_left"); break;
        case "d": case "arrowright": release("rotate_right"); break;
        case "q": release("veer_left"); break;
        case "e": release("veer_right"); break;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const BtnAction = ({ action, icon, label }: { action: Action; icon: React.ReactNode; label: string }) => (
    <button
      onPointerDown={() => press(action)}
      onPointerUp={() => release(action)}
      onPointerLeave={() => release(action)}
      disabled={!running}
      title={label}
      className={[
        "flex items-center justify-center rounded border border-border p-2.5 select-none touch-none",
        "transition-colors duration-75",
        running
          ? "bg-muted/40 hover:bg-muted active:bg-primary/20 active:border-primary cursor-pointer"
          : "opacity-30 cursor-not-allowed",
      ].join(" ")}
    >
      {icon}
    </button>
  );

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">Trajectory Simulator</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">軌跡シミュレーター</p>
        </div>
        <div className="flex gap-2">
          {!running ? (
            <button
              onClick={start}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 border border-primary/40 text-primary font-mono text-[10px] tracking-wider hover:bg-primary/30 transition-colors"
            >
              <Play className="w-3 h-3" /> START
            </button>
          ) : (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono text-[10px] tracking-wider hover:bg-orange-500/30 transition-colors"
            >
              <Square className="w-3 h-3" /> STOP
            </button>
          )}
          <button
            onClick={clear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-muted/40 border border-border font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Trash2 className="w-3 h-3" /> CLEAR
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: "320px", background: "#020817" }}
      />

      <div className="px-4 py-3 border-t border-border flex items-center gap-4">
        <div className="flex flex-col gap-1 items-center">
          <div className="grid grid-cols-3 gap-1">
            <div />
            <BtnAction action="forward"      icon={<ArrowUp className="w-4 h-4" />}    label="Forward (W)" />
            <div />
            <BtnAction action="rotate_left"  icon={<ArrowLeft className="w-4 h-4" />}  label="Rotate L (A)" />
            <BtnAction action="backward"     icon={<ArrowDown className="w-4 h-4" />}  label="Backward (S)" />
            <BtnAction action="rotate_right" icon={<ArrowRight className="w-4 h-4" />} label="Rotate R (D)" />
          </div>
        </div>
        <div className="flex flex-col gap-1 items-center">
          <div className="grid grid-cols-2 gap-1">
            <BtnAction action="veer_left"  icon={<RotateCCW className="w-4 h-4" />} label="VEER-L (Q)" />
            <BtnAction action="veer_right" icon={<RotateCw  className="w-4 h-4" />} label="VEER-R (E)" />
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-[9px] font-mono text-muted-foreground">
          {[
            { action: "forward" as Action,      label: "前進" },
            { action: "backward" as Action,     label: "後退" },
            { action: "rotate_left" as Action,  label: "その場回転" },
            { action: "veer_left" as Action,    label: "ベア旋回" },
          ].map(({ action, label }) => (
            <span key={action} className="flex items-center gap-1">
              <span className="w-3 h-1 rounded-full inline-block" style={{ background: actionColor(action) }} />
              {label}
            </span>
          ))}
          <span className="text-muted-foreground/50 hidden md:inline">PC: W/S/A/D/Q/E</span>
        </div>
      </div>
    </div>
  );
}

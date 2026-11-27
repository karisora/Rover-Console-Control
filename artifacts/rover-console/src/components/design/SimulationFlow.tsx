import { useState, useRef, useEffect } from "react";
import { Play, CheckCircle2, Loader2, ChevronRight, Cpu, Activity, Bot, AlertCircle } from "lucide-react";
import { useRoverParams } from "./RoverParamsContext";
import {
  ALL_SLOTS, MODULE_CATALOG, type MissionConfig, type ModuleDef,
} from "./missionTypes";
import { MissionTimeline } from "./MissionTimeline";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const rlVideoSrc   = `${BASE}/sim-rl.webm`;
const dtVideoSrc   = `${BASE}/sim-dt2.mp4`;
const gazoVideoSrc = `${BASE}/sim-dt.mp4`;

type PhaseState = "idle" | "running" | "done";

interface RoverType {
  id: string;
  label: string;
  labelJa: string;
  icon: string;
  score: number;
  reasons: string[];
  warnings: string[];
  color: string;
}

// ── Scoring engine ────────────────────────────────────────────────────────────
function computeRecommendation(
  params: ReturnType<typeof useRoverParams>["params"],
  config: MissionConfig,
): RoverType[] {
  // Collect mounted modules
  const mountedModules: ModuleDef[] = ALL_SLOTS
    .map((sid) => config.slots[sid])
    .filter(Boolean)
    .map((mid) => MODULE_CATALOG.find((m) => m.id === mid)!)
    .filter(Boolean);

  const totalWeight =
    mountedModules.reduce((s, m) => s + m.weightKg, 0) + config.payloadKg;
  const frontWeight = (["front", "top-front"] as const)
    .map((s) => config.slots[s])
    .filter(Boolean)
    .reduce((sum, mid) => sum + (MODULE_CATALOG.find((m) => m.id === mid)?.weightKg ?? 0), 0);
  const rearWeight = (["rear", "top-rear"] as const)
    .map((s) => config.slots[s])
    .filter(Boolean)
    .reduce((sum, mid) => sum + (MODULE_CATALOG.find((m) => m.id === mid)?.weightKg ?? 0), 0);
  const weightImbalance = Math.abs(frontWeight - rearWeight) / Math.max(totalWeight, 1);

  const hasDrill    = mountedModules.some((m) => m.id === "drill");
  const hasArm      = mountedModules.some((m) => m.id === "arm");
  const hasRTG      = mountedModules.some((m) => m.id === "rtg");
  const hasSolar    = mountedModules.some((m) => m.id === "solar");
  const hasLidar    = mountedModules.some((m) => m.id === "lidar");
  const scienceCount = mountedModules.filter((m) => m.category === "science").length;

  const { wheelBase, innerRatio, maxSpeed, wheelRadius } = params;
  const { terrain, durationDays, priority } = config;

  // Base terrain scores
  const TERRAIN_SCORES: Record<string, [number, number, number, number]> = {
    //                   4w   6w  crawl  legged
    flat:   [90,  70,  50,  40],
    rocky:  [55,  85,  70,  80],
    sandy:  [50,  65,  95,  45],
    steep:  [35,  55,  60,  95],
  };
  const [t4, t6, tc, tl] = TERRAIN_SCORES[terrain];

  // Priority modifier
  const PRIORITY_BONUS: Record<string, [number, number, number, number]> = {
    speed:     [15, 5, -10, -15],
    safety:    [-5, 10,   5,   5],
    science:   [-5,  5,  10,  10],
    endurance: [-5, 10,  15,   5],
  };
  const [p4, p6, pc, pl] = PRIORITY_BONUS[priority];

  // Weight penalty — calibrated for small rover (module budget ~20 kg, chassis 10 kg fixed)
  // totalWeight here is module+payload mass only (chassis not in config)
  const weightPenalty4 = Math.min(25, totalWeight * 1.5);   // 4-wheel struggles >~16 kg modules
  const weightPenalty6 = Math.min(12, totalWeight * 0.6);   // 6-wheel more tolerant
  const weightBonus6   = totalWeight > 6 ? 10 : 0;          // multi-wheel advantage with payload
  const weightPenaltyL = Math.min(35, totalWeight * 2.0);   // legs = harsh mass penalty

  // Duration (lunar days ~14 Earth days; 14d = 1 lunar day)
  const durationBonus = durationDays > 56 ? 10 : durationDays > 14 ? 5 : 0;

  // Front-heavy penalty (arm/drill)
  const frontHeavyPenalty4 = weightImbalance * 20;
  const frontHeavyCrawler  = (hasDrill || hasArm) ? 15 : 0;

  // Structural param influence (wheelBase reference = 250 mm for small rover)
  const agilityBonus4    = innerRatio * 10;
  const speedBonus4      = (maxSpeed / 100) * 8;
  const stabilityBonus6  = (wheelBase / 250) * 10;
  const groundBonus      = (wheelRadius / 65) * 8;

  const score4 = t4 + p4 - weightPenalty4 - frontHeavyPenalty4 + agilityBonus4 + speedBonus4;
  const score6 = t6 + p6 - weightPenalty6 + weightBonus6 + stabilityBonus6 + groundBonus + (hasLidar ? 5 : 0);
  const scoreC = tc + pc + frontHeavyCrawler + (hasRTG ? 8 : 0) + groundBonus + durationBonus;
  const scoreL = tl + pl - weightPenaltyL + (scienceCount >= 2 ? 12 : 0) + (hasArm ? 8 : 0) - (hasRTG ? 10 : 0);

  const rawScores = [score4, score6, scoreC, scoreL];
  const maxScore  = Math.max(...rawScores);

  // Build reason strings per type
  const reasons4: string[] = [];
  if (terrain === "flat") reasons4.push("フラット地形に最適");
  if (priority === "speed") reasons4.push("軽量・高速移動");
  if (totalWeight < 4) reasons4.push("低積載で効率的");
  reasons4.push("シンプルな制御系・低コスト");

  const reasons6: string[] = [];
  if (terrain === "rocky") reasons6.push("岩礫地形の走破性");
  reasons6.push("荷重分散・安定した重心");
  if (totalWeight > 6) reasons6.push("ペイロード搭載時の安定性");
  if (hasLidar) reasons6.push("センサー搭載に適したデッキ面積");

  const reasonsC: string[] = [];
  if (terrain === "sandy") reasonsC.push("砂地・軟弱地盤に最強");
  if (hasDrill || hasArm) reasonsC.push("重前部作業機器を安定保持");
  if (hasRTG) reasonsC.push("RTG搭載の低重心に対応");
  reasonsC.push("最高のグリップ力");

  const reasonsL: string[] = [];
  if (terrain === "steep") reasonsL.push("急傾斜・段差を踏破");
  if (scienceCount >= 2) reasonsL.push("精密ポジショニングで科学計測");
  if (hasArm) reasonsL.push("アームとの協調動作が高精度");
  reasonsL.push("不整地への適応力が最高");

  // Warnings
  // Module-only totalWeight; total system = +10 kg chassis
  const systemMass = totalWeight + 10;
  const warn4: string[] = [];
  if (systemMass > 28) warn4.push(`システム総質量 ${systemMass.toFixed(1)} kg — 30 kg 上限に接近`);
  if (totalWeight > 16) warn4.push(`モジュール質量 ${totalWeight.toFixed(1)} kg は 4 輪に過負荷の可能性`);
  if (terrain === "sandy") warn4.push("砂地でのスタックリスク");

  const warn6: string[] = [];
  if (systemMass > 28) warn6.push(`システム総質量 ${systemMass.toFixed(1)} kg — 30 kg 上限に接近`);
  if (priority === "speed") warn6.push("4輪より機動性がやや低下");

  const warnC: string[] = [];
  if (systemMass > 28) warnC.push(`システム総質量 ${systemMass.toFixed(1)} kg — 30 kg 上限に接近`);
  if (terrain === "steep") warnC.push("急傾斜での脱輪リスク");

  const warnL: string[] = [];
  if (totalWeight > 10) warnL.push(`モジュール質量 ${totalWeight.toFixed(1)} kg は脚部への負担大`);
  if (systemMass > 28) warnL.push(`システム総質量 ${systemMass.toFixed(1)} kg — 30 kg 上限に接近`);
  if (!hasSolar && !hasRTG) warnL.push("長期電源を要検討");

  const types: RoverType[] = [
    { id: "4wheel",  label: "4-Wheel Drive",  labelJa: "４輪型",    icon: "🚗", score: score4,  reasons: reasons4,  warnings: warn4,  color: "#22d3ee" },
    { id: "6wheel",  label: "6-Wheel Drive",  labelJa: "６輪型",    icon: "🚙", score: score6,  reasons: reasons6,  warnings: warn6,  color: "#34d399" },
    { id: "crawler", label: "Crawler",        labelJa: "クローラー型", icon: "🦾", score: scoreC, reasons: reasonsC, warnings: warnC,  color: "#fb923c" },
    { id: "legged",  label: "Legged",         labelJa: "脚型",      icon: "🕷️", score: scoreL,  reasons: reasonsL,  warnings: warnL,  color: "#a78bfa" },
  ];

  // Normalize 0-100
  return types
    .map((t) => ({ ...t, score: Math.max(5, Math.round((t.score / maxScore) * 100)) }))
    .sort((a, b) => b.score - a.score);
}

// ── Phase definitions ─────────────────────────────────────────────────────────
interface Phase {
  id: number; title: string; label: string; src: string; durationMs: number;
  icon: React.ReactNode;
}

const PHASES: Phase[] = [
  { id: 1, title: "NVIDIA Isaac Lab 力学モデルを読み込み中",    label: "RL Simulation",         src: rlVideoSrc,   durationMs: 3000, icon: <Cpu      className="w-4 h-4" /> },
  { id: 2, title: "重心変動とスリップ率を計算中",               label: "Digital Twin Analysis", src: dtVideoSrc,   durationMs: 4000, icon: <Activity className="w-4 h-4" /> },
  { id: 3, title: "デジタルツイン上でローバーを走行検証中",      label: "Gazebo Verification",   src: gazoVideoSrc, durationMs: 5000, icon: <Bot      className="w-4 h-4" /> },
];

// ── PhaseCard ─────────────────────────────────────────────────────────────────
function PhaseCard({ phase, state, progress }: { phase: Phase; state: PhaseState; progress: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (state === "running") { v.currentTime = 0; v.play().catch(() => {}); }
    else v.pause();
  }, [state]);

  const borderCls =
    state === "done"    ? "border-primary/60"
    : state === "running" ? "border-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
    : "border-border";

  return (
    <div className={`bg-card border rounded-lg overflow-hidden transition-all duration-300 ${borderCls} ${state === "idle" ? "opacity-40" : ""}`}>
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/50">
        <span className={state === "running" ? "text-cyan-400 animate-pulse" : state === "done" ? "text-primary" : "text-muted-foreground"}>
          {phase.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">{phase.label}</p>
          <p className="text-[11px] text-foreground leading-tight truncate">{phase.title}</p>
        </div>
        {state === "done"    && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
        {state === "running" && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />}
        {state === "idle"    && <span className="w-4 h-4 rounded-full border border-muted-foreground/40 inline-block flex-shrink-0" />}
      </div>
      <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
        <video ref={videoRef} src={phase.src} muted playsInline loop preload="metadata" className="w-full h-full object-cover" />
        {state === "idle"    && <div className="absolute inset-0 bg-black/70 flex items-center justify-center"><span className="font-mono text-[10px] text-muted-foreground tracking-widest">STANDBY</span></div>}
        {state === "running" && <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30"><div className="h-full bg-cyan-400 transition-all duration-200" style={{ width: `${progress}%` }} /></div>}
        {state === "done"    && <div className="absolute top-2 right-2 bg-black/60 rounded px-1.5 py-0.5"><span className="font-mono text-[9px] text-primary tracking-wider">COMPLETE</span></div>}
      </div>
    </div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({ rover, rank }: { rover: RoverType; rank: number }) {
  const isTop = rank === 0;
  return (
    <div className={`border rounded-lg p-3 flex flex-col gap-2 ${isTop ? "border-primary bg-primary/5 shadow-[0_0_16px_rgba(34,211,238,0.15)]" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{rover.icon}</span>
        {isTop && <span className="font-mono text-[9px] tracking-widest text-primary border border-primary/40 rounded px-1.5 py-0.5">✓ OPTIMAL</span>}
      </div>
      <div>
        <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">{rover.label}</p>
        <p className="text-sm font-semibold text-foreground">{rover.labelJa}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rover.score}%`, background: rover.color }} />
        </div>
        <span className="font-mono text-[11px] tabular-nums" style={{ color: rover.color }}>{rover.score}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {rover.reasons.map((r) => (
          <li key={r} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" style={{ color: rover.color }} />{r}
          </li>
        ))}
      </ul>
      {rover.warnings.length > 0 && (
        <ul className="flex flex-col gap-0.5 border-t border-border/50 pt-2 mt-1">
          {rover.warnings.map((w) => (
            <li key={w} className="flex items-center gap-1.5 text-[10px] text-orange-400">
              <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />{w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function SimulationFlow({ config }: { config: MissionConfig }) {
  const { params } = useRoverParams();
  const [phaseStates,   setPhaseStates]   = useState<PhaseState[]>([  "idle", "idle", "idle"]);
  const [phaseProgress, setPhaseProgress] = useState<number[]>([0, 0, 0]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [results, setResults] = useState<RoverType[]>([]);
  const timerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mountedCount = ALL_SLOTS.filter((s) => config.slots[s]).length;

  const reset = () => {
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhaseStates(["idle", "idle", "idle"]);
    setPhaseProgress([0, 0, 0]);
    setRunning(false); setDone(false); setResults([]);
  };

  const startAnalysis = () => {
    reset();
    setRunning(true);

    const runPhase = (idx: number) => {
      setPhaseStates((p) => { const n = [...p]; n[idx] = "running"; return n; });
      setPhaseProgress((p) => { const n = [...p]; n[idx] = 0; return n; });
      const start = Date.now();
      const { durationMs } = PHASES[idx];

      intervalRef.current = setInterval(() => {
        const pct = Math.min(100, ((Date.now() - start) / durationMs) * 100);
        setPhaseProgress((p) => { const n = [...p]; n[idx] = pct; return n; });
      }, 80);

      timerRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPhaseStates((p) => { const n = [...p]; n[idx] = "done"; return n; });
        setPhaseProgress((p) => { const n = [...p]; n[idx] = 100; return n; });
        if (idx < PHASES.length - 1) {
          setTimeout(() => runPhase(idx + 1), 300);
        } else {
          setRunning(false); setDone(true);
          setResults(computeRecommendation(params, config));
        }
      }, durationMs);
    };

    setTimeout(() => runPhase(0), 200);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Control bar */}
      <div className="bg-card border border-border rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">AI Simulation Flow</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            3フェーズ物理解析 · NVIDIA Isaac Lab + Digital Twin + Gazebo
            {mountedCount > 0 && (
              <span className="ml-2 text-primary">— {mountedCount} モジュール搭載</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {done && (
            <button onClick={reset} className="px-3 py-1.5 rounded bg-muted/40 border border-border font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              RESET
            </button>
          )}
          <button
            onClick={startAnalysis}
            disabled={running}
            className={`flex items-center gap-2 px-4 py-1.5 rounded border font-mono text-[10px] tracking-wider transition-colors ${running ? "bg-muted/20 border-muted text-muted-foreground cursor-not-allowed" : "bg-primary/20 border-primary/50 text-primary hover:bg-primary/30 cursor-pointer"}`}
          >
            {running ? <><Loader2 className="w-3 h-3 animate-spin" /> 解析中...</> : <><Play className="w-3 h-3" /> 解析開始</>}
          </button>
        </div>
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PHASES.map((ph, i) => (
          <PhaseCard key={ph.id} phase={ph} state={phaseStates[i]} progress={phaseProgress[i]} />
        ))}
      </div>

      {/* Results */}
      {done && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-primary tracking-[0.3em]">ANALYSIS RESULT</span>
            <span className="font-mono text-[10px] text-muted-foreground">最適機体構成</span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {results.map((r, i) => <ResultCard key={r.id} rover={r} rank={i} />)}
          </div>

          {/* Mission feasibility: timeline, budget, launch window */}
          <MissionTimeline config={config} optimalRoverId={results[0].id} />
        </div>
      )}
    </div>
  );
}

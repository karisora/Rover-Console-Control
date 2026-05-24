import { useState, useRef, useEffect } from "react";
import { Play, CheckCircle2, Loader2, ChevronRight, Cpu, Activity, Bot, AlertCircle } from "lucide-react";
import { useRoverParams } from "./RoverParamsContext";
import {
  ALL_SLOTS, MODULE_CATALOG, type MissionConfig, type ModuleDef,
} from "./missionTypes";
import { MissionTimeline } from "./MissionTimeline";
import {
  getStoredDesignAiApiKey,
  requestDesignAnalysis,
  setStoredDesignAiApiKey,
  type ModelRecommendation,
} from "./designAiClient";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const rlVideoSrc   = `${BASE}/sim-rl.webm`;
const dtVideoSrc   = `${BASE}/sim-dt2.mp4`;
const gazoVideoSrc = `${BASE}/sim-dt.mp4`;

type PhaseState = "idle" | "running" | "done";
type AiStatus = "idle" | "loading" | "model" | "fallback" | "error";

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

  // Build physics-derived candidate notes for the model to review.
  const reasons4: string[] = [];
  if (terrain === "flat") reasons4.push("Efficient on flat mare terrain");
  if (priority === "speed") reasons4.push("Lightweight and fast");
  if (totalWeight < 4) reasons4.push("Efficient with a low payload");
  reasons4.push("Simple control stack and low cost");

  const reasons6: string[] = [];
  if (terrain === "rocky") reasons6.push("Strong mobility over rocky terrain");
  reasons6.push("Better load distribution and stable center of mass");
  if (totalWeight > 6) reasons6.push("Stable under heavier payloads");
  if (hasLidar) reasons6.push("Deck area is suitable for sensor payloads");

  const reasonsC: string[] = [];
  if (terrain === "sandy") reasonsC.push("Best traction on loose regolith");
  if (hasDrill || hasArm) reasonsC.push("Supports heavy front work tools");
  if (hasRTG) reasonsC.push("Works well with a low-mounted RTG mass");
  reasonsC.push("Highest contact patch and grip");

  const reasonsL: string[] = [];
  if (terrain === "steep") reasonsL.push("Can step over slopes and ledges");
  if (scienceCount >= 2) reasonsL.push("Precise positioning for science observations");
  if (hasArm) reasonsL.push("High precision coordination with the arm");
  reasonsL.push("Best terrain adaptability");

  // Warnings
  // Module-only totalWeight; total system = +10 kg chassis
  const systemMass = totalWeight + 10;
  const warn4: string[] = [];
  if (systemMass > 28) warn4.push(`System mass ${systemMass.toFixed(1)} kg is near the 30 kg limit`);
  if (totalWeight > 16) warn4.push(`Module mass ${totalWeight.toFixed(1)} kg may overload a 4-wheel chassis`);
  if (terrain === "sandy") warn4.push("Higher sinkage risk in loose regolith");

  const warn6: string[] = [];
  if (systemMass > 28) warn6.push(`System mass ${systemMass.toFixed(1)} kg is near the 30 kg limit`);
  if (priority === "speed") warn6.push("Less agile than a 4-wheel chassis");

  const warnC: string[] = [];
  if (systemMass > 28) warnC.push(`System mass ${systemMass.toFixed(1)} kg is near the 30 kg limit`);
  if (terrain === "steep") warnC.push("Track slip risk on steep slopes");

  const warnL: string[] = [];
  if (totalWeight > 10) warnL.push(`Module mass ${totalWeight.toFixed(1)} kg is heavy for legs`);
  if (systemMass > 28) warnL.push(`System mass ${systemMass.toFixed(1)} kg is near the 30 kg limit`);
  if (!hasSolar && !hasRTG) warnL.push("Long-duration power needs review");

  const types: RoverType[] = [
    { id: "4wheel",  label: "4-Wheel Drive",  labelJa: "Four-wheel rover", icon: "🚗", score: score4,  reasons: reasons4,  warnings: warn4,  color: "#22d3ee" },
    { id: "6wheel",  label: "6-Wheel Drive",  labelJa: "Six-wheel rover",  icon: "🚙", score: score6,  reasons: reasons6,  warnings: warn6,  color: "#34d399" },
    { id: "crawler", label: "Crawler",        labelJa: "Tracked rover",    icon: "🦾", score: scoreC, reasons: reasonsC, warnings: warnC,  color: "#fb923c" },
    { id: "legged",  label: "Legged",         labelJa: "Legged rover",     icon: "🕷️", score: scoreL,  reasons: reasonsL,  warnings: warnL,  color: "#a78bfa" },
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
  { id: 1, title: "Loading NVIDIA Isaac Lab dynamics model",       label: "RL Simulation",         src: rlVideoSrc,   durationMs: 3000, icon: <Cpu      className="w-4 h-4" /> },
  { id: 2, title: "Estimating center-of-mass shift and slip ratio", label: "Digital Twin Analysis", src: dtVideoSrc,   durationMs: 4000, icon: <Activity className="w-4 h-4" /> },
  { id: 3, title: "Verifying rover behavior in the digital twin",   label: "Gazebo Verification",   src: gazoVideoSrc, durationMs: 5000, icon: <Bot      className="w-4 h-4" /> },
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

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(5, Math.min(100, Math.round(value)));
}

function modelRecommendationsToRovers(
  fallback: RoverType[],
  modelRecommendations: ModelRecommendation[] | undefined,
): RoverType[] {
  if (!modelRecommendations?.length) return [];

  const fallbackById = new Map(fallback.map((item) => [item.id, item]));
  const used = new Set<string>();
  const merged: RoverType[] = [];

  for (const recommendation of modelRecommendations) {
    const base = fallbackById.get(recommendation.id);
    if (!base || used.has(recommendation.id)) continue;
    used.add(recommendation.id);
    merged.push({
      ...base,
      score: clampScore(recommendation.score),
      reasons: Array.isArray(recommendation.reasons) && recommendation.reasons.length > 0
        ? recommendation.reasons.slice(0, 4)
        : base.reasons,
      warnings: Array.isArray(recommendation.warnings)
        ? recommendation.warnings.slice(0, 4)
        : base.warnings,
    });
  }

  return merged.sort((a, b) => b.score - a.score);
}

// ── Main export ───────────────────────────────────────────────────────────────
export function SimulationFlow({ config }: { config: MissionConfig }) {
  const { params } = useRoverParams();
  const [phaseStates,   setPhaseStates]   = useState<PhaseState[]>([  "idle", "idle", "idle"]);
  const [phaseProgress, setPhaseProgress] = useState<number[]>([0, 0, 0]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [results, setResults] = useState<RoverType[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiNarrative, setAiNarrative] = useState("");
  const [apiKey, setApiKey] = useState(() => getStoredDesignAiApiKey());
  const timerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mountedCount = ALL_SLOTS.filter((s) => config.slots[s]).length;

  const reset = () => {
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhaseStates(["idle", "idle", "idle"]);
    setPhaseProgress([0, 0, 0]);
    setRunning(false); setDone(false); setResults([]);
    setAiStatus("idle");
    setAiNarrative("");
  };

  useEffect(() => {
    return () => {
      if (timerRef.current)    clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
          const fallback = computeRecommendation(params, config);
          setResults([]);
          setAiStatus("loading");
          void requestDesignAnalysis({
            config,
            params,
            heuristicCandidates: fallback.map((item) => ({
              id: item.id,
              score: item.score,
              reasons: item.reasons,
              warnings: item.warnings,
            })),
          })
            .then((response) => {
              const modelResults = modelRecommendationsToRovers(fallback, response.recommendations);
              if (modelResults.length === 0) {
                throw new Error("The AI model did not return a valid rover selection.");
              }
              setResults(modelResults);
              setAiNarrative(response.narrative || "");
              setAiStatus(response.source === "azure-openai" ? "model" : "fallback");
            })
            .catch((error) => {
              setAiStatus("error");
              setAiNarrative(error instanceof Error ? error.message : "AI model request failed");
            });
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
            Three-phase physics analysis, then AI rover-form selection
            {mountedCount > 0 && (
              <span className="ml-2 text-primary">- {mountedCount} modules mounted</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setStoredDesignAiApiKey(event.target.value);
            }}
            placeholder="Azure OpenAI key"
            spellCheck={false}
            className="h-8 w-48 rounded border border-border bg-muted/20 px-2 font-mono text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
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
            {running ? <><Loader2 className="w-3 h-3 animate-spin" /> ANALYZING...</> : <><Play className="w-3 h-3" /> START ANALYSIS</>}
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
      {done && (aiStatus === "loading" || aiStatus === "error" || results.length > 0) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-primary tracking-[0.3em]">ANALYSIS RESULT</span>
            <span className="font-mono text-[10px] text-muted-foreground">AI-selected rover form</span>
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground border border-border rounded px-1.5 py-0.5">
              {aiStatus === "loading" ? "MODEL THINKING" : aiStatus === "model" ? "AZURE MODEL" : aiStatus === "error" ? "MODEL ERROR" : "MODEL RESULT"}
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>
          {aiNarrative && (
            <div className={`border rounded px-3 py-2 text-xs leading-relaxed ${aiStatus === "error" ? "border-orange-400/30 bg-orange-400/5 text-orange-300" : "border-primary/30 bg-primary/5 text-muted-foreground"}`}>
              {aiNarrative}
            </div>
          )}
          {aiStatus === "loading" && (
            <div className="border border-primary/30 bg-primary/5 rounded px-3 py-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-primary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              WAITING FOR AI ROVER SELECTION
            </div>
          )}
          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {results.map((r, i) => <ResultCard key={r.id} rover={r} rank={i} />)}
            </div>
          )}

          {/* Mission feasibility: timeline, budget, launch window */}
          {results.length > 0 && <MissionTimeline config={config} optimalRoverId={results[0].id} />}
        </div>
      )}
    </div>
  );
}

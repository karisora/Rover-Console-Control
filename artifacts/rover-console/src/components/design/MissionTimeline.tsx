import { useMemo } from "react";
import { Rocket, Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { ALL_SLOTS, MODULE_CATALOG, CLPS_LANDERS, CHASSIS_KG, MAX_ROVER_KG, AGENCY_COLOR, type MissionConfig, type ClpsLander } from "./missionTypes";

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date("2026-05-11");
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Computation ───────────────────────────────────────────────────────────────
function computeTimeline(config: MissionConfig, optimalRoverId: string) {
  const mounted = ALL_SLOTS
    .map((s) => config.slots[s])
    .filter(Boolean)
    .map((id) => MODULE_CATALOG.find((m) => m.id === id)!)
    .filter(Boolean);

  const moduleCount = mounted.length;
  const complexIds = new Set(["drill", "arm", "rtg", "lasercomm", "xband", "gpr"]);
  const complexCount = mounted.filter((m) => complexIds.has(m.id)).length;
  const totalWeight = mounted.reduce((s, m) => s + m.weightKg, 0) + config.payloadKg;
  const scienceCount = mounted.filter((m) => m.category === "science").length;

  // Complexity score 0–10
  const complexity = Math.min(10,
    moduleCount * 0.5 + complexCount * 1.5 + (config.durationDays / 365) * 0.8 +
    (optimalRoverId === "legged" ? 1.5 : optimalRoverId === "crawler" ? 0.8 : 0)
  );

  // Phase durations (months)
  const phases = [
    { id: "concept",   label: "コンセプト設計",       labelEn: "Concept Study",          months: 6,                                          color: "#22d3ee" },
    { id: "pdr",       label: "基本設計審査 (PDR)",    labelEn: "Preliminary Design",     months: Math.round(8 + complexity * 1.2),           color: "#34d399" },
    { id: "cdr",       label: "詳細設計・製造 (CDR)",  labelEn: "Detail Design & Build",  months: Math.round(10 + complexity * 1.8),          color: "#fb923c" },
    { id: "test",      label: "統合・環境試験",         labelEn: "Integration & Test",     months: Math.round(6 + complexity * 1.0),           color: "#a78bfa" },
    { id: "campaign",  label: "打ち上げキャンペーン",   labelEn: "Launch Campaign",        months: 4,                                          color: "#fbbf24" },
  ];

  const totalMonths = phases.reduce((s, p) => s + p.months, 0);

  // Budget (M USD) — capped at ≈$67M (≈100億円 at 150¥/$) for private small rover
  const hardwareCost = 3 + mounted.reduce((s, m) => s + m.costM, 0);  // $3M base chassis
  const testingCost = Math.round(hardwareCost * 0.22);                 // 22% — lunar qual is expensive
  const opsCost = Math.round((config.durationDays / 14) * 0.4 + 2);   // ~$0.4M/lunar-day + $2M base
  const programCost = Math.round((hardwareCost + testingCost) * 0.12);
  const contingency = Math.round((hardwareCost + testingCost + opsCost + programCost) * 0.18);
  const totalBudget = hardwareCost + testingCost + opsCost + programCost + contingency;

  // Ready date
  const readyDate = new Date(TODAY);
  readyDate.setMonth(readyDate.getMonth() + totalMonths);

  // Total rover mass (chassis + modules + extra payload)
  const roverMassKg = CHASSIS_KG + totalWeight; // e.g. 10 + modules
  const overMassLimit = roverMassKg > MAX_ROVER_KG;

  // Find compatible CLPS windows (after ready date, enough payload capacity)
  const compatibleLanders = CLPS_LANDERS.filter(
    (l) => l.targetDate > readyDate && l.payloadKg >= roverMassKg
  );
  const bestLander = compatibleLanders[0] ?? null;

  // Build phase Gantt (cumulative months from today)
  let cumulative = 0;
  const phasesWithOffset = phases.map((p) => {
    const startMonth = cumulative;
    cumulative += p.months;
    return { ...p, startMonth, endMonth: cumulative };
  });

  return {
    phases: phasesWithOffset,
    totalMonths,
    readyDate,
    budget: { hardwareCost, testingCost, opsCost, programCost, contingency, totalBudget },
    roverMassKg,
    overMassLimit,
    compatibleLanders,
    bestLander,
    complexity,
  };
}

function addMonths(base: Date, n: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function fmtDateShort(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ClpsLander["status"] }) {
  const cls =
    status === "confirmed" ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10"
    : status === "planned"  ? "text-cyan-400 border-cyan-400/40 bg-cyan-400/10"
    : "text-muted-foreground border-border bg-muted/20";
  const label =
    status === "confirmed" ? "CONFIRMED"
    : status === "planned"  ? "PLANNED"
    : "OPTION";
  return (
    <span className={`font-mono text-[8px] tracking-widest border rounded px-1.5 py-0.5 ${cls}`}>
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MissionTimeline({
  config,
  optimalRoverId,
}: {
  config: MissionConfig;
  optimalRoverId: string;
}) {
  const tl = useMemo(() => computeTimeline(config, optimalRoverId), [config, optimalRoverId]);

  const totalBar = tl.totalMonths;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] text-primary tracking-[0.3em]">MISSION FEASIBILITY</span>
        <span className="font-mono text-[10px] text-muted-foreground">開発〜打ち上げ可能性試算</span>
        <span className="flex-1 h-px bg-border" />
        <span className="font-mono text-[10px] text-muted-foreground">
          試算基準日: {fmtDate(TODAY)}
        </span>
      </div>

      {/* Gantt timeline */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary">Development Timeline · 開発スケジュール</p>
        <div className="flex flex-col gap-2">
          {tl.phases.map((ph) => {
            const widthPct = (ph.months / totalBar) * 100;
            const offsetPct = (ph.startMonth / totalBar) * 100;
            const startD = addMonths(TODAY, ph.startMonth);
            const endD   = addMonths(TODAY, ph.endMonth);
            return (
              <div key={ph.id} className="flex items-center gap-2">
                <div className="w-40 flex-shrink-0">
                  <p className="text-[10px] text-foreground leading-tight">{ph.label}</p>
                  <p className="font-mono text-[8px] text-muted-foreground">{fmtDateShort(startD)} → {fmtDateShort(endD)}</p>
                </div>
                <div className="flex-1 relative h-5 bg-muted/20 rounded overflow-hidden">
                  <div
                    className="absolute top-0 h-full rounded flex items-center justify-end pr-1"
                    style={{
                      left: `${offsetPct}%`,
                      width: `${widthPct}%`,
                      background: ph.color + "55",
                      borderLeft: `2px solid ${ph.color}`,
                    }}
                  >
                    <span className="font-mono text-[8px]" style={{ color: ph.color }}>{ph.months}mo</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary row */}
        <div className="border-t border-border/50 pt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] text-muted-foreground">総期間</span>
            <span className="font-mono text-sm text-primary font-semibold">{tl.totalMonths}ヶ月</span>
            <span className="font-mono text-[10px] text-muted-foreground">（約 {(tl.totalMonths / 12).toFixed(1)} 年）</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] text-muted-foreground">打ち上げ準備完了</span>
            <span className="font-mono text-sm text-cyan-400 font-semibold">{fmtDate(tl.readyDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">ローバー総質量</span>
            <span className={`font-mono text-sm font-semibold ${tl.overMassLimit ? "text-red-400" : tl.roverMassKg > MAX_ROVER_KG * 0.9 ? "text-orange-400" : "text-emerald-400"}`}>
              {tl.roverMassKg.toFixed(1)} / {MAX_ROVER_KG} kg
            </span>
            {tl.overMassLimit && (
              <span className="font-mono text-[9px] text-red-400 border border-red-400/40 rounded px-1 py-0.5 bg-red-400/10">
                ⚠ 超過
              </span>
            )}
          </div>
        </div>

        {/* Mass limit warning */}
        {tl.overMassLimit && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-red-300">
              ローバー総質量 <strong>{tl.roverMassKg.toFixed(1)} kg</strong> が目標上限 <strong>{MAX_ROVER_KG} kg</strong> を超えています。
              モジュールを外すか、軽量モジュールに変更してください。
            </p>
          </div>
        )}
      </div>

      {/* Budget breakdown */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary">Budget Estimate · 概算予算</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "ハードウェア",    value: tl.budget.hardwareCost,  color: "#f97316" },
            { label: "試験・検証",      value: tl.budget.testingCost,   color: "#a78bfa" },
            { label: "ミッション運用",  value: tl.budget.opsCost,       color: "#22d3ee" },
            { label: "プログラム管理",  value: tl.budget.programCost,   color: "#34d399" },
            { label: "コンティンジェンシー", value: tl.budget.contingency, color: "#fbbf24" },
          ].map((item) => (
            <div key={item.label} className="bg-muted/10 rounded border border-border p-2.5 flex flex-col gap-0.5">
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className="font-mono font-semibold" style={{ color: item.color }}>
                $ {item.value}M
              </p>
            </div>
          ))}
          <div className="bg-primary/5 rounded border border-primary/40 p-2.5 flex flex-col gap-0.5">
            <p className="font-mono text-[10px] text-primary tracking-wider">TOTAL</p>
            <p className="font-mono text-base font-bold text-primary">
              $ {tl.budget.totalBudget}M
            </p>
            <p className="font-mono text-[9px] text-muted-foreground">≈ ¥{(tl.budget.totalBudget * 150).toLocaleString()}億</p>
          </div>
        </div>
      </div>

      {/* NASA CLPS Launch Window */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <img src={`${BASE_URL}/nasa-logo.png`} alt="NASA" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary">NASA CLPS Launch Window · 打ち上げ機会</p>
        </div>

        {tl.bestLander ? (
          <div className="border border-emerald-500/40 rounded-lg p-3 bg-emerald-500/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-300">打ち上げ可能ウィンドウが存在します</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <div>
                <p className="font-mono text-[9px] text-muted-foreground">最早打ち上げ機会</p>
                <p className="font-mono text-base text-emerald-400 font-bold">{fmtDate(tl.bestLander.targetDate)}</p>
              </div>
              <div>
                <p className="font-mono text-[9px] text-muted-foreground">ランダー</p>
                <p className="font-mono text-sm text-foreground">{tl.bestLander.provider} · {tl.bestLander.name}</p>
              </div>
              <div>
                <p className="font-mono text-[9px] text-muted-foreground">ペイロード許容</p>
                <p className="font-mono text-sm text-cyan-400">{tl.bestLander.payloadKg} kg</p>
              </div>
              <div>
                <p className="font-mono text-[9px] text-muted-foreground">備考</p>
                <p className="text-[10px] text-muted-foreground">{tl.bestLander.notes}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-orange-500/40 rounded-lg p-3 bg-orange-500/5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <p className="text-[11px] text-orange-300">
              現在の開発期間（{tl.totalMonths}ヶ月）では既知の CLPS 打ち上げウィンドウに間に合いません。
              ローバー質量（{tl.roverMassKg} kg）または開発スケジュールの見直しを検討してください。
            </p>
          </div>
        )}

        {/* All landers table */}
        <div className="flex flex-col gap-1 mt-1">
          <p className="font-mono text-[9px] text-muted-foreground/60 tracking-widest uppercase">CLPS スケジュール一覧</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1 pr-3 font-mono text-muted-foreground/60 tracking-widest font-normal">DATE</th>
                  <th className="text-left py-1 pr-3 font-mono text-muted-foreground/60 tracking-widest font-normal">AGENCY</th>
                  <th className="text-left py-1 pr-3 font-mono text-muted-foreground/60 tracking-widest font-normal">MISSION</th>
                  <th className="text-right py-1 pr-3 font-mono text-muted-foreground/60 tracking-widest font-normal">PAYLOAD</th>
                  <th className="text-left py-1 font-mono text-muted-foreground/60 tracking-widest font-normal">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {CLPS_LANDERS.map((l) => {
                  const isReady = l.targetDate > tl.readyDate;
                  const isCapable = l.payloadKg >= tl.roverMassKg;
                  const isBest = tl.bestLander?.id === l.id;
                  return (
                    <tr
                      key={l.id}
                      className={[
                        "border-b border-border/20 transition-colors",
                        isBest ? "bg-emerald-500/8" : "",
                        !isReady || !isCapable ? "opacity-40" : "",
                      ].join(" ")}
                    >
                      <td className="py-1.5 pr-3 font-mono text-foreground">{fmtDateShort(l.targetDate)}</td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[8px] px-1.5 py-0.5 rounded font-bold leading-none"
                            style={{ background: AGENCY_COLOR[l.agency] + "33", color: AGENCY_COLOR[l.agency], border: `1px solid ${AGENCY_COLOR[l.agency]}55` }}
                          >{l.agency}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{l.provider}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          {isBest && <Rocket className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />}
                          <span className={isBest ? "text-emerald-300 font-medium" : "text-foreground"}>{l.name}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">
                        <span className={isCapable ? "text-cyan-400" : "text-red-400"}>{l.payloadKg} kg</span>
                      </td>
                      <td className="py-1.5"><StatusBadge status={l.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-[8px] text-muted-foreground/40 mt-1">
            ※ 灰色行 = ローバー完成前 or ペイロード不足 · データは2026年5月時点の公開情報に基づく概算
          </p>
        </div>
      </div>
    </div>
  );
}

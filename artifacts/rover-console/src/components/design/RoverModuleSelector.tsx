import { useState } from "react";
import {
  ALL_SLOTS, SLOT_META, MODULE_CATALOG, CATEGORY_LABEL,
  CHASSIS_KG, MAX_ROVER_KG,
  type SlotId, type MissionConfig, type ModuleDef,
} from "./missionTypes";
import { X, ChevronRight } from "lucide-react";

// ── SVG layout constants ──────────────────────────────────────────────────────
const SVG_W = 520;
const SVG_H = 185;

const BODY = { x: 80, y: 64, w: 360, h: 68 };

type SlotRect = { id: SlotId; x: number; y: number; w: number; h: number };

// 2 top slots, wider, better centered over body halves
const SLOT_RECTS: SlotRect[] = [
  { id: "front",     x:  26, y:  64, w: 58,  h: 68 },
  { id: "top-front", x: 105, y:  16, w: 140, h: 48 },
  { id: "top-rear",  x: 275, y:  16, w: 140, h: 48 },
  { id: "rear",      x: 436, y:  64, w: 58,  h: 68 },
  // Bottom: partially overlaps body from below
  { id: "bottom",    x: 160, y: 112, w: 200, h: 52 },
];

// ── Module picker popup ───────────────────────────────────────────────────────
function ModulePicker({
  slotId, currentModuleId, onSelect, onClose,
}: {
  slotId: SlotId; currentModuleId: string | null;
  onSelect: (id: string | null) => void; onClose: () => void;
}) {
  const compatible = MODULE_CATALOG.filter((m) => m.compatibleSlots.includes(slotId));
  const byCategory = compatible.reduce<Record<string, ModuleDef[]>>((acc, m) => {
    (acc[m.category] ||= []).push(m);
    return acc;
  }, {});

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20 rounded-lg">
      <div className="bg-card border border-primary/40 rounded-lg p-4 w-full max-w-sm max-h-[90%] overflow-y-auto flex flex-col gap-3 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] text-primary tracking-widest uppercase">{SLOT_META[slotId].label}</p>
            <p className="text-sm font-semibold">Select Module</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <button
          onClick={() => { onSelect(null); onClose(); }}
          className={`flex items-center gap-2 px-3 py-2 rounded border text-[11px] transition-colors text-left ${currentModuleId === null ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40"}`}
        >
          <span className="text-base">➖</span><span>None (empty slot)</span>
        </button>

        {Object.entries(byCategory).map(([cat, modules]) => (
          <div key={cat} className="flex flex-col gap-1">
            <p className="font-mono text-[9px] text-muted-foreground/60 tracking-widest uppercase px-1">
              {CATEGORY_LABEL[cat as ModuleDef["category"]] ?? cat}
            </p>
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => { onSelect(m.id); onClose(); }}
                className={`flex items-start gap-2 px-3 py-2 rounded border text-left text-[11px] transition-colors ${currentModuleId === m.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}
              >
                <span className="text-base flex-shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground text-[9px] font-mono">{m.weightKg}kg · {m.powerW > 0 ? `+${m.powerW}W` : `${m.powerW}W`} · ${m.costM}M</span>
                  </div>
                  <span className="text-muted-foreground text-[10px]">{m.description}</span>
                </div>
                {currentModuleId === m.id && <ChevronRight className="w-3 h-3 text-primary flex-shrink-0 self-center" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SVG Schematic ─────────────────────────────────────────────────────────────
function RoverSchematic({
  config, activeSlot, onSlotClick,
}: {
  config: MissionConfig; activeSlot: SlotId | null; onSlotClick: (id: SlotId) => void;
}) {
  const [hov, setHov] = useState<SlotId | null>(null);

  const fill = (sr: SlotRect, mod: ModuleDef | null | undefined) =>
    mod ? mod.color + "30" : hov === sr.id ? "#22d3ee18" : "#ffffff07";
  const stroke = (sr: SlotRect, mod: ModuleDef | null | undefined) =>
    activeSlot === sr.id ? "#22d3ee" : mod ? mod.color : hov === sr.id ? "#22d3ee70" : "#334155";

  const renderSlotContent = (sr: SlotRect, mod: ModuleDef | null | undefined) =>
    mod ? (
      <>
        <text x={sr.x + sr.w / 2} y={sr.y + sr.h / 2 - 8} fontSize={16} textAnchor="middle" dominantBaseline="middle">{mod.icon}</text>
        <text x={sr.x + sr.w / 2} y={sr.y + sr.h / 2 + 10} fontSize={7.5} fill={mod.color} textAnchor="middle" fontFamily="monospace">{mod.label}</text>
      </>
    ) : (
      <>
        <text x={sr.x + sr.w / 2} y={sr.y + sr.h / 2 - 5} fontSize={11} fill="#475569" textAnchor="middle" dominantBaseline="middle">+</text>
        <text x={sr.x + sr.w / 2} y={sr.y + sr.h / 2 + 8} fontSize={7} fill="#475569" textAnchor="middle" fontFamily="monospace">{SLOT_META[sr.id].labelJa}</text>
      </>
    );

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ maxHeight: 185 }}>
      {/* Grid */}
      {Array.from({ length: 10 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 20} x2={SVG_W} y2={i * 20} stroke="#1e293b" strokeWidth={0.5} />)}
      {Array.from({ length: 27 }, (_, i) => <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={SVG_H} stroke="#1e293b" strokeWidth={0.5} />)}

      {/* ── Rover body ── */}
      <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={5} fill="#0c2a3d" stroke="#0e4f6a" strokeWidth={2} />
      {/* Top highlight */}
      <rect x={BODY.x + 10} y={BODY.y + 4} width={BODY.w - 20} height={7} rx={2} fill="#155e75" opacity={0.5} />
      {/* Bottom underside */}
      <rect x={BODY.x + 10} y={BODY.y + BODY.h - 11} width={BODY.w - 20} height={7} rx={2} fill="#0e3a52" opacity={0.55} />
      {/* Front nose */}
      <polygon points={`${BODY.x},${BODY.y} ${BODY.x - 10},${BODY.y + 16} ${BODY.x - 10},${BODY.y + BODY.h - 16} ${BODY.x},${BODY.y + BODY.h}`} fill="#0e4f6a" />
      {/* Panel lines */}
      <line x1={BODY.x + 140} y1={BODY.y + 4} x2={BODY.x + 140} y2={BODY.y + BODY.h - 4} stroke="#1e4a62" strokeWidth={1} />
      <line x1={BODY.x + 220} y1={BODY.y + 4} x2={BODY.x + 220} y2={BODY.y + BODY.h - 4} stroke="#1e4a62" strokeWidth={1} />
      {/* Direction arrow */}
      <polygon points="14,98 26,90 26,106" fill="#22d3ee" opacity={0.9} />
      <text x={8} y={118} fontSize={7} fill="#22d3ee" fontFamily="monospace" textAnchor="middle" opacity={0.6}>FRONT</text>
      <text x={SVG_W - 12} y={118} fontSize={7} fill="#64748b" fontFamily="monospace" textAnchor="middle">REAR</text>

      {/* ── Bottom slot (rendered below body but visually embedded) ── */}
      {(() => {
        const sr = SLOT_RECTS.find((s) => s.id === "bottom")!;
        const mid = config.slots["bottom"] ?? null;
        const mod = mid ? MODULE_CATALOG.find((m) => m.id === mid) : null;
        const isActive = activeSlot === "bottom";
        return (
          <g key="bottom" onClick={() => onSlotClick("bottom")} onMouseEnter={() => setHov("bottom")} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer" }}>
            <defs>
              <pattern id="hatch" patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={8} stroke="#0e3a52" strokeWidth={1.5} />
              </pattern>
            </defs>
            <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} rx={4} fill="url(#hatch)" opacity={0.5} />
            <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} rx={4} fill={fill(sr, mod)} stroke={stroke(sr, mod)} strokeWidth={isActive ? 2 : 1.5} strokeDasharray={mod ? undefined : "5 3"} />
            {isActive && <rect x={sr.x - 2} y={sr.y - 2} width={sr.w + 4} height={sr.h + 4} rx={6} fill="none" stroke="#22d3ee" strokeWidth={1} opacity={0.3} />}
            {renderSlotContent(sr, mod)}
            {/* Bracket pins indicating embed */}
            <line x1={sr.x + 10} y1={sr.y} x2={sr.x + 10} y2={sr.y - 6} stroke="#22d3ee" strokeWidth={1} opacity={0.35} strokeDasharray="2 2" />
            <line x1={sr.x + sr.w - 10} y1={sr.y} x2={sr.x + sr.w - 10} y2={sr.y - 6} stroke="#22d3ee" strokeWidth={1} opacity={0.35} strokeDasharray="2 2" />
          </g>
        );
      })()}

      {/* ── Other slots ── */}
      {SLOT_RECTS.filter((sr) => sr.id !== "bottom").map((sr) => {
        const mid = config.slots[sr.id] ?? null;
        const mod = mid ? MODULE_CATALOG.find((m) => m.id === mid) : null;
        const isActive = activeSlot === sr.id;
        return (
          <g key={sr.id} onClick={() => onSlotClick(sr.id)} onMouseEnter={() => setHov(sr.id)} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer" }}>
            <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} rx={3} fill={fill(sr, mod)} stroke={stroke(sr, mod)} strokeWidth={isActive ? 2 : 1.5} strokeDasharray={mod ? undefined : "4 3"} />
            {isActive && <rect x={sr.x - 2} y={sr.y - 2} width={sr.w + 4} height={sr.h + 4} rx={5} fill="none" stroke="#22d3ee" strokeWidth={1} opacity={0.35} />}
            {renderSlotContent(sr, mod)}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export function RoverModuleSelector({ config, onChange }: { config: MissionConfig; onChange: (c: MissionConfig) => void }) {
  const [activeSlot, setActiveSlot] = useState<SlotId | null>(null);

  const setSlotModule = (slotId: SlotId, moduleId: string | null) => {
    const slots = { ...config.slots };
    if (moduleId === null) delete slots[slotId];
    else slots[slotId] = moduleId;
    onChange({ ...config, slots });
  };

  const totalModuleKg = ALL_SLOTS.reduce((s, sid) => s + (MODULE_CATALOG.find((m) => m.id === config.slots[sid])?.weightKg ?? 0), 0);
  const totalPower    = ALL_SLOTS.reduce((s, sid) => s + (MODULE_CATALOG.find((m) => m.id === config.slots[sid])?.powerW  ?? 0), 0);
  const totalCost     = ALL_SLOTS.reduce((s, sid) => s + (MODULE_CATALOG.find((m) => m.id === config.slots[sid])?.costM   ?? 0), 0);

  const systemMassKg  = CHASSIS_KG + totalModuleKg + config.payloadKg;
  const massPct       = Math.min(100, (systemMassKg / MAX_ROVER_KG) * 100);
  const massOver      = systemMassKg > MAX_ROVER_KG;
  const massNear      = systemMassKg > MAX_ROVER_KG * 0.87;
  const massBarColor  = massOver ? "#ef4444" : massNear ? "#f97316" : "#22d3ee";

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">Module Placement</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Click a slot to assign a payload module</p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-muted-foreground">Power <span className={totalPower > 0 ? "text-orange-400" : totalPower < 0 ? "text-emerald-400" : "text-primary"}>{totalPower > 0 ? `+${totalPower}` : totalPower} W</span></span>
          <span className="text-muted-foreground">Module Cost <span className="text-yellow-400">~${totalCost.toFixed(1)}M</span></span>
        </div>
      </div>

      {/* Mass budget bar */}
      <div className="px-4 py-2 border-b border-border/60 bg-muted/5 flex items-center gap-3">
        <span className="font-mono text-[9px] text-muted-foreground tracking-widest flex-shrink-0">TOTAL MASS</span>
        <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${massPct}%`, background: massBarColor }}
          />
        </div>
        <span className="font-mono text-[10px] flex-shrink-0" style={{ color: massBarColor }}>
          {systemMassKg.toFixed(1)} / {MAX_ROVER_KG} kg
        </span>
        {massOver && (
          <span className="font-mono text-[8px] text-red-400 border border-red-400/50 rounded px-1 bg-red-400/10 flex-shrink-0">
            OVER
          </span>
        )}
        <span className="font-mono text-[9px] text-muted-foreground/50 flex-shrink-0">
          (chassis {CHASSIS_KG} + modules {totalModuleKg.toFixed(1)} kg)
        </span>
      </div>

      <div className="relative bg-[#020c18] px-4 py-3">
        <RoverSchematic config={config} activeSlot={activeSlot} onSlotClick={(id) => setActiveSlot((p) => (p === id ? null : id))} />
        <p className="text-center font-mono text-[9px] text-muted-foreground/40 mt-1 tracking-widest">
          CLICK SLOT TO ASSIGN MODULE - BELLY SLOT IS PARTIALLY EMBEDDED UNDER THE BODY
        </p>
        {activeSlot && (
          <ModulePicker
            slotId={activeSlot}
            currentModuleId={config.slots[activeSlot] ?? null}
            onSelect={(mid) => setSlotModule(activeSlot, mid)}
            onClose={() => setActiveSlot(null)}
          />
        )}
      </div>

      <div className="border-t border-border px-3 py-2 flex flex-wrap gap-1.5">
        {ALL_SLOTS.map((sid) => {
          const mid = config.slots[sid];
          const mod = mid ? MODULE_CATALOG.find((m) => m.id === mid) : null;
          return (
            <button
              key={sid}
              onClick={() => setActiveSlot((p) => (p === sid ? null : sid))}
              className={[
                "flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] transition-colors",
                activeSlot === sid ? "border-primary bg-primary/10 text-primary"
                : mod ? "border-border bg-muted/30 text-foreground"
                : sid === "bottom" ? "border-dashed border-cyan-900/60 text-muted-foreground hover:border-cyan-700"
                : "border-dashed border-border/50 text-muted-foreground hover:border-border",
              ].join(" ")}
              style={mod ? { borderColor: mod.color + "60" } : undefined}
            >
              <span>{mod ? mod.icon : "➕"}</span>
              <span className="font-mono">{SLOT_META[sid].labelJa}</span>
              {mod && <span className="text-muted-foreground">· {mod.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

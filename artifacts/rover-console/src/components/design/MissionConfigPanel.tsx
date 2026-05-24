import { RoverModuleSelector } from "./RoverModuleSelector";
import type { MissionConfig, Terrain, Priority } from "./missionTypes";

const TERRAIN_OPTIONS: { value: Terrain; label: string; emoji: string }[] = [
  { value: "flat",   label: "Mare plain", emoji: "🌕" },
  { value: "rocky",  label: "Rocky crater field", emoji: "🪨" },
  { value: "sandy",  label: "Loose regolith", emoji: "🏜️" },
  { value: "steep",  label: "Steep ridge", emoji: "⛰️" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; emoji: string }[] = [
  { value: "speed",     label: "Fast traverse", emoji: "⚡" },
  { value: "safety",    label: "Safety margin", emoji: "🛡️" },
  { value: "science",   label: "Science return", emoji: "🔬" },
  { value: "endurance", label: "Endurance", emoji: "⏳" },
];

export function MissionConfigPanel({
  config,
  onChange,
}: {
  config: MissionConfig;
  onChange: (c: MissionConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* 3D module placer */}
      <RoverModuleSelector config={config} onChange={onChange} />

      {/* Mission parameters */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">Mission Parameters</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Mission constraints</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Terrain */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Terrain
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TERRAIN_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => onChange({ ...config, terrain: t.value })}
                  className={[
                    "flex items-center gap-2 px-2.5 py-2 rounded border text-[11px] text-left transition-colors",
                    config.terrain === t.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/40 text-muted-foreground",
                  ].join(" ")}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Mission Priority
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => onChange({ ...config, priority: p.value })}
                  className={[
                    "flex items-center gap-2 px-2.5 py-2 rounded border text-[11px] text-left transition-colors",
                    config.priority === p.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/40 text-muted-foreground",
                  ].join(" ")}
                >
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Duration */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                Duration
              </label>
              <span className="font-mono text-xs text-primary tabular-nums">
                {config.durationDays} days
              </span>
            </div>
            <input
              type="range"
              min={7} max={365} step={7}
              value={config.durationDays}
              onChange={(e) => onChange({ ...config, durationDays: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between font-mono text-[9px] text-muted-foreground/50">
              <span>1 wk</span><span>1 mo</span><span>6 mo</span><span>1 yr</span>
            </div>
          </div>

          {/* Extra payload */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                Extra Payload
              </label>
              <span className="font-mono text-xs text-primary tabular-nums">
                {config.payloadKg} kg
              </span>
            </div>
            <input
              type="range"
              min={0} max={50} step={1}
              value={config.payloadKg}
              onChange={(e) => onChange({ ...config, payloadKg: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between font-mono text-[9px] text-muted-foreground/50">
              <span>0 kg</span><span>25 kg</span><span>50 kg</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            Mission Notes
          </label>
          <textarea
            value={config.notes}
            onChange={(e) => onChange({ ...config, notes: e.target.value })}
            placeholder="Enter mission goals or design constraints..."
            rows={2}
            className="w-full rounded border border-border bg-muted/20 px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

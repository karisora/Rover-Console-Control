import { Gauge } from "lucide-react";
import { useTelemetry } from "./TelemetryContext";

export function SpeedControl() {
  const { speed, setSpeed } = useTelemetry();
  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            速度指令
          </span>
        </div>
        <span className="font-mono text-2xl font-semibold text-primary tabular-nums">
          {speed}<span className="ml-1 text-xs text-muted-foreground">%</span>
        </span>
      </div>
      <div className="relative h-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-2.5 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-primary/20">
          <div className="h-full bg-primary" style={{ width: `${speed}%` }} />
        </div>
        <input
          aria-label="速度指令"
          className="drive-speed relative h-full w-full cursor-pointer appearance-none bg-transparent"
          type="range"
          value={speed}
          min={0}
          max={100}
          step={1}
          onChange={(event) => setSpeed(event.currentTarget.valueAsNumber)}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground mt-2 tracking-widest">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}

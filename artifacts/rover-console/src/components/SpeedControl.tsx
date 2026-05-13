import { Slider } from "@/components/ui/slider";
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
            Throttle
          </span>
        </div>
        <span className="font-mono text-2xl font-semibold text-primary tabular-nums">
          {speed.toString().padStart(3, "0")}
          <span className="text-xs text-muted-foreground ml-1">/100</span>
        </span>
      </div>
      <Slider
        value={[speed]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => setSpeed(v[0] ?? 0)}
      />
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

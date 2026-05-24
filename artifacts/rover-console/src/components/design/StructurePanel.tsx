import { RotateCcw } from "lucide-react";
import { useRoverParams, type RoverParams } from "./RoverParamsContext";

interface SliderRowProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  field: keyof RoverParams;
}

function SliderRow({ label, hint, value, min, max, step, unit, field }: SliderRowProps) {
  const { setParam } = useRoverParams();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <div>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</span>
          <span className="ml-2 text-[10px] text-muted-foreground/60">{hint}</span>
        </div>
        <span className="font-mono text-xs text-primary tabular-nums">
          {step < 1 ? value.toFixed(2) : value}
          <span className="text-muted-foreground ml-0.5 text-[10px]">{unit}</span>
        </span>
      </div>
      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden pointer-events-none">
        <div
          className="absolute inset-y-0 left-0 bg-primary/60 rounded-full transition-all duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setParam(field, parseFloat(e.target.value) as RoverParams[typeof field])}
        className="w-full accent-primary"
      />
    </div>
  );
}

export function StructurePanel() {
  const { params, reset } = useRoverParams();

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">Structure Params</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Geometry and drive parameters</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          RESET
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">Geometry</p>
          <SliderRow label="Wheel Base" hint="Track width" value={params.wheelBase} min={80} max={300} step={1} unit="mm" field="wheelBase" />
          <SliderRow label="Wheel Radius" hint="Rolling radius" value={params.wheelRadius} min={20} max={80} step={1} unit="mm" field="wheelRadius" />
        </div>
        <div className="flex flex-col gap-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">Drive</p>
          <SliderRow label="Max Speed" hint="PWM limit" value={params.maxSpeed} min={20} max={100} step={1} unit="PWM%" field="maxSpeed" />
          <SliderRow label="VEER Inner Ratio" hint="Inner wheel ratio" value={params.innerRatio} min={0} max={0.9} step={0.05} unit="" field="innerRatio" />
        </div>
      </div>

      <div className="border-t border-border pt-3 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">Simulation Speed</p>
          <SliderRow label="VEER Throttle" hint="Curve command speed" value={params.veerThrottle} min={10} max={100} step={1} unit="%" field="veerThrottle" />
        </div>
        <div className="flex flex-col gap-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">&nbsp;</p>
          <SliderRow label="Rotate Throttle" hint="Spin command speed" value={params.rotateThrottle} min={10} max={100} step={1} unit="%" field="rotateThrottle" />
        </div>
      </div>

      <div className="border-t border-border pt-3 grid grid-cols-3 gap-3 font-mono text-[10px]">
        <Stat label="Turn Radius (VEER-R)" value={`${Math.round(params.wheelBase / 2 * (1 + params.innerRatio) / (1 - params.innerRatio))} mm`} />
        <Stat label="Outer Speed" value={`${Math.round(params.maxSpeed * params.veerThrottle / 100)} PWM`} />
        <Stat label="Inner Speed" value={`${Math.round(params.maxSpeed * params.veerThrottle / 100 * params.innerRatio)} PWM`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded p-2">
      <p className="text-[9px] text-muted-foreground mb-1">{label}</p>
      <p className="text-primary">{value}</p>
    </div>
  );
}

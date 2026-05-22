import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CornerUpLeft,
  CornerUpRight,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Server,
  Square,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTelemetry, type DriveAction } from "@/components/TelemetryContext";
import { useSimApi } from "./SimApiContext";

interface SimButtonProps {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "secondary" | "destructive";
}

function SimButton({ children, disabled, onClick, variant = "secondary" }: SimButtonProps) {
  return (
    <Button
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      className="h-10 gap-2 font-mono text-[10px] tracking-[0.2em] uppercase"
    >
      {children}
    </Button>
  );
}

export function SimConnectionPanel() {
  const {
    baseUrl,
    setBaseUrl,
    telemetry,
    pending,
    startSimulation,
    stopSimulation,
    resetSimulation,
  } = useSimApi();
  const [draft, setDraft] = useState(baseUrl);

  useEffect(() => {
    setDraft(baseUrl);
  }, [baseUrl]);

  const disabled = pending || !baseUrl;

  return (
    <div className="bg-card border border-border p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="min-w-0">
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground block mb-2">
            Ubuntu Gazebo API
          </label>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => setBaseUrl(draft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setBaseUrl(draft);
            }}
            placeholder="http://192.168.1.50:8088"
            spellCheck={false}
            className="font-mono"
          />
        </div>
        <SimButton onClick={() => setBaseUrl(draft)}>
          <Server className="w-3.5 h-3.5" />
          Connect
        </SimButton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SimButton disabled={disabled} onClick={() => void startSimulation()} variant="default">
          <Play className="w-3.5 h-3.5" />
          Start
        </SimButton>
        <SimButton disabled={disabled} onClick={() => void resetSimulation()}>
          <RefreshCcw className="w-3.5 h-3.5" />
          Reset
        </SimButton>
        <SimButton disabled={disabled} onClick={() => void stopSimulation()}>
          <Pause className="w-3.5 h-3.5" />
          Stop
        </SimButton>
        <div className="border border-border bg-secondary/40 h-10 px-3 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
          <span className="text-muted-foreground">State</span>
          <span className={telemetry.connected ? "text-primary" : "text-destructive"}>
            {telemetry.mode}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SimDriveControls() {
  const { speed, setIntent } = useTelemetry();
  const { pending, sendMove, sendCommand } = useSimApi();

  const move = useCallback(
    (action: DriveAction) => {
      const signed = action === "backward" ? -Math.abs(speed) : speed;
      const value = action === "stop" ? 0 : signed;
      setIntent({ action, speed: value });
      void sendMove(action, value);
    },
    [sendMove, setIntent, speed],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (document.activeElement?.tagName === "INPUT") return;
      switch (event.key.toLowerCase()) {
        case "w":
          move("forward");
          break;
        case "s":
          move("backward");
          break;
        case "a":
          move("rotate_left");
          break;
        case "d":
          move("rotate_right");
          break;
        case "q":
          move("strafe_left");
          break;
        case "e":
          move("strafe_right");
          break;
        case " ":
          event.preventDefault();
          move("stop");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  const ControlButton = ({
    icon: Icon,
    action,
    label,
    variant = "secondary",
  }: {
    icon: LucideIcon;
    action: DriveAction;
    label: string;
    variant?: "secondary" | "destructive";
  }) => (
    <Button
      variant={variant}
      disabled={pending}
      className={`h-24 flex flex-col gap-2 relative overflow-hidden font-mono uppercase text-xs tracking-widest ${
        variant === "destructive"
          ? "bg-destructive/20 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          : "bg-secondary/50 border-secondary hover:bg-primary/20 hover:text-primary hover:border-primary/50"
      }`}
      onClick={() => move(action)}
    >
      <Icon className="w-8 h-8" />
      <span>{label}</span>
    </Button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 p-4 bg-card border border-border">
        <ControlButton icon={CornerUpLeft} action="strafe_left" label="VEER-L (Q)" />
        <ControlButton icon={ArrowUp} action="forward" label="FWD (W)" />
        <ControlButton icon={CornerUpRight} action="strafe_right" label="VEER-R (E)" />

        <ControlButton icon={RotateCcw} action="rotate_left" label="ROT-L (A)" />
        <ControlButton icon={Square} action="stop" label="E-STOP (SPC)" variant="destructive" />
        <ControlButton icon={RotateCw} action="rotate_right" label="ROT-R (D)" />

        <div />
        <ControlButton icon={ArrowDown} action="backward" label="REV (S)" />
        <div />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Button
          disabled={pending}
          onClick={() => void sendCommand("solar_deploy", 0)}
          className="h-12 justify-start gap-2 bg-card border border-border font-mono text-[11px] tracking-widest uppercase"
          variant="secondary"
        >
          <Sun className="w-4 h-4 text-primary" />
          Solar Deploy
        </Button>
        <Button
          disabled={pending}
          onClick={() => void sendCommand("camera_snapshot", 0)}
          className="h-12 justify-start gap-2 bg-card border border-border font-mono text-[11px] tracking-widest uppercase"
          variant="secondary"
        >
          <Camera className="w-4 h-4 text-primary" />
          Camera Snapshot
        </Button>
      </div>
    </div>
  );
}

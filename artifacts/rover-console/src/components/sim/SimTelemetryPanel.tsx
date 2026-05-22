import { Activity, Camera, Gauge, Orbit } from "lucide-react";
import { useSimApi, type SimTelemetryState } from "./SimApiContext";

function value(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

function Metric({
  label,
  value: metricValue,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="border border-border bg-secondary/30 px-3 py-2 min-w-0">
      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground truncate">
        {label}
      </div>
      <div className="font-mono text-lg text-foreground tabular-nums leading-tight">
        {metricValue}
        {unit ? <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

function PoseGrid({ telemetry }: { telemetry: SimTelemetryState }) {
  const { pose } = telemetry;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      <Metric label="X" value={value(pose.x)} unit="m" />
      <Metric label="Y" value={value(pose.y)} unit="m" />
      <Metric label="Z" value={value(pose.z)} unit="m" />
      <Metric label="Roll" value={value(pose.roll, 1)} unit="deg" />
      <Metric label="Pitch" value={value(pose.pitch, 1)} unit="deg" />
      <Metric label="Yaw" value={value(pose.yaw, 1)} unit="deg" />
    </div>
  );
}

function WheelGrid({ telemetry }: { telemetry: SimTelemetryState }) {
  const { wheelRpm } = telemetry;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Metric label="Front Left" value={value(wheelRpm.frontLeft, 0)} unit="rpm" />
      <Metric label="Front Right" value={value(wheelRpm.frontRight, 0)} unit="rpm" />
      <Metric label="Rear Left" value={value(wheelRpm.rearLeft, 0)} unit="rpm" />
      <Metric label="Rear Right" value={value(wheelRpm.rearRight, 0)} unit="rpm" />
    </div>
  );
}

export function SimCameraPanel() {
  const { telemetry } = useSimApi();
  const streamUrl = telemetry.cameraStreamUrl;

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Gazebo Camera
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {telemetry.running ? `${value(telemetry.simTimeSec, 1)}s` : "standby"}
        </span>
      </div>
      <div className="aspect-video bg-black flex items-center justify-center">
        {streamUrl ? (
          <img
            src={streamUrl}
            alt="Gazebo camera stream"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Camera Stream Offline
          </div>
        )}
      </div>
    </div>
  );
}

export function SimTelemetryPanel() {
  const { telemetry } = useSimApi();

  return (
    <div className="bg-card border border-border p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground truncate">
            Simulator Telemetry
          </span>
        </div>
        <span
          className={[
            "font-mono text-[10px] tracking-[0.2em] uppercase",
            telemetry.connected ? "text-primary" : "text-destructive",
          ].join(" ")}
        >
          {telemetry.connected ? "online" : "offline"}
        </span>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Orbit className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Pose
          </span>
        </div>
        <PoseGrid telemetry={telemetry} />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Wheel RPM
          </span>
        </div>
        <WheelGrid telemetry={telemetry} />
      </div>

      {telemetry.message ? (
        <div className="border border-border bg-secondary/30 p-3 font-mono text-[10px] text-muted-foreground break-words">
          {telemetry.message}
        </div>
      ) : null}
    </div>
  );
}

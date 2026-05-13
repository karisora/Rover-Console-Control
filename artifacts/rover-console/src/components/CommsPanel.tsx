import { useEffect, useState } from "react";
import { useNetworkRate, formatRate } from "./NetworkRateContext";

// How recently we must have seen activity for a lane to be considered "live".
// Uplink: short window — heartbeat fires every 1s so anything older means the
// bridge is gone. Downlink: 3s — if the rover hasn't acked in 3s we treat
// the link as dead, per spec.
const UPLINK_ACTIVE_WINDOW_MS = 1500;
const DOWNLINK_ACTIVE_WINDOW_MS = 3000;

// Resolve an asset URL relative to the SPA's base path so it works whether the
// app is served at "/" (local bridge) or under a sub-path (cloud preview).
function asset(name: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return `${base}${name}`;
}

interface LaneProps {
  direction: "uplink" | "downlink";
  active: boolean;
  bps: number;
  label: string;
}

// Always-rendered particle slots. We hide them via opacity when the lane is
// idle so that switching speed or going to 0 B/s applies instantly — no
// stale framer-motion loops finishing their cycle, no ghosting after the
// rate drops.
const MAX_PULSES = 5;

function SignalLane({ direction, active, bps, label }: LaneProps) {
  const color = direction === "uplink" ? "rgb(74, 222, 128)" : "rgb(34, 211, 238)";
  const isUp = direction === "uplink";

  // How many of the MAX_PULSES slots should be visible right now. We use the
  // same >= 1 threshold as formatRate's display rounding so the lane stays
  // empty whenever the throughput rounds to "0 B/s".
  const visiblePulses = active && bps >= 1 ? Math.min(MAX_PULSES, Math.max(2, Math.floor(bps / 4))) : 0;
  // Animation period. Faster when busier. When idle we still keep some value
  // so the keyframes don't divide by zero; visibility is gated by opacity.
  const duration = Math.max(0.6, 1.6 - Math.min(bps, 64) / 64);

  return (
    <div className="relative h-10 flex items-center overflow-hidden">
      {/* Static rail */}
      <div
        className="absolute left-0 right-0 h-px top-1/2 -translate-y-1/2 transition-colors duration-200"
        style={{
          background: active
            ? `linear-gradient(${isUp ? "90deg" : "270deg"}, transparent, ${color}66, ${color}, ${color}66, transparent)`
            : "rgba(255,255,255,0.08)",
        }}
      />
      {/* Direction label */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-[0.3em] uppercase pointer-events-none z-10"
        style={{ color: active ? color : "rgba(255,255,255,0.35)" }}>
        {isUp ? "▲" : "▼"} {label}
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] tabular-nums pointer-events-none z-10"
        style={{ color: active ? color : "rgba(255,255,255,0.45)" }}>
        {formatRate(bps)}
      </div>
      {/* Pulses driven by CSS animation so duration changes apply on the next
          iteration. Visibility is controlled by the wrapper's opacity — the
          inner span's keyframes only animate `left`, so the wrapper's
          opacity is never overridden by the animation. This guarantees that
          when the lane is idle (bps < 1) every pulse is fully invisible
          regardless of where its animation cursor is. */}
      {Array.from({ length: MAX_PULSES }).map((_, i) => {
        const visible = i < visiblePulses;
        return (
          <span
            key={i}
            className="absolute inset-y-0 left-0 right-0 pointer-events-none"
            style={{
              opacity: visible ? 1 : 0,
              transition: "opacity 120ms linear",
            }}
          >
            <span
              className="absolute top-1/2 w-2 h-2 rounded-full"
              style={{
                background: color,
                boxShadow: `0 0 8px ${color}, 0 0 16px ${color}88`,
                animationName: isUp ? "comms-pulse-right" : "comms-pulse-left",
                animationDuration: `${duration}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDelay: `${(i * duration) / MAX_PULSES}s`,
                animationPlayState: "running",
                transform: "translateY(-50%)",
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

export function CommsPanel() {
  const { uplinkBps, ackBps, lastUplinkAt, lastAckAt } = useNetworkRate();
  // Downlink in this panel = rover-originated 0x411 acks only. Browser-side
  // polling of /rover/status etc. is intentionally excluded so the lane
  // doesn't blink without an actual rover response.
  const downlinkBps = ackBps;
  const lastDownlinkAt = lastAckAt;
  const [, force] = useState(0);

  // Re-render at 5 Hz so the "active" highlight fades correctly even when the
  // throughput numbers themselves haven't changed.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const now = performance.now();
  // "Active" requires both recent activity AND non-zero current throughput.
  // Without the throughput check, the lane would remain glowing during the
  // recency window even after bps already collapsed to 0.
  const upActive = uplinkBps >= 1 && lastUplinkAt > 0 && now - lastUplinkAt < UPLINK_ACTIVE_WINDOW_MS;
  const downActive = downlinkBps >= 1 && lastDownlinkAt > 0 && now - lastDownlinkAt < DOWNLINK_ACTIVE_WINDOW_MS;

  return (
    <div className="bg-card border border-border p-4">
      <div className="grid grid-cols-[80px_1fr_80px] items-center gap-3">
        {/* Ground station */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="relative w-16 h-16 flex items-center justify-center"
            style={{
              filter: upActive
                ? "drop-shadow(0 0 8px rgb(74, 222, 128)) drop-shadow(0 0 18px rgba(74,222,128,0.5))"
                : "none",
              transition: "filter 200ms",
            }}
          >
            <img
              src={asset("parabola-icon.png")}
              alt="Ground station"
              className="w-14 h-14 object-contain"
              style={{
                filter: "invert(1) brightness(1.05)",
              }}
            />
          </div>
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
            GND STN
          </span>
        </div>

        {/* Lanes */}
        <div className="flex flex-col gap-1 min-w-0 px-2">
          <SignalLane direction="uplink" active={upActive} bps={uplinkBps} label="UPLINK" />
          <SignalLane direction="downlink" active={downActive} bps={downlinkBps} label="DOWNLINK" />
        </div>

        {/* Rover */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="relative w-16 h-16 flex items-center justify-center"
            style={{
              filter: downActive
                ? "drop-shadow(0 0 8px rgb(34, 211, 238)) drop-shadow(0 0 18px rgba(34,211,238,0.5))"
                : "none",
              transition: "filter 200ms",
            }}
          >
            <img
              src={asset("curiosity-icon.png")}
              alt="Rover"
              className="w-14 h-14 object-contain"
              style={{
                filter: "invert(1) brightness(1.05)",
              }}
            />
          </div>
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
            LUMOS-1
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-4 font-mono text-[10px] text-muted-foreground">
        <div className="flex justify-between">
          <span className="tracking-[0.2em] uppercase">↑ Last TX</span>
          <span className="tabular-nums" style={{ color: upActive ? "rgb(74, 222, 128)" : undefined }}>
            {lastUplinkAt > 0 ? `${Math.max(0, Math.round((now - lastUplinkAt) / 100) / 10).toFixed(1)}s` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="tracking-[0.2em] uppercase">↓ Last RX</span>
          <span className="tabular-nums" style={{ color: downActive ? "rgb(34, 211, 238)" : undefined }}>
            {lastDownlinkAt > 0 ? `${Math.max(0, Math.round((now - lastDownlinkAt) / 100) / 10).toFixed(1)}s` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

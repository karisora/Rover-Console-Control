import { useEffect, useState } from "react";
import { useGetRoverStatus, getGetRoverStatusQueryKey } from "@workspace/api-client-react";
import { Wifi, WifiOff, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BridgeSettings } from "./BridgeSettings";
import { ShutdownButton } from "./ShutdownButton";
import { useBridge } from "./BridgeContext";
import { useNetworkRate, formatRate } from "./NetworkRateContext";
import roverIcon from "/rover-icon.png";

function useJstClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    time: `JST-${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

export function StatusHeader() {
  const { effectiveMode } = useBridge();
  const { day, time } = useJstClock();
  const net = useNetworkRate();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 150);
    return () => clearInterval(id);
  }, []);
  const now = performance.now();
  // Arrows must light up only when there is actually measurable traffic
  // *right now*, not just because we saw a packet at some point. The bps
  // value is what we render next to the arrow, so we gate on the same
  // rounding threshold that formatRate uses (>= 1 byte/s display as "1 B/s",
  // anything below that displays as "0 B/s" and should stay dim).
  const upActive = net.uplinkBps >= 1 && now - net.lastUplinkAt < 1500;
  // Downlink uses the ack-only counter so browser-side HTTP polling can't
  // make the arrow glow.
  const downActive = net.ackBps >= 1 && now - net.lastAckAt < 3000;
  void tick;
  const { data, isError, isLoading } = useGetRoverStatus({
    query: {
      queryKey: getGetRoverStatusQueryKey(),
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
    },
  });

  const connected = !!data?.connected && !isError;
  const host = data?.host ?? "192.168.4.1";
  const port = data?.port ?? 5000;
  const lastChecked = data?.lastCheckedAt
    ? new Date(data.lastCheckedAt).toLocaleTimeString(undefined, { hour12: false })
    : "—";

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img src={roverIcon} alt="Rover" className="w-10 h-10 object-contain" />
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                Mission Control
              </div>
              <div className="font-sans text-base font-semibold tracking-wide">
                ROVER CONSOLE / LUMOS-1
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono text-xs">
          <Telemetry label="LINK">
            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                {connected ? (
                  <motion.span
                    key="on"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="relative flex w-2.5 h-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 font-semibold">WIFI CONNECTED</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="off"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive/80" />
                    <WifiOff className="w-4 h-4 text-destructive" />
                    <span className="text-destructive font-semibold">
                      {isLoading ? "LINKING…" : "NO SIGNAL"}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </Telemetry>

          <Telemetry label="HOST">
            <span className="text-foreground">{host}:{port}</span>
          </Telemetry>

          <Telemetry label="LINK RATE">
            <div className="flex items-center gap-3 tabular-nums">
              <span
                className={`flex items-center gap-1 transition-colors ${
                  upActive
                    ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                    : "text-muted-foreground/60"
                }`}
                title="Uplink (browser → server)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span className="text-[11px]">{formatRate(net.uplinkBps)}</span>
              </span>
              <span
                className={`flex items-center gap-1 transition-colors ${
                  downActive
                    ? "text-cyan-300 drop-shadow-[0_0_6px_rgba(103,232,249,0.9)]"
                    : "text-muted-foreground/60"
                }`}
                title="Downlink (server → browser)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span className="text-[11px]">{formatRate(net.ackBps)}</span>
              </span>
            </div>
          </Telemetry>

          <Telemetry label="LAST PING">
            <span className="text-muted-foreground">{lastChecked}</span>
          </Telemetry>

          <Telemetry label="DAY">
            <span className="text-foreground tabular-nums">{day}</span>
          </Telemetry>

          <Telemetry label="TIME">
            <span className="text-foreground tabular-nums">{time}</span>
          </Telemetry>

          <BridgeSettings />
          <ShutdownButton />
        </div>
      </div>
      {effectiveMode === "cloud" && (
        <div className="bg-destructive/10 border-t border-destructive/30 px-6 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-destructive/90 text-center">
          CLOUD MODE · cannot reach 192.168.4.1 · run the local bridge and configure it →
        </div>
      )}
    </header>
  );
}

function Telemetry({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">{label}</span>
      <span className="text-xs">{children}</span>
    </div>
  );
}

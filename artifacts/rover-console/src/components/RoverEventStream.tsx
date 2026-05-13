import { useEffect } from "react";
import { useTelemetry } from "./TelemetryContext";
import { useBridge } from "./BridgeContext";
import { useNetworkRate } from "./NetworkRateContext";

interface RoverEvent {
  type: "ack" | "rx" | "tx";
  payload: string;
  bytes?: number;
  at: string;
}

// Subscribes to the bridge's /api/rover/events SSE stream and pipes incoming
// messages into the telemetry log. Renders nothing.
export function RoverEventStream() {
  const { addLog } = useTelemetry();
  const { bridgeUrl, servedByBridge } = useBridge();
  const { addUplinkBytes, addDownlinkBytes, addAckBytes } = useNetworkRate();

  useEffect(() => {
    // Only meaningful when we have a local bridge to talk to. The cloud API
    // server has no UDP socket so it can't deliver these events.
    if (!servedByBridge && !bridgeUrl) return;
    const base = (bridgeUrl || "").replace(/\/+$/, "");
    const url = `${base}/api/rover/events`;
    let es: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (closed) return;
      try {
        es = new EventSource(url);
      } catch {
        retryTimer = setTimeout(open, 2000);
        return;
      }
      es.onmessage = (ev) => {
        try {
          const data: RoverEvent = JSON.parse(ev.data);
          const n = data.bytes ?? (data.payload ? data.payload.length : 0);
          if (data.type === "tx") {
            // Outgoing UDP from the bridge (heartbeat, raw packets, drive
            // moves) — count toward uplink so the LINK RATE indicator shows
            // the real on-the-wire traffic, not just browser→bridge HTTP.
            addUplinkBytes(n);
          } else if (data.type === "ack") {
            // 0x411 ack from the rover. The Comms panel uses the
            // ack-specific counter so it only lights up for real rover
            // responses (not browser-side polling). Also reflected in the
            // generic downlink counter for the header LINK RATE.
            addAckBytes(n);
            addDownlinkBytes(n);
          } else {
            // Other rover-originated frames: surface in the telemetry log
            // but do NOT count toward the Comms downlink lane (per spec,
            // only 0x411 means a real rover ack).
            addLog(`RX ${data.payload}`, "info");
          }
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        if (closed) return;
        try { es?.close(); } catch {}
        es = null;
        retryTimer = setTimeout(open, 2000);
      };
    };

    open();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      try { es?.close(); } catch {}
    };
  }, [bridgeUrl, servedByBridge, addLog, addUplinkBytes, addDownlinkBytes, addAckBytes]);

  return null;
}

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface Sample {
  t: number;
  bytes: number;
}

interface NetworkRate {
  uplinkBps: number;
  downlinkBps: number;
  lastUplinkAt: number;
  lastDownlinkAt: number;
  // Rover-originated downlink, restricted to 0x411 ack frames. Used by the
  // Comms panel so its downlink lane only lights up when the rover is
  // actually responding (not when the browser polls /rover/status etc.).
  ackBps: number;
  lastAckAt: number;
  // Allows external sources (e.g. SSE-driven heartbeat events from the
  // bridge) to contribute to the link-rate counters as if they were ordinary
  // fetch traffic.
  addUplinkBytes: (bytes: number) => void;
  addDownlinkBytes: (bytes: number) => void;
  addAckBytes: (bytes: number) => void;
}

const NetworkRateContext = createContext<NetworkRate | undefined>(undefined);

const WINDOW_MS = 1000;

function rateOf(samples: Sample[], now: number): number {
  const cutoff = now - WINDOW_MS;
  let sum = 0;
  for (const s of samples) if (s.t >= cutoff) sum += s.bytes;
  return sum; // bytes per second (window is 1s)
}

function bodySize(body: BodyInit | null | undefined): number {
  if (!body) return 0;
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).length;
  return 0;
}

export function NetworkRateProvider({ children }: { children: React.ReactNode }) {
  const upRef = useRef<Sample[]>([]);
  const downRef = useRef<Sample[]>([]);
  const ackRef = useRef<Sample[]>([]);
  const lastUpRef = useRef(0);
  const lastDownRef = useRef(0);
  const lastAckRef = useRef(0);
  const addUplinkBytes = useRef((bytes: number) => {
    if (bytes <= 0) return;
    upRef.current.push({ t: performance.now(), bytes });
    lastUpRef.current = performance.now();
  }).current;
  const addDownlinkBytes = useRef((bytes: number) => {
    if (bytes <= 0) return;
    downRef.current.push({ t: performance.now(), bytes });
    lastDownRef.current = performance.now();
  }).current;
  const addAckBytes = useRef((bytes: number) => {
    if (bytes <= 0) return;
    ackRef.current.push({ t: performance.now(), bytes });
    lastAckRef.current = performance.now();
  }).current;

  const [rate, setRate] = useState<NetworkRate>({
    uplinkBps: 0,
    downlinkBps: 0,
    lastUplinkAt: 0,
    lastDownlinkAt: 0,
    ackBps: 0,
    lastAckAt: 0,
    addUplinkBytes,
    addDownlinkBytes,
    addAckBytes,
  });

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Count uplink bytes from body (best-effort).
      let upBytes = 0;
      if (init?.body) upBytes = bodySize(init.body);
      else if (input instanceof Request && input.body) {
        try {
          const cloned = input.clone();
          const buf = await cloned.arrayBuffer();
          upBytes = buf.byteLength;
        } catch {
          /* ignore */
        }
      }
      if (upBytes > 0) {
        upRef.current.push({ t: performance.now(), bytes: upBytes });
        lastUpRef.current = performance.now();
      }

      const res = await originalFetch(input as RequestInfo, init);
      // Count downlink bytes via cloned response.
      try {
        const cloned = res.clone();
        cloned
          .arrayBuffer()
          .then((buf) => {
            if (buf.byteLength > 0) {
              downRef.current.push({ t: performance.now(), bytes: buf.byteLength });
              lastDownRef.current = performance.now();
            }
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const cutoff = now - WINDOW_MS;
      upRef.current = upRef.current.filter((s) => s.t >= cutoff);
      downRef.current = downRef.current.filter((s) => s.t >= cutoff);
      ackRef.current = ackRef.current.filter((s) => s.t >= cutoff);
      setRate({
        uplinkBps: rateOf(upRef.current, now),
        downlinkBps: rateOf(downRef.current, now),
        lastUplinkAt: lastUpRef.current,
        lastDownlinkAt: lastDownRef.current,
        ackBps: rateOf(ackRef.current, now),
        lastAckAt: lastAckRef.current,
        addUplinkBytes,
        addDownlinkBytes,
        addAckBytes,
      });
    }, 200);
    return () => clearInterval(id);
  }, [addUplinkBytes, addDownlinkBytes, addAckBytes]);

  const value = useMemo(() => rate, [rate]);
  return <NetworkRateContext.Provider value={value}>{children}</NetworkRateContext.Provider>;
}

export function useNetworkRate(): NetworkRate {
  const ctx = useContext(NetworkRateContext);
  if (!ctx) throw new Error("useNetworkRate must be used within NetworkRateProvider");
  return ctx;
}

export function formatRate(bps: number): string {
  if (bps <= 0) return "0 B/s";
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

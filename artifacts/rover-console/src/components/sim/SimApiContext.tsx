import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTelemetry, type DriveAction } from "@/components/TelemetryContext";

const STORAGE_KEY = "rover-sim-api-url";

export interface SimPose {
  x: number;
  y: number;
  z: number;
  roll: number;
  pitch: number;
  yaw: number;
}

export interface SimWheelRpm {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
}

export interface SimTelemetryState {
  connected: boolean;
  running: boolean;
  mode: "offline" | "idle" | "launching" | "running" | "error";
  simTimeSec: number;
  pose: SimPose;
  wheelRpm: SimWheelRpm;
  cameraStreamUrl: string | null;
  message: string | null;
  lastUpdatedAt: string | null;
}

interface SimApiContextType {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  telemetry: SimTelemetryState;
  pending: boolean;
  startSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
  resetSimulation: () => Promise<void>;
  sendMove: (action: DriveAction, speed: number) => Promise<void>;
  sendCommand: (command: string, value?: number) => Promise<void>;
}

const defaultPose: SimPose = { x: 0, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0 };
const defaultWheelRpm: SimWheelRpm = {
  frontLeft: 0,
  frontRight: 0,
  rearLeft: 0,
  rearRight: 0,
};

const defaultTelemetry: SimTelemetryState = {
  connected: false,
  running: false,
  mode: "offline",
  simTimeSec: 0,
  pose: defaultPose,
  wheelRpm: defaultWheelRpm,
  cameraStreamUrl: null,
  message: null,
  lastUpdatedAt: null,
};

const Ctx = createContext<SimApiContextType | undefined>(undefined);

function defaultApiUrl(): string {
  if (typeof window === "undefined") return "";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return "";
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function coercePose(value: unknown): SimPose {
  const pose = (value && typeof value === "object" ? value : {}) as Partial<SimPose>;
  return {
    x: Number(pose.x ?? 0),
    y: Number(pose.y ?? 0),
    z: Number(pose.z ?? 0),
    roll: Number(pose.roll ?? 0),
    pitch: Number(pose.pitch ?? 0),
    yaw: Number(pose.yaw ?? 0),
  };
}

function coerceWheelRpm(value: unknown): SimWheelRpm {
  const wheels = (value && typeof value === "object" ? value : {}) as Partial<SimWheelRpm>;
  return {
    frontLeft: Number(wheels.frontLeft ?? 0),
    frontRight: Number(wheels.frontRight ?? 0),
    rearLeft: Number(wheels.rearLeft ?? 0),
    rearRight: Number(wheels.rearRight ?? 0),
  };
}

function mergeTelemetry(
  prev: SimTelemetryState,
  data: Partial<SimTelemetryState> & Record<string, unknown>,
  baseUrl: string,
): SimTelemetryState {
  const cameraStreamUrl =
    typeof data.cameraStreamUrl === "string"
      ? data.cameraStreamUrl.startsWith("http")
        ? data.cameraStreamUrl
        : `${baseUrl}${data.cameraStreamUrl.startsWith("/") ? "" : "/"}${data.cameraStreamUrl}`
      : baseUrl
      ? `${baseUrl}/api/sim/camera/stream`
      : null;

  return {
    ...prev,
    connected: Boolean(data.connected ?? prev.connected),
    running: Boolean(data.running ?? prev.running),
    mode: (data.mode as SimTelemetryState["mode"]) ?? prev.mode,
    simTimeSec: Number(data.simTimeSec ?? prev.simTimeSec),
    pose: data.pose ? coercePose(data.pose) : prev.pose,
    wheelRpm: data.wheelRpm ? coerceWheelRpm(data.wheelRpm) : prev.wheelRpm,
    cameraStreamUrl,
    message: typeof data.message === "string" ? data.message : prev.message,
    lastUpdatedAt:
      typeof data.lastUpdatedAt === "string" ? data.lastUpdatedAt : new Date().toISOString(),
  };
}

export function SimApiProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState(defaultApiUrl);
  const [telemetry, setTelemetry] = useState<SimTelemetryState>(defaultTelemetry);
  const [pending, setPending] = useState(false);
  const { addLog } = useTelemetry();

  const setBaseUrl = useCallback((url: string) => {
    const normalized = normalizeUrl(url);
    setBaseUrlState(normalized);
    if (typeof window !== "undefined") {
      if (normalized) window.localStorage.setItem(STORAGE_KEY, normalized);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    setTelemetry({ ...defaultTelemetry, cameraStreamUrl: normalized ? `${normalized}/api/sim/camera/stream` : null });
  }, []);

  const apiFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      if (!baseUrl) {
        throw new Error("SIM API URL is not configured");
      }
      const headers = new Headers(init?.headers);
      headers.set("content-type", "application/json");
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
    [baseUrl],
  );

  const runRequest = useCallback(
    async (label: string, path: string, body?: unknown) => {
      setPending(true);
      try {
        const data = await apiFetch<Record<string, unknown>>(path, {
          method: "POST",
          body: body ? JSON.stringify(body) : "{}",
        });
        setTelemetry((prev) => mergeTelemetry(prev, data, baseUrl));
        addLog(`SIM ${label}: ${JSON.stringify(body ?? {})}`, "sent");
      } catch (error) {
        addLog(`SIM ${label} FAILED: ${(error as Error).message}`, "failed");
        setTelemetry((prev) => ({
          ...prev,
          connected: false,
          mode: "error",
          message: (error as Error).message,
          lastUpdatedAt: new Date().toISOString(),
        }));
      } finally {
        setPending(false);
      }
    },
    [addLog, apiFetch, baseUrl],
  );

  useEffect(() => {
    if (!baseUrl) return;
    let closed = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const data = await apiFetch<Record<string, unknown>>("/api/sim/status");
        if (!closed) setTelemetry((prev) => mergeTelemetry(prev, data, baseUrl));
      } catch (error) {
        if (!closed) {
          setTelemetry((prev) => ({
            ...prev,
            connected: false,
            mode: "offline",
            message: (error as Error).message,
            lastUpdatedAt: new Date().toISOString(),
          }));
        }
      }
    };

    poll();
    timer = setInterval(poll, 3000);
    return () => {
      closed = true;
      if (timer) clearInterval(timer);
    };
  }, [apiFetch, baseUrl]);

  useEffect(() => {
    if (!baseUrl) return;
    const es = new EventSource(`${baseUrl}/api/sim/events`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        const eventType = typeof data.type === "string" ? data.type : "telemetry";
        if (eventType === "log" && typeof data.message === "string") {
          addLog(`SIM ${data.message}`, "info");
          return;
        }
        setTelemetry((prev) =>
          mergeTelemetry(prev, { ...data, connected: true } as Partial<SimTelemetryState>, baseUrl),
        );
      } catch {
        /* ignore malformed simulator events */
      }
    };

    es.onerror = () => {
      setTelemetry((prev) => ({
        ...prev,
        connected: false,
        message: "Simulator event stream disconnected",
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

    return () => es.close();
  }, [addLog, baseUrl]);

  const startSimulation = useCallback(
    () =>
      runRequest("start", "/api/sim/session/start", {
        world: "home_rover_world",
        model: "lumos1",
        reset: true,
      }),
    [runRequest],
  );

  const stopSimulation = useCallback(
    () => runRequest("stop", "/api/sim/session/stop"),
    [runRequest],
  );

  const resetSimulation = useCallback(
    () => runRequest("reset", "/api/sim/session/reset"),
    [runRequest],
  );

  const sendMove = useCallback(
    (action: DriveAction, speed: number) =>
      runRequest("move", "/api/sim/move", {
        action,
        speed: action === "stop" ? 0 : speed,
      }),
    [runRequest],
  );

  const sendCommand = useCallback(
    (command: string, value = 0) =>
      runRequest("command", "/api/sim/command", {
        command,
        value,
      }),
    [runRequest],
  );

  const value = useMemo<SimApiContextType>(
    () => ({
      baseUrl,
      setBaseUrl,
      telemetry,
      pending,
      startSimulation,
      stopSimulation,
      resetSimulation,
      sendMove,
      sendCommand,
    }),
    [
      baseUrl,
      pending,
      resetSimulation,
      sendCommand,
      sendMove,
      setBaseUrl,
      startSimulation,
      stopSimulation,
      telemetry,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimApi() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSimApi must be used within SimApiProvider");
  return value;
}

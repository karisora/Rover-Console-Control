import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface RoverParams {
  wheelBase: number;      // mm — lateral distance between left and right wheels
  wheelRadius: number;    // mm — rolling radius
  maxSpeed: number;       // 0-100 PWM units (maps to 100%)
  innerRatio: number;     // 0-1 inner wheel ratio during VEER
  veerThrottle: number;   // 0-100 speed used for VEER simulation
  rotateThrottle: number; // 0-100 speed used for ROTATE simulation
}

const DEFAULTS: RoverParams = {
  wheelBase: 250,    // mm — realistic for a ~10 kg chassis (e.g. ispace RESILIENCE class)
  wheelRadius: 65,   // mm — ~130 mm diameter wheel for soft lunar regolith
  maxSpeed: 60,      // PWM — conservative top speed (lunar comms delay safety margin)
  innerRatio: 0.3,
  veerThrottle: 50,
  rotateThrottle: 40,
};

const STORAGE_KEY = "rover-params-v1";

function load(): RoverParams {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

interface Ctx {
  params: RoverParams;
  setParam: <K extends keyof RoverParams>(key: K, value: RoverParams[K]) => void;
  reset: () => void;
}

const Context = createContext<Ctx | null>(null);

export function RoverParamsProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<RoverParams>(load);

  const setParam = useCallback(<K extends keyof RoverParams>(key: K, value: RoverParams[K]) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setParams(DEFAULTS);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return <Context.Provider value={{ params, setParam, reset }}>{children}</Context.Provider>;
}

export function useRoverParams() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useRoverParams must be used inside RoverParamsProvider");
  return ctx;
}

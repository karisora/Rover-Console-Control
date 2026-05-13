import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface BridgeContextType {
  bridgeUrl: string;
  setBridgeUrl: (url: string) => void;
  effectiveMode: "bridge" | "cloud";
  servedByBridge: boolean;
}

const STORAGE_KEY = "rover-bridge-url";
const Ctx = createContext<BridgeContextType | undefined>(undefined);

function isLoopbackHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.startsWith("127.") ||
    host === "[::1]" ||
    host === "::1"
  );
}

function detectServedByBridge(): boolean {
  if (typeof window === "undefined") return false;
  return isLoopbackHost(window.location.hostname);
}

function applyBaseUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed) {
    setBaseUrl(trimmed);
  } else {
    setBaseUrl(null);
  }
}

export function BridgeProvider({ children }: { children: React.ReactNode }) {
  const servedByBridge = detectServedByBridge();
  const [bridgeUrl, setBridgeUrlState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  });
  const qc = useQueryClient();

  useEffect(() => {
    applyBaseUrl(bridgeUrl);
  }, [bridgeUrl]);

  const setBridgeUrl = (url: string) => {
    const trimmed = url.trim();
    setBridgeUrlState(trimmed);
    if (typeof window !== "undefined") {
      if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    qc.invalidateQueries();
  };

  const value = useMemo<BridgeContextType>(
    () => ({
      bridgeUrl,
      setBridgeUrl,
      effectiveMode: bridgeUrl || servedByBridge ? "bridge" : "cloud",
      servedByBridge,
    }),
    [bridgeUrl, servedByBridge],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBridge() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBridge must be used within BridgeProvider");
  return v;
}

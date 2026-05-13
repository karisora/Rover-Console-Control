import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface TelemetryEntry {
  id: string;
  timestamp: string;
  payload: string;
  type: 'sent' | 'failed' | 'info';
}

export type DriveAction =
  | 'forward'
  | 'backward'
  | 'rotate_left'
  | 'rotate_right'
  | 'strafe_left'
  | 'strafe_right'
  | 'stop';

export interface DriveIntent {
  action: DriveAction;
  speed: number;
}

interface TelemetryContextType {
  logs: TelemetryEntry[];
  addLog: (payload: string, type: TelemetryEntry['type']) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  intent: DriveIntent;
  setIntent: (intent: DriveIntent) => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<TelemetryEntry[]>([]);
  const [speed, setSpeed] = useState<number>(30);
  const [intent, setIntent] = useState<DriveIntent>({ action: 'stop', speed: 0 });

  const addLog = useCallback((payload: string, type: TelemetryEntry['type']) => {
    setLogs((prev) => {
      const newLogs = [
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          payload,
          type,
        },
        ...prev,
      ].slice(0, 200);
      return newLogs;
    });
  }, []);

  const value = useMemo(
    () => ({ logs, addLog, speed, setSpeed, intent, setIntent }),
    [logs, addLog, speed, intent],
  );

  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (context === undefined) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}

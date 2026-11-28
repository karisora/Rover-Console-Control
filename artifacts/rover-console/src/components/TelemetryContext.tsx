import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { sendRoverMove } from '@workspace/api-client-react';

const SPEED_UPDATE_INTERVAL_MS = 100;
const DRIVE_REQUEST_TIMEOUT_MS = 1000;

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
  drive: (action: DriveAction) => void;
  cancelSpeedUpdate: () => void;
  intent: DriveIntent;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<TelemetryEntry[]>([]);
  const [speed, setSpeedValue] = useState(30);
  const [intent, setIntent] = useState<DriveIntent>({ action: 'stop', speed: 0 });
  const throttle = useRef(speed);
  const activeAction = useRef<DriveAction>('stop');
  const speedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMoves = useRef<DriveIntent[]>([]);
  const sendingMove = useRef(false);

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

  const sendPendingMoves = useCallback(async () => {
    if (sendingMove.current) return;
    sendingMove.current = true;
    try {
      let move: DriveIntent | undefined;
      while ((move = pendingMoves.current.shift())) {
        const payload = JSON.stringify(move);
        try {
          const response = await sendRoverMove(move, {
            signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
          });
          if (!response.ok) throw new Error(response.error ?? 'Drive command failed');
          addLog(payload, 'sent');
        } catch {
          addLog(`FAILED: ${payload}`, 'failed');
        }
      }
    } finally {
      sendingMove.current = false;
    }
  }, [addLog]);

  const cancelSpeedUpdate = useCallback(() => {
    if (speedTimer.current !== null) {
      clearTimeout(speedTimer.current);
      speedTimer.current = null;
    }
  }, []);

  useEffect(() => cancelSpeedUpdate, [cancelSpeedUpdate]);

  const drive = useCallback((action: DriveAction) => {
    cancelSpeedUpdate();
    const direction = throttle.current === 0 ? 'stop' : action;
    // Straight and curved forward motion both use the rover's negative wheel polarity.
    const drivesForward = direction === 'forward' || direction === 'strafe_left' || direction === 'strafe_right';
    const signedSpeed = drivesForward ? -throttle.current : throttle.current;
    const move = { action: direction, speed: direction === 'stop' ? 0 : signedSpeed };
    activeAction.current = direction;
    setIntent(move);

    // Complete the current four-wheel request before sending the next one.
    // Keep a pending stop ahead of any later direction and discard obsolete speeds.
    if (direction === 'stop') {
      pendingMoves.current = [move];
    } else {
      const nextIndex = pendingMoves.current[0]?.action === 'stop' ? 1 : 0;
      pendingMoves.current[nextIndex] = move;
    }
    void sendPendingMoves();
  }, [cancelSpeedUpdate, sendPendingMoves]);

  const setSpeed = useCallback((nextSpeed: number) => {
    throttle.current = nextSpeed;
    setSpeedValue(nextSpeed);
    if (activeAction.current === 'stop') return;
    if (nextSpeed === 0) {
      drive('stop');
      return;
    }
    if (speedTimer.current === null) {
      speedTimer.current = setTimeout(() => drive(activeAction.current), SPEED_UPDATE_INTERVAL_MS);
    }
  }, [drive]);

  const value = useMemo(
    () => ({ logs, addLog, speed, setSpeed, drive, cancelSpeedUpdate, intent }),
    [logs, addLog, speed, setSpeed, drive, cancelSpeedUpdate, intent],
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

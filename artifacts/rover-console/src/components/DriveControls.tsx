import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useSendRoverMove, useSendRoverCommand } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useTelemetry } from "./TelemetryContext";
import { ArrowUp, ArrowDown, RotateCw, RotateCcw, CornerUpLeft, CornerUpRight, Square, Sun, type LucideIcon } from "lucide-react";
import type { RoverMoveAction } from "@workspace/api-client-react";

export function DriveControls() {
  const sendMove    = useSendRoverMove();
  const sendCommand = useSendRoverCommand();
  const { addLog, speed, setIntent } = useTelemetry();
  const activeAction = useRef<RoverMoveAction | null>(null);
  const mutateFnRef = useRef(sendMove.mutate);
  mutateFnRef.current = sendMove.mutate;

  // Solar panel state: null = unknown, "deployed" | "folded"
  const [solarState, setSolarState] = useState<"deployed" | "folded" | null>(null);

  const handleAction = useCallback((action: RoverMoveAction) => {
    activeAction.current = action;
    const signed = action === 'backward' ? -Math.abs(speed) : speed;
    const payload = { action, speed: action === 'stop' ? 0 : signed };
    if (action !== 'spell') setIntent({ action, speed: signed });
    mutateFnRef.current(
      { data: payload },
      {
        onSuccess: () => addLog(JSON.stringify(payload), 'sent'),
        onError:   () => addLog(`FAILED: ${JSON.stringify(payload)}`, 'failed'),
      }
    );
  }, [speed, addLog, setIntent]);

  const handleStop = useCallback(() => {
    activeAction.current = 'stop';
    setIntent({ action: 'stop', speed: 0 });
    mutateFnRef.current(
      { data: { action: 'stop', speed: 0 } },
      {
        onSuccess: () => addLog('{"action":"stop","speed":0}', 'sent'),
        onError:   () => addLog('FAILED: {"action":"stop"}',   'failed'),
      }
    );
  }, [addLog, setIntent]);

  const handleSolar = useCallback((deploy: boolean) => {
    const id    = deploy ? "0x404" : "0x405";
    const label = deploy ? "solar_deploy" : "solar_fold";
    sendCommand.mutate(
      { data: { id, value: 0 } },
      {
        onSuccess: () => {
          setSolarState(deploy ? "deployed" : "folded");
          addLog(`{"action":"${label}","sent":"${id},0"}`, 'sent');
        },
        onError: () => addLog(`FAILED: ${label}`, 'failed'),
      }
    );
  }, [sendCommand, addLog]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (document.activeElement?.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case 'w': handleAction('forward');      break;
        case 's': handleAction('backward');     break;
        case 'a': handleAction('rotate_left');  break;
        case 'd': handleAction('rotate_right'); break;
        case 'q': handleAction('strafe_left');  break;
        case 'e': handleAction('strafe_right'); break;
        case ' ': e.preventDefault(); handleStop(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction, handleStop]);

  const ControlButton = ({
    icon: Icon,
    action,
    label,
    variant = "secondary",
  }: {
    icon: LucideIcon;
    action: RoverMoveAction;
    label: string;
    variant?: "secondary" | "destructive" | "default";
  }) => (
    <Button
      variant={variant}
      className={`h-24 flex flex-col gap-2 relative overflow-hidden font-mono uppercase text-xs tracking-widest ${
        variant === 'destructive'
          ? 'bg-destructive/20 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground'
          : 'bg-secondary/50 border-secondary hover:bg-primary/20 hover:text-primary hover:border-primary/50'
      }`}
      onClick={() => (action === 'stop' ? handleStop() : handleAction(action))}
    >
      <Icon className="w-8 h-8" />
      <span>{label}</span>
    </Button>
  );

  const isDeployed = solarState === "deployed";
  const isFolded   = solarState === "folded";

  return (
    <div className="flex flex-col gap-2">
      {/* ── Drive controls ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 p-4 bg-card border border-border">
        <ControlButton icon={CornerUpLeft}  action="strafe_left"  label="VEER-L (Q)" />
        <ControlButton icon={ArrowUp}       action="forward"      label="FWD (W)" />
        <ControlButton icon={CornerUpRight} action="strafe_right" label="VEER-R (E)" />

        <ControlButton icon={RotateCcw}     action="rotate_left"  label="ROT-L (A)" />
        <ControlButton icon={Square}        action="stop"         label="E-STOP (SPC)" variant="destructive" />
        <ControlButton icon={RotateCw}      action="rotate_right" label="ROT-R (D)" />

        <div />
        <ControlButton icon={ArrowDown}     action="backward"     label="REV (S)" />
        <div />
      </div>

      {/* ── Solar panel controls ─────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-card border border-border flex items-center gap-4">
        {/* Label */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Sun className={`w-4 h-4 ${isDeployed ? 'text-yellow-400' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary">Solar Panel</p>
            <p className="font-mono text-[9px] text-muted-foreground">
              {solarState === "deployed" ? "DEPLOYED"
               : solarState === "folded"  ? "FOLDED"
               :                            "UNKNOWN"}
            </p>
          </div>
        </div>

        {/* Status LED */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isDeployed ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]'
          : isFolded  ? 'bg-slate-500'
          :             'bg-slate-700 border border-slate-600'
        }`} />

        <div className="flex-1" />

        {/* Fold button */}
        <button
          onClick={() => handleSolar(false)}
          disabled={sendCommand.isPending || isFolded}
          className={[
            "flex items-center gap-2 px-4 py-2 rounded border font-mono text-[11px] tracking-widest uppercase transition-all",
            isFolded
              ? "border-slate-600 bg-slate-700/40 text-slate-500 cursor-default"
              : "border-slate-500 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:border-slate-400 hover:text-slate-100",
            sendCommand.isPending ? "opacity-50" : "",
          ].join(" ")}
        >
          <span className="text-base leading-none">🔲</span>
          FOLD
          <span className="font-mono text-[8px] text-slate-500 ml-1">0x405,0</span>
        </button>

        {/* Deploy button */}
        <button
          onClick={() => handleSolar(true)}
          disabled={sendCommand.isPending || isDeployed}
          className={[
            "flex items-center gap-2 px-4 py-2 rounded border font-mono text-[11px] tracking-widest uppercase transition-all",
            isDeployed
              ? "border-yellow-600/60 bg-yellow-500/10 text-yellow-600 cursor-default"
              : "border-yellow-500/60 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-400",
            sendCommand.isPending ? "opacity-50" : "",
          ].join(" ")}
        >
          <Sun className="w-3.5 h-3.5" />
          DEPLOY
          <span className="font-mono text-[8px] text-yellow-600/60 ml-1">0x404,0</span>
        </button>
      </div>
    </div>
  );
}

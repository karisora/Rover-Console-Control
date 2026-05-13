import { useState } from "react";
import { useSendRoverCommand } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Code2 } from "lucide-react";
import { useTelemetry } from "./TelemetryContext";

export function CommandPanel() {
  const send = useSendRoverCommand();
  const { addLog } = useTelemetry();
  const [id, setId] = useState("0x400");
  const [value, setValue] = useState("0");

  const onSend = () => {
    const v = parseInt(value, 10);
    if (!/^0x[0-9a-fA-F]+$/.test(id) || Number.isNaN(v)) {
      addLog(`INVALID INPUT: ${id},${value}`, "failed");
      return;
    }
    send.mutate(
      { data: { id, value: v } },
      {
        onSuccess: () => addLog(`${id},${v}`, "sent"),
        onError: () => addLog(`FAILED ${id},${v}`, "failed"),
      },
    );
  };

  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Code2 className="w-4 h-4 text-primary" />
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          Raw Packet · UDP
        </span>
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex flex-col gap-1 w-32">
          <label className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
            Device ID
          </label>
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            spellCheck={false}
            className="font-mono h-10"
            placeholder="0x400"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
            Value (signed int)
          </label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            className="font-mono h-10"
            placeholder="0"
          />
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <Button
            onClick={onSend}
            disabled={send.isPending}
            className="h-10 font-mono uppercase text-xs tracking-widest px-4"
          >
            <Send className="w-4 h-4 mr-2" /> Transmit
          </Button>
        </div>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground mt-2">
        Wheels: 0x400 FL · 0x401 FR · 0x402 RL · 0x403 RR · Spell: 0x450
      </p>
    </div>
  );
}

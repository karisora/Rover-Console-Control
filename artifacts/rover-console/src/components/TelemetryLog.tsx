import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";
import { useTelemetry } from "./TelemetryContext";
import { AnimatePresence, motion } from "framer-motion";

export function TelemetryLog() {
  const { logs } = useTelemetry();

  return (
    <div className="bg-card border border-border h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Packet Stream
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {logs.length.toString().padStart(3, "0")} / 200
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="font-mono text-xs p-3 space-y-1">
          {logs.length === 0 ? (
            <div className="text-muted-foreground/60 italic px-1 py-2">
              [awaiting transmission…]
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex gap-3 leading-relaxed"
                >
                  <span className="text-muted-foreground/70 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString(undefined, {
                      hour12: false,
                    })}
                    .{String(new Date(log.timestamp).getMilliseconds()).padStart(3, "0")}
                  </span>
                  <span
                    className={
                      log.type === "failed"
                        ? "text-destructive"
                        : log.type === "info"
                        ? "text-accent"
                        : "text-primary"
                    }
                  >
                    {log.type === "failed" ? "✗" : log.type === "info" ? "›" : "›"}
                  </span>
                  <span
                    className={
                      log.type === "failed"
                        ? "text-destructive/90 break-all"
                        : "text-foreground/90 break-all"
                    }
                  >
                    {log.payload}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

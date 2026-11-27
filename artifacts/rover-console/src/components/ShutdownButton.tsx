import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Power } from "lucide-react";
import { useBridge } from "./BridgeContext";

export function ShutdownButton({ onShutdown }: { onShutdown: (target: string) => void }) {
  const { servedByBridge, bridgeUrl } = useBridge();

  // Only meaningful when running inside the local bridge (.app or `node rover-bridge.mjs`).
  if (!servedByBridge) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-[10px] tracking-[0.2em] uppercase gap-2 h-9 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
          title="Shut down the local bridge and quit"
        >
          <Power className="w-3.5 h-3.5" />
          <span>SHUTDOWN</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono tracking-widest uppercase text-sm">
            Shut Down Rover Console?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed">
            This will stop communication with the rover and shut down the local bridge.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="font-mono text-xs uppercase tracking-widest">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onShutdown(`${bridgeUrl.replace(/\/+$/, "")}/api/shutdown`)}
            className="font-mono text-xs uppercase tracking-widest bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Shut Down
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ShutdownScreen({ target }: { target: string }) {
  const [status, setStatus] = useState<"stopping" | "stopped" | "unconfirmed">("stopping");

  useEffect(() => {
    async function stopBridge() {
      try {
        const response = await fetch(target, { method: "POST" });
        if (response.ok) {
          setStatus("stopped");
          if (window.matchMedia("(display-mode: standalone)").matches) window.close();
          return;
        }
      } catch {
        // Keep the console quiescent if the bridge is already unreachable.
      }
      setStatus("unconfirmed");
    }

    void stopBridge();
  }, [target]);

  const messages = {
    stopping: "Stopping the bridge…",
    stopped: "Bridge stopped",
    unconfirmed: "Could not confirm bridge shutdown",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md px-6" role="status">
        <Power className="w-12 h-12 mx-auto text-destructive" />
        <div className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground">
          {messages[status]}
        </div>
        {status !== "stopping" && (
          <p className="text-sm text-muted-foreground">
            Close this window, then open Rover Console from its app icon to start again.
          </p>
        )}
      </div>
    </div>
  );
}

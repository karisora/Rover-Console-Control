import { useState } from "react";
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

export function ShutdownButton() {
  const { servedByBridge, bridgeUrl } = useBridge();
  const target = (bridgeUrl?.replace(/\/+$/, "") ?? "") + "/api/shutdown";
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  // Only meaningful when running inside the local bridge (.app or `node rover-bridge.mjs`).
  if (!servedByBridge) return null;

  const handleShutdown = async () => {
    try {
      await fetch(target, { method: "POST" });
    } catch {
      // The server killed itself before responding — that's expected.
    }
    setDone(true);
    setOpen(false);
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="text-center space-y-4 max-w-md px-6">
          <Power className="w-12 h-12 mx-auto text-destructive" />
          <div className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground">
            Bridge Stopped
          </div>
          <div className="text-base">
            Rover Console has shut down.
            <br />
            You can close this browser tab.
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            To start again, open <span className="font-mono">RoverConsole.app</span> from Finder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
            This will stop the local bridge that talks to the rover and quit the
            Rover Console app. You'll need to re-open it from Finder to use the
            console again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="font-mono text-xs uppercase tracking-widest">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleShutdown}
            className="font-mono text-xs uppercase tracking-widest bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Shut Down
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

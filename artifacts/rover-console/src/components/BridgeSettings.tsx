import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings2, Cloud, Cable } from "lucide-react";
import { useBridge } from "./BridgeContext";

export function BridgeSettings() {
  const { bridgeUrl, setBridgeUrl, effectiveMode } = useBridge();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(bridgeUrl);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(bridgeUrl);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-[10px] tracking-[0.2em] uppercase gap-2 h-9"
          title="Configure bridge"
        >
          {effectiveMode === "bridge" ? (
            <Cable className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className={effectiveMode === "bridge" ? "text-primary" : "text-muted-foreground"}>
            {effectiveMode === "bridge" ? "BRIDGE" : "CLOUD"}
          </span>
          <Settings2 className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-widest uppercase text-sm">
            Link Configuration
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            The rover (Pico 2W) is on its own Wi-Fi AP at <code>192.168.4.1</code>, which the
            cloud server cannot reach. Run the local bridge on the Mac that's joined to{" "}
            <code>LumOS1-Pico2W</code> and point the console at it:
            <br />
            <code className="block mt-2 px-2 py-1 bg-muted/50 text-foreground">
              node tools/rover-bridge.mjs
            </code>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground block">
            Bridge URL
          </label>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://127.0.0.1:5050"
            spellCheck={false}
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Leave empty to use the cloud API server (Replit) — useful for UI testing without a
            rover present, but will not reach the actual rover hardware.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setBridgeUrl("");
              setOpen(false);
            }}
            className="font-mono text-xs uppercase tracking-widest"
          >
            Use Cloud
          </Button>
          <Button
            onClick={() => {
              setBridgeUrl(draft);
              setOpen(false);
            }}
            className="font-mono text-xs uppercase tracking-widest"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

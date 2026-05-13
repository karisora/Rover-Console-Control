import { DriveControls } from "@/components/DriveControls";
import { SpeedControl } from "@/components/SpeedControl";
import { VoiceTrigger } from "@/components/VoiceTrigger";
import { CommandPanel } from "@/components/CommandPanel";
import { TelemetryLog } from "@/components/TelemetryLog";
import { RoverViewer } from "@/components/RoverViewer";
import { RoverEventStream } from "@/components/RoverEventStream";
import { CommsPanel } from "@/components/CommsPanel";

export default function Home() {
  return (
    <>
      <RoverEventStream />
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-5">
        <div className="flex flex-col gap-4 lg:gap-5 min-w-0">
          <section>
            <SectionLabel num="01" title="Rover Visualizer" />
            <RoverViewer />
          </section>

          <section>
            <SectionLabel num="02" title="Drive Controls" />
            <DriveControls />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            <div>
              <SectionLabel num="03" title="Throttle" />
              <SpeedControl />
            </div>
            <div>
              <SectionLabel num="04" title="Voice Spell" />
              <VoiceTrigger />
            </div>
          </section>

          <section>
            <SectionLabel num="05" title="Raw Command" />
            <CommandPanel />
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:gap-5 min-w-0">
          <section>
            <SectionLabel num="06" title="Comms Link" />
            <CommsPanel />
          </section>
          <section className="flex flex-col flex-1 min-h-0">
            <SectionLabel num="07" title="Telemetry" />
            <div className="flex-1 min-h-[280px] lg:min-h-[320px]">
              <TelemetryLog />
            </div>
          </section>
        </aside>
      </main>
      <footer className="border-t border-border px-4 md:px-6 py-2 font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground flex justify-between flex-wrap gap-2">
        <span>Replit Mission Ops · v0.1.0</span>
        <span>Keys: W/S Drive · A/D Rotate · Q/E Strafe · Space Stop</span>
      </footer>
    </>
  );
}

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-2">
      <span className="font-mono text-[10px] text-primary tracking-[0.3em]">
        {num}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground tracking-[0.3em] uppercase">
        {title}
      </span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

import { useState } from "react";
import { RoverParamsProvider } from "@/components/design/RoverParamsContext";
import { StructurePanel } from "@/components/design/StructurePanel";
import { MissionConfigPanel } from "@/components/design/MissionConfigPanel";
import { SimulationFlow } from "@/components/design/SimulationFlow";
import { DesignChatPanel } from "@/components/design/DesignChatPanel";
import { MoonRover } from "@/components/design/MoonRover";
import { DEFAULT_MISSION, type MissionConfig } from "@/components/design/missionTypes";

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <span className="font-mono text-[10px] text-primary tracking-[0.3em]">{num}</span>
      <span className="font-mono text-[10px] text-muted-foreground tracking-[0.3em] uppercase">{title}</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function DesignLab() {
  const [mission, setMission] = useState<MissionConfig>(DEFAULT_MISSION);

  return (
    <RoverParamsProvider>
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 py-4 flex flex-col gap-6">

        <section>
          <SectionLabel num="01" title="Structure Parameters" />
          <StructurePanel />
        </section>

        <section>
          <SectionLabel num="02" title="Mission Config & Module Placement" />
          <MissionConfigPanel config={mission} onChange={setMission} />
        </section>

        <section>
          <SectionLabel num="03" title="AI Simulation Flow" />
          <SimulationFlow config={mission} />
        </section>

        <section>
          <SectionLabel num="04" title="Design AI Chat" />
          <DesignChatPanel config={mission} />
        </section>

        <section>
          <SectionLabel num="05" title="Rover Visualizer" />
          <MoonRover config={mission} />
        </section>

      </main>
    </RoverParamsProvider>
  );
}

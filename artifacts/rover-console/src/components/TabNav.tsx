import { FlaskConical, Radio, Route } from "lucide-react";

export type AppTab = "operation" | "sim-to-real" | "design";

interface TabNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

export function TabNav({ active, onChange }: TabNavProps) {
  const tabs: { id: AppTab; label: string; labelJa: string; icon: React.ReactNode }[] = [
    {
      id: "operation",
      label: "OPERATION",
      labelJa: "Live rover control",
      icon: <Radio className="w-3.5 h-3.5" />,
    },
    {
      id: "sim-to-real",
      label: "SIM-TO-REAL",
      labelJa: "Simulation bridge",
      icon: <Route className="w-3.5 h-3.5" />,
    },
    {
      id: "design",
      label: "DESIGN LAB",
      labelJa: "Design and simulation",
      icon: <FlaskConical className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 flex gap-0">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={[
                "flex items-center gap-2 px-4 py-2.5 font-mono text-[10px] tracking-[0.25em] uppercase",
                "border-b-2 transition-colors duration-150 select-none",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.labelJa}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelemetryProvider } from "@/components/TelemetryContext";
import { BridgeProvider } from "@/components/BridgeContext";
import { NetworkRateProvider } from "@/components/NetworkRateContext";
import { TabNav, type AppTab } from "@/components/TabNav";
import { StatusHeader } from "@/components/StatusHeader";
import Home from "@/pages/Home";
import DesignLab from "@/pages/DesignLab";
import SimToReal from "@/pages/SimToReal";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function tabFromHash(): AppTab {
  if (window.location.hash === "#design") return "design";
  if (window.location.hash === "#sim-to-real") return "sim-to-real";
  return "operation";
}

function hashForTab(tab: AppTab): string {
  if (tab === "operation") return "";
  return `#${tab}`;
}

function AppShell() {
  const [tab, setTab] = useState<AppTab>(() => tabFromHash());

  const handleTabChange = (next: AppTab) => {
    setTab(next);
    const nextHash = hashForTab(next);
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, "", nextUrl);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <StatusHeader />
      <TabNav active={tab} onChange={handleTabChange} />
      {tab === "operation" ? <Home /> : tab === "sim-to-real" ? <SimToReal /> : <DesignLab />}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AppShell} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BridgeProvider>
          <NetworkRateProvider>
            <TelemetryProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TelemetryProvider>
          </NetworkRateProvider>
        </BridgeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppShell() {
  const [tab, setTab] = useState<AppTab>(
    () => (window.location.hash === "#design" ? "design" : "operation")
  );
  return (
    <div className="min-h-screen flex flex-col">
      <StatusHeader />
      <TabNav active={tab} onChange={setTab} />
      {tab === "operation" ? <Home /> : <DesignLab />}
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

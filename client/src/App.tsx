import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/contexts/SettingsContext";
import Studio from "@/pages/Studio";
import Library from "@/pages/Library";
import Settings from "@/pages/Settings";
import Finalize from "@/pages/Finalize";
import Workspace from "@/pages/Workspace";
import Status from "@/pages/Status";
import SupportBilling from "@/pages/SupportBilling";
import SupportAccount from "@/pages/SupportAccount";
import SupportTechnical from "@/pages/SupportTechnical";
import ReportAbuse from "@/pages/ReportAbuse";
import Docs from "@/pages/Docs";
import Community from "@/pages/Community";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Studio} />
      <Route path="/library" component={Library} />
      <Route path="/finalize/:jobId" component={Finalize} />
      <Route path="/workspace/:jobId" component={Workspace} />
      <Route path="/settings/:section?" component={Settings} />
      <Route path="/status" component={Status} />
      <Route path="/support/billing" component={SupportBilling} />
      <Route path="/support/account" component={SupportAccount} />
      <Route path="/support/technical" component={SupportTechnical} />
      <Route path="/report-abuse" component={ReportAbuse} />
      <Route path="/docs" component={Docs} />
      <Route path="/community" component={Community} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;

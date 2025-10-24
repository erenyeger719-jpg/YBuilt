// client/src/App.tsx
import React from "react";
import { Route, Switch } from "wouter";
import "@/lib/clientLogBridge";

// Pages
import Home from "@/pages/Home";             // marketing
import StudioPage from "@/pages/Studio";     // marketing at /studio, finalize when :jobId present
import Workspace from "@/pages/Workspace";   // editor
import Library from "@/pages/Library";       // your library page
import Previews from "@/pages/Previews";     // previews index
import DevLogs from "@/pages/DevLogs";       // live dev logs
import Templates from "@/pages/Templates";   // templates index
import TemplateDetail from "@/pages/TemplateDetail"; // template detail
import CollabPage from "@/pages/Collab";     // collab room

// Weavy wrapper + board (bridge band)
import WeavySection from "@/components/WeavySection";
import WeavyBoard from "@/components/WeavyBoard";

// Global command palette
import CommandPalette from "@/components/commands/CommandPalette";

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">404 — Page Not Found</h1>
        <a className="underline" href="/">Go home</a>
      </div>
    </div>
  );
}

/** Inline page that wraps the WeavyBoard in the WeavySection band */
function WeavyBridge() {
  return (
    <main>
      {/* Bridge band: grid + pixel spill; nodes appear after the fade */}
      <WeavySection bandHeightRem={14}>
        <WeavyBoard />
      </WeavySection>
    </main>
  );
}

export default function App() {
  return (
    <>
      <CommandPalette />
      <Switch>
        {/* Home (marketing) */}
        <Route path="/" component={Home} />

        {/* Studio: marketing at /studio, finalize at /studio/:jobId (optional param) */}
        <Route path="/studio/:jobId?">{() => <StudioPage />}</Route>

        {/* Library */}
        <Route path="/library" component={Library} />

        {/* Previews index */}
        <Route path="/previews" component={Previews} />

        {/* Template detail (must be ABOVE the generic /templates route) */}
        <Route path="/templates/:id">{() => <TemplateDetail />}</Route>

        {/* Templates index */}
        <Route path="/templates" component={Templates} />

        {/* Workspace */}
        <Route path="/workspace/:jobId" component={Workspace} />

        {/* Collab room */}
        <Route path="/collab/:roomId">
          <CollabPage />
        </Route>

        {/* Weavy bridge band + board (new route) */}
        <Route path="/weavy">{() => <WeavyBridge />}</Route>

        {/* Dev logs (live) */}
        <Route path="/dev/logs" component={DevLogs} />

        {/* Fallback (must be last, no path) */}
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </>
  );
}

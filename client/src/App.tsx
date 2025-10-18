// client/src/App.tsx
import { Route, Switch } from "wouter";

// Pages
import Home from "@/pages/Home";             // marketing
import StudioPage from "@/pages/Studio";     // marketing at /studio, finalize when :jobId present
import Workspace from "@/pages/Workspace";   // editor
import Library from "@/pages/Library";       // your library page

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

export default function App() {
  return (
    <Switch>
      {/* Home (marketing) */}
      <Route path="/" component={Home} />

      {/* Studio: marketing at /studio, finalize at /studio/:jobId (optional param) */}
      <Route path="/studio/:jobId?">{() => <StudioPage />}</Route>

      {/* Library */}
      <Route path="/library" component={Library} />

      {/* Workspace */}
      <Route path="/workspace/:jobId" component={Workspace} />

      {/* Fallback (must be last, no path) */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

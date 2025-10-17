// client/src/App.tsx
import { Route } from "wouter";

// PAGES
import Home from "@/pages/Hero";
import Studio from "@/pages/Studio";          // <- param + non-param routes below
import Workspace from "@/pages/Workspace";

// Optional local NotFound so we don’t depend on anything else
function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">404 — Page Not Found</h1>
        <p className="text-muted-foreground mb-4">
          If you just created a job, make sure <code>/studio/:jobId</code> is registered.
        </p>
        <a className="underline" href="/">Go home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      {/* Home */}
      <Route path="/" component={Home} />

      {/* Studio: BOTH routes matter */}
      <Route path="/studio" component={Studio} />
      <Route path="/studio/:jobId" component={Studio} />

      {/* Workspace */}
      <Route path="/workspace/:jobId" component={Workspace} />

      {/* Catch-all LAST */}
      <Route path="/:rest*" component={NotFound} />
    </>
  );
}

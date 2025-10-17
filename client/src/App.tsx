import { Route } from "wouter";
import Home from "@/pages/Home";            // <- new
import Studio from "@/pages/Studio";        // finalize page (param only)
import Workspace from "@/pages/Workspace";
import Library from "@/pages/Library";      // <- new

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
    <>
      {/* Marketing home */}
      <Route path="/" component={Home} />

      {/* Finalize flow */}
      <Route path="/studio/:jobId" component={Studio} />

      {/* Workspace */}
      <Route path="/workspace/:jobId" component={Workspace} />

      {/* Library */}
      <Route path="/library" component={Library} />

      {/* Catch-all LAST */}
      <Route path="/:rest*" component={NotFound} />
    </>
  );
}

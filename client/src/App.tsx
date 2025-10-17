// client/src/App.tsx
import { Route } from "wouter";

// Pages
import Studio from "@/pages/Studio";       // marketing when no :jobId
import Workspace from "@/pages/Workspace"; // main editor

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
      {/* Home = marketing Studio */}
      <Route path="/" component={Studio} />

      {/* Finalize flow */}
      <Route path="/studio/:jobId" component={Studio} />

      {/* Workspace */}
      <Route path="/workspace/:jobId" component={Workspace} />

      {/* Catch-all LAST */}
      <Route path="/:rest*" component={NotFound} />
    </>
  );
}

// client/src/App.tsx
import { Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// PAGES
import Home from "@/pages/Hero";
import Studio from "@/pages/Studio";
import Workspace from "@/pages/Workspace";

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
    <QueryClientProvider client={queryClient}>
      {/* Home */}
      <Route path="/" component={Home} />

      {/* Studio */}
      <Route path="/studio" component={Studio} />
      <Route path="/studio/:jobId" component={Studio} />

      {/* Workspace */}
      <Route path="/workspace/:jobId" component={Workspace} />

      {/* Catch-all LAST */}
      <Route path="/:rest*" component={NotFound} />
    </QueryClientProvider>
  );
}

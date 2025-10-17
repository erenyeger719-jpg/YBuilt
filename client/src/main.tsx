// client/src/main.tsx
import "./index.css";
import { StrictMode } from "react";
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";

// Global providers
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_COMMIT || "local",
  tracesSampleRate: 0.1,
});

// One-time production release check via ?sentry=1
if (
  import.meta.env.MODE === "production" &&
  new URLSearchParams(location.search).has("sentry")
) {
  Sentry.captureException(new Error("release-check"));
}

// --- sanity logs so we know DSN is actually in the bundle ---
console.info(
  "[Sentry client] DSN present?",
  Boolean(import.meta.env.VITE_SENTRY_DSN)
);
if (!import.meta.env.VITE_SENTRY_DSN) {
  console.warn(
    "[Sentry client] VITE_SENTRY_DSN is empty. Set it in Render → Environment and redeploy."
  );
}

// Expose test hooks for DevTools only in non-production
if (import.meta.env.MODE !== "production") {
  // @ts-ignore
  window.triggerSentry = () => {
    setTimeout(() => {
      throw new Error("client-sentry-test");
    }, 0);
  };
  // @ts-ignore
  window.reportSentry = () => {
    Sentry.captureException(new Error("client-sentry-test"));
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <App />
          <Toaster />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);

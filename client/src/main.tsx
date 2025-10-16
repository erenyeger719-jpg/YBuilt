import "./index.css";
import { StrictMode } from "react";
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  tracesSampleRate: 0.1,
});
// --- sanity logs so we know DSN is actually in the bundle ---
console.info('[Sentry client] DSN present?', Boolean(import.meta.env.VITE_SENTRY_DSN));
if (!import.meta.env.VITE_SENTRY_DSN) {
  console.warn('[Sentry client] VITE_SENTRY_DSN is empty. Set it in Render → Environment and redeploy.');
}

// expose test hooks for DevTools
// @ts-ignore
window.triggerSentry = () => { setTimeout(() => { throw new Error('client-sentry-test') }, 0); };
// @ts-ignore
window.reportSentry = () => { Sentry.captureException(new Error('client-sentry-test')); };

import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

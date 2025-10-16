import "./index.css";
import { StrictMode } from "react";
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  tracesSampleRate: 0.1,
});


// expose test hooks for DevTools
// @ts-ignore
window.triggerSentry = () => { throw new Error('client-sentry-test'); };
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

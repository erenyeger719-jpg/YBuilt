import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

let initialized = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.log('[Sentry] SENTRY_DSN not configured, skipping');
    return;
  }

  if (initialized) {
    console.log('[Sentry] Already initialized');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    integrations: [nodeProfilingIntegration()],
    beforeSend(event) {
      // Redact sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  initialized = true;
  console.log('[Sentry] Initialized');
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (!initialized) return;
  
  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!initialized) return;
  
  Sentry.captureMessage(message, level);
}

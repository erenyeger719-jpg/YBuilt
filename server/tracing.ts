import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';

let sdk: NodeSDK | null = null;

export function initTracing(options: { serviceName: string }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Tracing] Skipping in development mode');
    return;
  }

  if (sdk) {
    console.log('[Tracing] Already initialized');
    return;
  }

  const resource = resourceFromAttributes({
    'service.name': options.serviceName,
  });

  sdk = new NodeSDK({
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log('[Tracing] OpenTelemetry initialized for', options.serviceName);

  process.on('SIGTERM', () => {
    sdk?.shutdown()
      .then(() => console.log('[Tracing] Shutdown complete'))
      .catch((error) => console.error('[Tracing] Shutdown error:', error))
      .finally(() => process.exit(0));
  });
}

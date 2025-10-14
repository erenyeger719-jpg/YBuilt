# Tempo + Loki + Grafana Observability Stack

Complete guide for deploying and configuring distributed tracing, logging, and visualization for YBUILT.

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   YBUILT    │────▶│   Grafana   │────▶│    User     │
│  Application│     │   (Visualize)│     │  Dashboard  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │
       │                    ▼
       │            ┌─────────────┐
       ├───────────▶│    Tempo    │  (Traces)
       │            │  (Tracing)  │
       │            └─────────────┘
       │
       │            ┌─────────────┐
       └───────────▶│     Loki    │  (Logs)
                    │  (Logging)  │
                    └─────────────┘
```

## Components

### 1. Grafana Tempo (Distributed Tracing)
- **Purpose**: Store and query distributed traces
- **Backend**: S3-compatible object storage
- **Protocol**: OpenTelemetry (OTLP)
- **Retention**: 3 days hot, 14 days warm

### 2. Grafana Loki (Log Aggregation)
- **Purpose**: Centralized logging
- **Backend**: S3 for long-term storage
- **Retention**: 7 days hot, 30 days warm, 90 days cold

### 3. Grafana (Visualization)
- **Purpose**: Unified dashboards for logs, traces, and metrics
- **Data Sources**: Tempo, Loki, Prometheus

---

## Deployment

### Prerequisites

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add Grafana Helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### 1. Deploy Tempo

```bash
# Create namespace
kubectl create namespace observability

# Deploy Tempo
helm install tempo grafana/tempo \
  --namespace observability \
  --set tempo.retention=72h \
  --set tempo.storage.trace.backend=s3 \
  --set tempo.storage.trace.s3.bucket=ybuilt-tempo-traces \
  --set tempo.storage.trace.s3.endpoint=s3.amazonaws.com \
  --set tempo.storage.trace.s3.region=us-east-1
```

**Tempo Configuration** (`tempo-config.yaml`):

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

ingester:
  trace_idle_period: 10s
  max_block_bytes: 1_000_000
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 72h

storage:
  trace:
    backend: s3
    s3:
      bucket: ybuilt-tempo-traces
      endpoint: s3.amazonaws.com
      region: us-east-1
    pool:
      max_workers: 100
      queue_depth: 10000

limits:
  max_bytes_per_trace: 5000000
  max_traces_per_user: 10000
```

### 2. Deploy Loki

```bash
# Deploy Loki
helm install loki grafana/loki-stack \
  --namespace observability \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=50Gi \
  --set promtail.enabled=true \
  --set grafana.enabled=false
```

**Loki Configuration** (`loki-config.yaml`):

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 3m
  chunk_retain_period: 1m
  max_chunk_age: 1h

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: s3
      schema: v11
      index:
        prefix: loki_index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
    shared_store: s3
  
  aws:
    s3: s3://ybuilt-loki-logs
    region: us-east-1

limits_config:
  retention_period: 168h  # 7 days hot
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 720h  # 30 days warm

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h
```

### 3. Deploy Grafana

```bash
# Deploy Grafana
helm install grafana grafana/grafana \
  --namespace observability \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --set adminPassword=admin \
  --set datasources."datasources\.yaml".apiVersion=1
```

**Grafana Data Sources** (`grafana-datasources.yaml`):

```yaml
apiVersion: 1

datasources:
  # Tempo (Traces)
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo.observability.svc.cluster.local:3200
    isDefault: false
    jsonData:
      tracesToLogs:
        datasourceUid: 'loki'
        tags: ['trace_id']
      nodeGraph:
        enabled: true
      search:
        hide: false
  
  # Loki (Logs)
  - name: Loki
    type: loki
    access: proxy
    url: http://loki.observability.svc.cluster.local:3100
    isDefault: false
    jsonData:
      derivedFields:
        - datasourceUid: 'tempo'
          matcherRegex: "trace_id=(\\w+)"
          name: TraceID
          url: '$${__value.raw}'
  
  # Prometheus (Metrics)
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus.monitoring.svc.cluster.local:9090
    isDefault: true
    jsonData:
      exemplarTraceIdDestinations:
        - datasourceUid: 'tempo'
          name: trace_id
```

---

## Application Integration

### 1. Update Server Logger (Express)

Add to `server/index.ts`:

```typescript
import { createTraceAwareLogger } from '../tools/log-trace-correlation';

const logger = createTraceAwareLogger('ybuilt-api');

// Add middleware
app.use(logger.middleware());

// Use logger
app.get('/api/jobs/:id', async (req, res) => {
  logger.info('Fetching job', {
    job_id: req.params.id,
    user_id: req.user?.id
  });
  
  // ... handler logic
});
```

### 2. OpenTelemetry Instrumentation

Add to `server/index.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'ybuilt-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.VERSION || 'dev',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.TEMPO_ENDPOINT || 'http://tempo.observability:4317',
  }),
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
```

---

## Sampling Rules

### Production Sampling (10% default)

```typescript
import { getSamplingRules } from '../tools/log-trace-correlation';

const samplingRules = getSamplingRules('production');

// Apply to tracer
const sampler = new TraceIdRatioBasedSampler(samplingRules.defaultSampleRate);
```

### Smart Sampling

```typescript
// Always sample errors
if (statusCode >= 500) {
  span.setAttribute('sample.priority', 1);
}

// Always sample slow requests
if (duration > samplingRules.slowRequestThreshold) {
  span.setAttribute('sample.priority', 1);
}
```

---

## Retention Policy

### Logs (Loki)
- **Hot**: 7 days (fast queries)
- **Warm**: 30 days (S3 standard)
- **Cold**: 90 days (S3 Glacier)

### Traces (Tempo)
- **Hot**: 3 days (in-memory cache)
- **Warm**: 14 days (S3 standard)
- **Archive**: 30 days (compliance)

### Metrics (Prometheus)
- **Raw**: 15 days
- **Downsampled (1h)**: 90 days

---

## Grafana Dashboards

### 1. Trace Dashboard

```json
{
  "dashboard": {
    "title": "YBUILT Distributed Tracing",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "datasource": "Prometheus"
          }
        ]
      },
      {
        "title": "Trace Viewer",
        "type": "trace",
        "datasource": "Tempo"
      }
    ]
  }
}
```

### 2. Log Correlation Dashboard

```bash
# Query logs with trace correlation
{job="ybuilt-api"} | json | trace_id="<trace_id>"
```

---

## Verification

```bash
# Test Tempo
curl http://tempo.observability:3200/ready

# Test Loki
curl http://loki.observability:3100/ready

# Send test trace
curl -X POST http://tempo.observability:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[...]}'

# Query logs
curl -G http://loki.observability:3100/loki/api/v1/query_range \
  --data-urlencode 'query={job="ybuilt-api"}' \
  --data-urlencode 'limit=10'
```

---

## Troubleshooting

### Tempo not receiving traces
```bash
kubectl logs -n observability deployment/tempo
kubectl port-forward -n observability svc/tempo 4317:4317
```

### Loki not ingesting logs
```bash
kubectl logs -n observability deployment/loki
kubectl logs -n observability daemonset/promtail
```

### Grafana can't query data sources
```bash
kubectl exec -n observability deployment/grafana -- grafana-cli admin reset-admin-password admin
```

---

## Cost Optimization

1. **Aggressive Sampling**: 10% in production (configurable per service)
2. **Retention Tiers**: Move to S3 after 3-7 days
3. **Compression**: Enable gzip for Loki and Tempo
4. **Lifecycle Policies**: Auto-delete after 90 days

---

## Security

1. **Authentication**: Enable Grafana OAuth
2. **Encryption**: TLS for Tempo/Loki endpoints
3. **RBAC**: Namespace-level access controls
4. **Audit Logs**: Enable for data source access

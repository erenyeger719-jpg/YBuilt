# Observability Guide

## Metrics Endpoint

### Accessing Metrics
The Prometheus-compatible metrics endpoint is available at:
```
GET /api/metrics
```

### Available Metrics

#### HTTP Requests
```
http_requests_total{method="GET",route="/api/status",status="200"} 42
```
Counter tracking all HTTP requests with method, route, and status labels.

#### Job Duration
```
job_duration_seconds{status="completed"} 2.453
```
Histogram measuring job processing time in seconds.

#### Queue Depth
```
job_queue_depth 0
```
Gauge showing current number of jobs in queue.

#### Atomic Write Failures
```
atomic_write_failures_total 0
```
Counter tracking failed atomic write operations.

### Scraping with Prometheus
Add to `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'ybuilt'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/metrics'
    scrape_interval: 15s
```

## Logger Configuration

### Log Levels
Set via `LOG_LEVEL` environment variable:
- `DEBUG`: Verbose output for development
- `INFO`: General informational messages (default)
- `WARN`: Warning messages
- `ERROR`: Error messages only

Example:
```bash
LOG_LEVEL=DEBUG npm run dev
LOG_LEVEL=ERROR npm start
```

### Log Format
Set via `LOG_FORMAT` environment variable:

#### Text Format (default)
```
[INFO] 2025-01-13T10:30:45.123Z Server started on port 5000
```

#### JSON Format
```bash
LOG_FORMAT=json npm start
```
Output:
```json
{"ts":"2025-01-13T10:30:45.123Z","level":"INFO","msg":"Server started on port 5000"}
```

### Secret Redaction
The logger automatically redacts sensitive keys:
- `authorization`
- `razorpay_key`
- `razorpay_secret`
- `password`
- `ssn`

Custom redaction keys via `LOG_REDACT_KEYS`:
```bash
LOG_REDACT_KEYS=api_key,secret_token,private_key npm start
```

Example:
```javascript
logger.info('Payment initiated', {
  razorpay_key: 'rzp_live_1234567890',
  amount: 1000
});
// Output: { razorpay_key: '<<REDACTED>>', amount: 1000 }
```

## Error Reporting

### Sentry Integration (Placeholder)
To enable Sentry error reporting:

1. Set `SENTRY_DSN` environment variable:
```bash
SENTRY_DSN=https://your-key@sentry.io/project npm start
```

2. Errors will be automatically captured and sent to Sentry

3. Configure Sentry in `server/error-reporter.ts` (to be implemented)

### Error Context
Errors include:
- Stack traces
- Request context (method, path, user)
- Environment details
- Custom tags

## Monitoring Best Practices

### 1. Alerting Rules
Create alerts for:
- `job_queue_depth > 100` (queue backing up)
- `atomic_write_failures_total` rate increase
- `http_requests_total{status="5xx"}` error rate spike

### 2. Dashboards
Key metrics to visualize:
- Request rate (by endpoint)
- Error rate (4xx, 5xx)
- Job processing time (p50, p95, p99)
- Queue depth over time

### 3. Log Aggregation
Send JSON logs to:
- **ELK Stack**: Elasticsearch + Logstash + Kibana
- **Loki**: Grafana Loki for log aggregation
- **CloudWatch**: AWS CloudWatch Logs
- **Datadog**: Datadog Logs

Example log shipping with Fluentd:
```xml
<source>
  @type tail
  path /var/log/ybuilt/*.log
  format json
  tag ybuilt.logs
</source>
```

### 4. Health Checks
Monitor these endpoints:
- `/api/status` - Overall system health
- `/api/metrics` - Prometheus metrics
- `/health` - Simple health check (to be implemented)

### 5. Trace Analysis
For detailed traces:
- Enable DEBUG logging: `LOG_LEVEL=DEBUG`
- Correlate logs with request IDs
- Track job lifecycle from creation to completion

## Example Queries

### Prometheus Queries
```promql
# Request rate (per second)
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# 95th percentile job duration
histogram_quantile(0.95, job_duration_seconds)

# Queue saturation
job_queue_depth / 100
```

### Log Queries (JSON)
```bash
# Find errors in last hour
jq 'select(.level=="ERROR")' ybuilt.log

# Redacted secrets
jq 'select(.msg | contains("REDACTED"))' ybuilt.log

# Slow jobs (>5s)
jq 'select(.msg | contains("completed") and .duration > 5000)' ybuilt.log
```

## Troubleshooting with Observability

### High Queue Depth
1. Check `/api/metrics` for `job_queue_depth`
2. Review logs for job errors: `LOG_LEVEL=DEBUG`
3. Check job duration: `job_duration_seconds`
4. Scale workers if needed

### High Error Rate
1. Check error logs: `jq 'select(.level=="ERROR")' ybuilt.log`
2. Identify error patterns
3. Check external service health (Razorpay, OpenAI)
4. Review recent deployments

### Slow Performance
1. Check `job_duration_seconds` p95/p99
2. Profile slow endpoints
3. Check database query times
4. Review atomic write metrics

## Security Considerations

1. **Protect /api/metrics** in production:
   - Use IP allowlist
   - Require authentication header
   - Rate limit requests

2. **Redact all secrets** in logs:
   - Add new keys to `LOG_REDACT_KEYS`
   - Never log raw passwords or tokens
   - Review logs before sharing

3. **Audit log access**:
   - Track who accesses logs
   - Encrypt logs at rest
   - Rotate logs regularly

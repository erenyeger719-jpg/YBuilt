# YBUILT Service Level Objectives (SLOs)

## Overview
This document defines the Service Level Objectives (SLOs) for the YBUILT platform. These objectives guide operational decisions, alerting thresholds, and canary deployment criteria.

## SLO Definitions

### 1. Availability SLO
**Objective:** 99.9% uptime over 30-day rolling window

- **Measurement:** HTTP requests returning 2xx/3xx status codes
- **Error Budget:** 43 minutes of downtime per month
- **Monitoring:** `up{job="ybuilt"}` metric
- **Alert Threshold:** Service down for > 1 minute

### 2. Latency SLO
**Objective:** p95 latency < 300ms for all API endpoints

- **Measurement:** 95th percentile HTTP request duration
- **Monitoring:** `http_request_duration_seconds` histogram
- **Alert Threshold:** p95 > 300ms sustained for 5 minutes
- **Canary Criteria:** Canary p95 must be < 130% of stable p95

### 3. Error Rate SLO
**Objective:** < 0.5% error rate over 5-minute windows

- **Measurement:** 5xx responses / total responses
- **Monitoring:** `http_requests_total{status=~"5.."}` counter
- **Alert Threshold:** Error rate > 0.5% sustained for 5 minutes
- **Canary Criteria:** Canary error rate must be < 150% of stable error rate

### 4. Job Processing SLO
**Objective:** 95% of AI generation jobs complete within 60 seconds

- **Measurement:** Job duration from creation to completion
- **Monitoring:** `job_duration_seconds` histogram
- **Alert Threshold:** p95 job duration > 60s for 10 minutes
- **Success Rate:** > 98% of jobs should succeed

### 5. Data Durability SLO
**Objective:** Zero data loss from atomic write operations

- **Measurement:** Atomic write failure count
- **Monitoring:** `atomic_write_failures_total` counter
- **Alert Threshold:** Any atomic write failure (immediate alert)
- **Mitigation:** Automatic retry with exponential backoff

## Canary Deployment Criteria

Canary deployments are automatically promoted if ALL of the following are met:

1. **Error Rate:** Canary error rate ≤ 150% of stable error rate
2. **Latency:** Canary p95 latency ≤ 130% of stable p95 latency
3. **Success Rate:** Synthetic checks pass at ≥ 95% success rate
4. **Duration:** Criteria sustained for minimum observation window (60s in CI, 15m in production)

If ANY criterion fails, the canary is automatically rolled back.

## Monitoring Queries

### Availability
```promql
# Uptime percentage over 30 days
avg_over_time(up{job="ybuilt"}[30d]) * 100
```

### Latency (p95)
```promql
# p95 request duration
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Error Rate
```promql
# Error rate over 5 minutes
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

### Job Processing
```promql
# p95 job duration
histogram_quantile(0.95, rate(job_duration_seconds_bucket[10m]))

# Job success rate
sum(rate(job_completed_total{status="success"}[5m])) / sum(rate(job_completed_total[5m]))
```

## Alert Severity Levels

### Critical (P1)
- Service completely down
- Error rate > 1%
- Data loss detected (atomic write failures)
- **Action:** Page on-call engineer immediately
- **Response Time:** 15 minutes

### Warning (P2)
- SLO threshold breached but within error budget
- Canary deployment showing degradation
- Queue depth growing
- **Action:** Slack notification to team channel
- **Response Time:** 1 hour

### Info (P3)
- Approaching SLO thresholds
- Capacity planning alerts
- **Action:** Logged for review
- **Response Time:** Next business day

## Error Budget Policy

### Monthly Error Budget
Based on 99.9% availability SLO:
- **Total Minutes:** 43,200 minutes/month
- **Error Budget:** 43 minutes/month
- **Daily Budget:** ~1.4 minutes/day

### Error Budget Actions

| Budget Remaining | Action |
|-----------------|--------|
| > 50% | Normal deployments, experimentation allowed |
| 25-50% | Increased caution, canary observation extended |
| 10-25% | Deployment freeze for non-critical changes |
| < 10% | Emergency only, focus on reliability |
| 0% | Complete deployment freeze until next period |

## Review and Updates

- **Review Frequency:** Quarterly
- **Owner:** Platform Team
- **Stakeholders:** Engineering, Product, Support
- **Next Review:** January 2026

## References

- [Prometheus Alerts](../prometheus/alerts.yaml)
- [Alertmanager Config](../.monitoring/alerting/alertmanager.yml)
- [Rollback Runbook](./runbooks/rollback.md)
- [Canary Deployment Workflow](../.github/workflows/canary-promote.yml)

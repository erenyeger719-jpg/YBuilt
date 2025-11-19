# YBuilt – Observability, SLOs and Incident Basics (v1)

This doc defines how we watch the platform and how we react when it misbehaves.

The goal is simple:

> Know when things are breaking, how badly, and what to do next.

---

## 1. What we care about (core signals)

For the platform backend, we track three core signals:

1. **Availability**
   - Are `/api/*` routes returning successful responses (2xx/3xx), not 5xx?

2. **Latency**
   - How long do core routes take?
   - Especially:
     - `/api/previews/*`
     - `/api/deploy/*`
     - `/api/code/*`
     - `/api/execute*`

3. **Error rate**
   - How many requests end up as 4xx/5xx?
   - 4xx are usually user/input errors.
   - 5xx are **our** bugs or infra issues.

All other metrics (AI tokens, sandbox jobs, etc.) are useful, but these three are the minimum for a reliable platform.

---

## 2. Basic SLOs (Service Level Objectives)

These are **targets**, not hard guarantees. If we repeatedly miss them, we investigate and improve.

### 2.1 Availability

- Target:
  - **99.5%** of `/api/*` requests return 2xx/3xx over a 30-day window.

- Interpretation:
  - Short outages during deploys are okay.
  - Long or repeated outages are not.

### 2.2 Latency

For core user paths:

- Routes:
  - `/api/previews/*`
  - `/api/deploy/*`
  - `/api/code/*`
  - `/api/execute*`

- Targets:
  - `p95 < 700ms` (95% of requests finish within 700ms)
  - `p99 < 2000ms` (99% within 2 seconds)

These numbers can be tightened later as we optimize.

### 2.3 Error rate

- Target:
  - Total 5xx rate across `/api/*` is **< 1%** over 30 days.

- Notes:
  - 4xx (validation errors, auth failures) are expected sometimes.
  - 5xx should be rare and investigated.

---

## 3. Logs and metrics (what we record)

Backend already emits structured logs (JSON) per request and per key action.

For v1, each **request log** should ideally contain:

- `requestId` (correlation ID)
- `route` (e.g. `/api/execute`, `/api/deploy`)
- `method` (GET/POST/…)
- `statusCode`
- `durationMs`
- `userId` (or `anonymous`)
- Any relevant context (e.g. `workspaceId`, `projectId`)

For **sandbox / execution** logs, we also care about:

- `executionTimeMs`
- `status` (`completed`, `timeout`, `error`)
- Whether the global kill switch or concurrency cap blocked a run.

These logs are the raw material for:

- dashboards (later, in a metrics / logging tool)
- incident investigation
- performance tuning

---

## 4. Alerts (v1 expectations)

We don’t need a perfect alerting system on day one, but we do want **clear red flags** when things are bad.

At minimum, we plan to alert on:

1. **5xx spikes**
   - Condition:
     - 5xx rate on `/api/*` exceeds a threshold for more than a few minutes.
   - Action:
     - Investigate latest deploy, logs, DB connectivity.

2. **Latency blow-ups**
   - Condition:
     - `p95` latency on key routes (`/api/deploy`, `/api/previews`, `/api/code`, `/api/execute*`) jumps above SLO for more than a few minutes.
   - Action:
     - Check for:
       - traffic spikes
       - DB slow queries
       - resource limits (CPU/RAM)

3. **Exhausted quotas / backpressure**
   - Condition:
     - Many requests are being rejected as:
       - `429` (too many requests / too many executions in progress)
       - or sandbox queue is consistently full.
   - Action:
     - Check:
       - Are we under attack?
       - Do we need more capacity?
       - Are our limits mis-configured?

Implementation details (which tool, exact rules) can change. The key is that **these three patterns are watched**.

---

## 5. Incident basics (“when the site is on fire”)

When something is clearly wrong (users complain, alerts fire), the playbook is:

1. **Check health / status**
   - Look at:
     - recent logs
     - error rates
     - `/api/*` health indicators (including `/api/execute/health` and sandbox health)
   - Confirm if the issue is:
     - global
     - per-region / per-env
     - or only for certain routes.

2. **Stop the bleeding**
   - If a deploy caused the issue:
     - roll back to the last known good build.
   - If execution is causing overload/abuse:
     - set `DISABLE_EXECUTION=true` and restart backend.
   - If a specific feature is unstable:
     - gate/disable it temporarily (feature flag or routing).

3. **Communicate**
   - Update a status channel (later: status page / customer comms).
   - Short, honest message:
     - what is wrong (high level)
     - who is affected
     - what we are doing

4. **Root cause and follow-up**
   - After stabilization:
     - review logs and metrics
     - identify what went wrong:
       - code bug
       - infra misconfig
       - unexpected load
   - Capture:
     - fix
     - tests or checks to prevent recurrence
     - any infra changes required

We don’t need a huge “post-mortem” culture on day one, but we do want repeat incidents to become rarer over time.

---

## 6. Future improvements (beyond v1)

Later, as traffic grows, we’ll add:

- Dedicated metrics dashboards for:
  - latency per route
  - error rate per route
  - sandbox job volume and duration
- Better per-tenant metrics:
  - which workspaces are heavy
  - which features are hot
- Synthetic uptime checks from multiple regions.

For now, this doc defines the **minimum observability and SLO story** we hold ourselves to for the platform backend.

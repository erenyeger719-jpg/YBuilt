# Environments & Config – YBuilt Platform

This doc explains how to run the backend in **dev**, **staging**, and **prod**.
It’s about **environment variables**, not secrets. Never commit your real `.env`.

---

## 1. Environment overview

We assume three logical environments:

- **dev** – your laptop:
  - fast feedback, fake payments, debug logging.
- **staging** – pre-prod on Render (or similar):
  - looks like prod, but safe to break.
- **prod** – real users, real money:
  - strict config, real secrets.

The same server code runs in all three. Only **env vars + infra** change.

---

## 2. Key environment variables

### 2.1 Core server

- `NODE_ENV`
  - `development` for dev.
  - `production` for staging + prod.
- `PORT`
  - HTTP port. Commonly `5050`.
- `APP_ORIGIN`
  - Frontend origin (where the SPA lives).
  - Example dev: `http://localhost:3000`
  - Example prod: `https://app.ybuilt.com`
- `API_ORIGIN` (optional)
  - Public origin for the API if different from `APP_ORIGIN`.
  - Example prod: `https://api.ybuilt.com`

### 2.2 Database & logs

- `DB_PATH`
  - SQLite DB path for this environment.
  - Example dev: `./data/app.dev.db`
  - Example prod: `/data/app.prod.db` (or managed DB connection string).
- `LOG_DIR`
  - Directory for JSONL logs.
  - Example: `./data/logs`
- `LOG_JSONL`
  - `true` = enable JSONL log sink.

### 2.3 Sandbox / execution

- `ENABLE_SANDBOX`
  - `true` to allow `/api/execute` sandbox.
- `DISABLE_EXECUTION`
  - `true` = global kill switch for code execution.
- `RUNNER_IMPL`
  - e.g. `docker` or `local`.
- `RUNNER_POLICY_STRICT`
  - `true` = strict resource limits.
- `EXEC_MAX_CONCURRENT`
  - Max in-process concurrent jobs (e.g. `10`).
- `EXECUTION_TIMEOUT_MS`
  - Per-job timeout in ms (e.g. `3000`).
- `EXECUTION_MAX_BYTES`
  - Max bytes for stdout/stderr/result (e.g. `65536`).
- `IVM_MEMORY_MB`
  - Memory cap per VM (e.g. `64` or `128`).

### 2.4 Auth & security

- `JWT_SECRET`
  - **Required in production**. Long random string.
- `DEV_JWT_SECRET`
  - Optional helper for dev.
- IP / quota related:
  - `QUOTA_ENABLED`, `QUOTA_PER_MIN`, `QUOTA_PER_DAY`, etc.
  - Plan header: `QUOTA_PLAN_HEADER` (e.g. `x-plan`).
  - Free plan names: `QUOTA_FREE_PLANS` (e.g. `free,trial`).

### 2.5 Payments / billing

- `RAZORPAY_MODE`
  - `mock` in dev.
  - `live` in prod.
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
  - Set only in **real envs**, never commit.

### 2.6 Misc flags

- Feature toggles (examples):
  - `ENABLE_SANDBOX`
  - `RUNNER_IMPL`
  - QA / snapshots flags.
- Pricing / cost flags (kept off until real pricing day):
  - `PRICING_UNSET`
  - `COST_CPM_USD`, `COST_TOKENS_PER_1KCHARS`, etc.

---

## 3. Dev vs Staging vs Prod – recommended split

### 3.1 Dev (.env.dev)

Goal: **easy local hacking**, fake payments, forgiving quotas.

- `NODE_ENV=development`
- `APP_ORIGIN=http://localhost:3000`
- `API_ORIGIN=http://localhost:5050`
- `DB_PATH=./data/app.dev.db`
- `LOG_DIR=./data/logs`
- `LOG_JSONL=true`
- `ENABLE_SANDBOX=true`
- `DISABLE_EXECUTION=false`
- `RUNNER_IMPL=docker`
- `RUNNER_POLICY_STRICT=true`
- `EXEC_MAX_CONCURRENT=10`
- `EXECUTION_TIMEOUT_MS=3000`
- `EXECUTION_MAX_BYTES=65536`
- `IVM_MEMORY_MB=64`
- `DEV_JWT_SECRET=ybuilt-dev-secret-please-change`
- `JWT_SECRET=ybuilt-dev-secret-please-change`
- `RAZORPAY_MODE=mock`

You can use `.env.dev.example` in this repo as a template.

### 3.2 Staging (.env.staging)

Goal: **prod-like**, but safe to break.

Typical differences vs dev:

- `NODE_ENV=production`
- `DB_PATH` points to a staging DB, not dev or prod.
- `APP_ORIGIN` / `API_ORIGIN` point to staging URLs.
- `JWT_SECRET` is a **real secret** set in Render/Linux env, not in `.env` file.
- `RAZORPAY_MODE=mock` (usually still mock in staging).

You can derive this from `.env.prod.example` with “staging” values.

### 3.3 Prod (.env.prod)

Goal: **real users, real money**.

- `NODE_ENV=production`
- `APP_ORIGIN=https://app.ybuilt.com`
- `API_ORIGIN=https://api.ybuilt.com` (if separate)
- `DB_PATH` points to prod DB or a connection string.
- `LOG_DIR` points to durable storage (volume or bucket path).
- `LOG_JSONL=true`
- `ENABLE_SANDBOX=true`
- `DISABLE_EXECUTION=false` (flip to `true` in emergencies).
- `RUNNER_IMPL=docker`
- `RUNNER_POLICY_STRICT=true`
- Tight quotas + real `JWT_SECRET`, `RAZORPAY_*` secrets.

**Secrets (JWT, Razorpay, etc.) must be set in the hosting provider env UI, not in `.env.prod` committed to git.**

---

## 4. Example files

This repo includes templates:

- `.env.dev.example`
- `.env.prod.example`

Workflow:

1. Copy the example:
   - `cp .env.dev.example .env` for local dev.
2. Fill in any missing values (DB_PATH, etc.).
3. For staging/prod:
   - Use `.env.prod.example` as reference.
   - Set secrets in your hosting provider’s dashboard (Render, etc.).

---

## 5. Checklist before going commercial

Before charging users, you should be able to say:

- “I know exactly which config is running in dev, staging, and prod.”
- “Prod has its own DB and logs, not sharing with dev.”
- “JWT and payment secrets live only in env config, not in git.”
- “I can flip `DISABLE_EXECUTION=true` if code execution misbehaves.”

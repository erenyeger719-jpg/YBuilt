# Plans & quotas — v1 backend rules

This file tells the truth about how the backend thinks about plans and quotas.

## 1. Plan names the backend cares about

Backend only needs **simple strings**, not marketing names.

For now:

- `free`  
  - Default when there is **no** plan header.
  - Also for any value inside `QUOTA_FREE_PLANS`.

- `pro`  
  - Any **paid** plan goes here (Creator / Pro / whatever name you show in UI).
  - Backend only cares that it is **not** in `QUOTA_FREE_PLANS`.

Later, you can split `creator`, `agency`, etc. For v1, `free` vs `pro` is enough.

---

## 2. Env vars used by the quota middleware

These env vars control quota behaviour:

- `QUOTA_ENABLED`  
  - `true` / `1` → quotas ON.  
  - Empty / `false` → quotas OFF (no limits, for local dev).

- `QUOTA_PER_MIN`  
  - Max **requests per minute** for free plans.

- `QUOTA_PER_DAY`  
  - Max **requests per day** for free plans.

- `QUOTA_BACKOFF_FRAC`  
  - How much to “back off” window after hitting the limit (e.g. `0.9`).

- `QUOTA_BACKOFF_MS`  
  - Extra backoff time in milliseconds.

- `QUOTA_PLAN_HEADER`  
  - HTTP header the backend reads for plan.  
  - Default: `x-plan`.

- `QUOTA_FREE_PLANS`  
  - Comma-separated list of plan names treated as **free**.  
  - Example: `free,trial`.

Rules:

- If **header is missing** ⇒ behave as **free**.
- If header value is in `QUOTA_FREE_PLANS` ⇒ behave as **free**.
- Otherwise ⇒ treat as **paid/pro** and **bypass quotas**.

---

## 3. Behaviour in plain words

When `QUOTA_ENABLED=true`:

1. Each incoming request on quota-protected routes:
   - Looks at `QUOTA_PLAN_HEADER` (e.g. `x-plan`).
   - Decides whether caller is **free** or **pro**.

2. For **free**:
   - Count request towards `QUOTA_PER_MIN` and `QUOTA_PER_DAY`.
   - When limits are exceeded:
     - Return `429 Too Many Requests`.
     - Include a **clear JSON error** like:

       ```json
       {
         "ok": false,
         "error": "quota_exceeded",
         "resource": "generic",
         "plan": "free"
       }
       ```

3. For **pro**:
   - Do **not** enforce free limits.
   - Still may have separate safety limits later, but not the basic caps.

---

## 4. Which routes should be quota-protected?

For now, minimum set:

- AI-heavy or expensive routes:
  - `/api/ai/act`
  - `/api/ai/chips/apply`
  - `/api/ai/ab/promote`

Optional (later):

- `/api/execute` if you want to cap sandbox usage.
- Any other costly background job endpoints.

---

## 5. What this doc guarantees

- Anyone reading this file knows:
  - What plan strings exist (`free`, `pro`).
  - How the **header → plan → quota** logic works.
  - Which env vars must be set in production.

- Frontend and billing code can now **sync** to these names and limits.

This doc + the `tests/backend.quotas-smoke.mjs` script together satisfy:

> “Minimal stance on plans → quotas actually encoded somewhere and tested.”

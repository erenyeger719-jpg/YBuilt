# YBuilt – Data Durability & Storage Classes (v1)

This doc defines how we classify data in YBuilt and **where it is allowed to live**.

The goal is simple:

> Anything that matters for users or billing must live in the **primary database**, not just in `.cache` or JSON files.

---

## 1. Data classes

We treat all stored data as one of three classes.

### 1.1 Critical state (MUST be in DB)

These are things that users would reasonably expect never to "randomly disappear":

- Accounts & identity
  - Users
  - Teams / Organizations
- Workspaces & projects
  - Workspaces
  - Projects / apps / sites
- Collaboration state
  - Comments
  - Chat messages
- Shipping & deployment
  - Deploy records (what was deployed, when, from which workspace)
  - Preview metadata (which slug belongs to which workspace/project)
- Commercial state
  - Plan / billing entitlements (even if the billing link-up is manual at first)

**Rule:**  
If losing it would break trust, cost someone money, or make us look incompetent, it **must** be stored in the primary DB (e.g. Postgres/Supabase), with proper migrations and backups.

### 1.2 Semi-critical / analytic (DB or append-only OK)

These are things we can recompute or live without short-term but are still very useful:

- KPI events (views, conversions, click-through rates)
- UX snapshots / screenshots metadata
- A/B test aggregates, win/loss counts
- AI outcome priors / stats (what copy/designs tend to win)

These may live in:

- The primary DB, **or**
- Append-only JSONL or similar on disk (e.g. under `.cache/`), **provided that**:
  - Losing them does **not** break the core product
  - We accept that old historical analytics might be incomplete

If we ever start billing based on any of these metrics, they move up to **Critical**.

### 1.3 Ephemeral / cache (disk or memory OK)

Short-lived or reproducible data:

- Raw logs (structured JSON logs, request logs)
- Temporary AI receipts, debug traces
- Sandbox artifacts that can be regenerated
- Preview build artefacts (cache), as long as they can be rebuilt

These may live in:

- In-memory caches
- Local disk under `.cache/`
- Object storage with TTLs

Losing them should not affect correctness, only convenience or performance.

---

## 2. Current mapping (v1 snapshot)

Based on the current codebase, our intent is:

### 2.1 Critical (must be DB-backed)

The following **must be in DB** (not just in `.cache`):

- Users and auth-related tables
- Teams / organizations
- Workspaces
- Projects
- Comments
- Chat messages
- Deployments (records of deploys)
- Preview metadata (which preview belongs to which workspace/project)
- Plan / tier / entitlements for each user or workspace (even if mostly manual early on)

If any of these are currently backed only by JSON or `.cache`, that is a **bug** and should be migrated to DB.

### 2.2 Semi-critical (acceptable to be file-based for now)

These may live in `.cache` as long as we understand they’re not hard guarantees:

- KPI seen/convert events (e.g. `.cache/kpi.seen.jsonl`)
- Outcome priors / token priors (e.g. `.cache/token.priors.json`)
- AI receipts / narrative logs that we don’t expose as the primary source of truth

Migration rule: if we start relying on these for billing or contractual reporting, we move them into DB.

### 2.3 Ephemeral / cache (file or memory)

These are explicitly OK as append-only or temp files:

- Raw structured logs in `LOG_DIR` (e.g. `./data/logs/*.jsonl`)
- Sandbox temp files / build artefacts that can be rebuilt on demand
- Any `.tmp` files created during execution and cleared regularly

---

## 3. Operational rules

To keep the system sane as we grow:

1. **No new critical feature may ship with `.cache` as its only storage.**

   - If a feature matters to users (projects, comments, chat, deployments, billing), it gets:
     - a proper DB table/migration
     - indexes where needed
     - a backup strategy

2. **File-based analytics must be append-only & tolerant to loss.**

   - Never treat `.cache/*.json` as the single source of truth for something we promise to customers.

3. **Backups must cover:**

   - The primary DB (full + point-in-time if available)
   - Any non-recreatable uploads (e.g. user-uploaded assets), if they live outside the DB

4. **If in doubt, treat it as critical.**

   - If you’re unsure whether a new piece of data is “critical” or not:
     - Default to DB
     - Document the decision in this file

---

## 4. To-do checks (for future passes)

When hardening for bigger scale or audits, we should:

- [ ] Review all uses of `.cache/` in the repo and confirm each is **semi-critical** or **ephemeral**.
- [ ] Confirm that all workspace/project/comment/chat/deploy entities are DB-backed and included in backups.
- [ ] Document the backup strategy (what is backed up, how often, and how to restore) in a separate `docs/backups.md`.

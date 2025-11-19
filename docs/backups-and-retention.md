# YBuilt – Backups, Data Retention, and Account Deletion (v1)

This doc defines how long we keep data, what we back up, and how we handle deletion.

The goal is simple:

> If something goes wrong, we can restore. If a user leaves, we can remove their data.

---

## 1. What we back up (v1)

We treat the **primary database** (e.g. Postgres/Supabase) as the source of truth.

### 1.1 Must be covered by backups

These tables / entities must be included in regular backups:

- Users (accounts, auth identifiers)
- Teams / organizations
- Workspaces
- Projects / apps / sites
- Comments
- Chat messages
- Deploy records (what was deployed, when, from which workspace)
- Preview metadata (which preview slug maps to which workspace/project)
- Plan / tier / entitlements for each user or workspace

If we ever add new “critical state” (see `docs/data-durability.md`), it must also be covered by backups.

### 1.2 Optional / nice-to-have in backups

These are useful but not required for correctness:

- KPI events (seen/convert, click-through, etc.)
- A/B test aggregates
- AI outcome priors / stats

If these live in the DB, they are automatically backed up.  
If they live in `.cache` / JSONL files, we accept the risk that some history might be lost.

### 1.3 What we *don’t* back up

We do **not** guarantee backups for:

- Raw logs in `LOG_DIR` (e.g. `./data/logs/*.jsonl`)
- Temp sandbox artifacts that can be rebuilt
- Cache-only data that can be recomputed

Losing these should not affect product correctness, only convenience or analytics history.

---

## 2. Retention policy (v1)

We keep different types of data for different lengths of time.

### 2.1 Core product data

- Users, teams, workspaces, projects, comments, chat, deployments:
  - **Retained until explicitly deleted** (by user action or admin).

### 2.2 Logs and analytics

- Request logs and structured backend logs:
  - Target: **30–90 days** (exact window depends on storage cost and infra).
- KPI events / analytics:
  - May be retained longer, but are not guaranteed forever.
  - Not treated as contractual reports in v1.

If storage becomes an issue, we may:

- truncate older logs
- aggregate old analytics into coarser buckets

This should not break the core product.

---

## 3. Backup frequency and restore basics (v1)

We aim for a **simple but reliable** backup story:

### 3.1 Frequency

- **Daily full backups** of the primary DB.
- If supported by infra (e.g. managed Postgres):
  - Enable **point-in-time recovery (PITR)** or WAL archiving.

### 3.2 Storage

- Backups should be stored:
  - Separate from the primary DB host
  - In a location with restricted access (not world-readable)
- We should be able to list backups with:
  - timestamp
  - size
  - status (successful / failed)

### 3.3 Restore drills (manual for v1)

At least a few times per year, we should:

1. Create a **throwaway database** (or staging instance).
2. Restore the latest backup into it.
3. Verify:
   - Users can log in.
   - Workspaces/projects/comments/chat are present.
   - Recent deployments are visible.

If restore fails, we treat that as a critical bug and fix the backup process.

---

## 4. Account deletion (v1 intent)

We support a **basic account deletion** path (even if implemented later in code):

- When a user requests deletion:
  - Mark the user as deleted or remove them from the primary DB.
  - Remove or anonymize:
    - PII (email, name)
    - Direct identifiers
  - Keep:
    - System-level records that must exist for integrity (e.g. deployments, logs), but with user references anonymized where possible.

Backups will still contain historical copies of data until they expire out of the retention window.

---

## 5. Operational rules

To keep things sane as we grow:

1. **No critical feature without backups.**
   - If we add a new critical table, it must be included in DB backups.

2. **Define retention before shipping major logging/analytics.**
   - New large-volume logs or analytics must come with a retention plan.

3. **Test restore, not just backup.**
   - A backup that can’t be restored is useless.
   - We should periodically verify restore into a non-prod environment.

4. **Document changes here.**
   - If we change backup frequency, retention windows, or deletion behavior, we update this file.

---

## 6. Future improvements

Later, for more serious/compliance needs, we may add:

- Per-tenant export tools (download your data)
- Stronger guarantees around deletion timelines
- More granular retention per table/type
- Automated, scheduled restore tests with alerts on failure

For v1, this doc acts as the minimum standard for backups, retention, and deletion behavior on the platform backend.

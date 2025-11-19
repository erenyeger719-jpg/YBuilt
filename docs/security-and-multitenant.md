# YBuilt – Security, Auth, and Multi-Tenant Separation (v1)

This doc defines how we keep tenants separated and secrets safe in YBuilt.

The goal is simple:

> No user or team should ever see or modify data that does not belong to them.

---

## 1. Multi-tenant model (concept)

Core entities:

- **User** – a person with an account.
- **Team / Organization** – a group of users.
- **Workspace** – a top-level space under a team.
- **Project / App / Site** – lives inside a workspace.

Relationship (conceptual):

- `User` ↔ `Team` (via membership)
- `Team` → `Workspace[]`
- `Workspace` → `Project[]`

All collaboration data (chat, comments, logs, etc.) is always attached to a **workspace** or **project**.

---

## 2. Request scoping rules

Every backend route that touches workspace or project data must obey:

1. **Identify user**

   - If the route requires auth:
     - `req.user` **must** be present.
     - If missing, return `401` (unauthorized).

2. **Check membership**

   For any `workspaceId` or `projectId` coming from the client:

   - Resolve workspace/project from DB.
   - Look up membership:
     - **User must belong to the owning team or workspace.**
   - If not a member:
     - Return `403` (forbidden).
     - Never leak whether the workspace/project exists.

3. **No “bare” IDs**

   - Never trust a raw `workspaceId`/`projectId` from the client without verifying:
     - user → team(s) → workspace(s) → project(s)

4. **Collab routes**

   The following areas are **always scoped**:

   - Chat (`/api/chat/*`)
   - Comments (`/api/comments/*`)
   - Logs (`/api/logs/*`)
   - Collab ask-file (`/api/collab/ask-file`)
   - Any future realtime/cursor routes

   For each of these:

   - Extract `workspaceId`/`projectId`.
   - Use collab auth helpers to confirm membership.
   - If membership check fails, deny with `403`.

If a route returns or mutates workspace/project data **without** a membership check, that is a **bug**.

---

## 3. Secrets and configuration

We treat all secrets as **environment configuration**, never hard-coded in the repo.

### 3.1 Where secrets may live

Allowed places:

- Environment variables in the runtime:
  - API keys (e.g. for hosting, email, payment)
  - DB URLs
  - JWT signing keys
- Secret managers (later):
  - e.g. cloud secret store, Vault, etc.

Not allowed:

- No secrets in code files.
- No secrets checked into git.
- No secrets in public client-side JS.

### 3.2 Public vs private config

We distinguish:

- `PUBLIC_*` env vars:
  - Safe to send to the client (e.g. feature flags, public hostnames).
- Non-PUBLIC env vars:
  - Must **never** be sent to the client.
  - Only read in backend code.

If in doubt, treat it as **secret** and keep it server-only.

### 3.3 Rotation plan (v1)

If a secret is compromised or rotated:

- Update it in the environment for:
  - dev
  - staging
  - prod
- Restart the relevant services.
- Verify:
  - login
  - DB connectivity
  - any external APIs relying on that key

We aim to be able to rotate any critical secret in **under 30 minutes**.

---

## 4. Checklist for routes (for future audits)

When reviewing or adding a route:

1. Does it read or write workspace/project/team data?
   - ✔ Ensure it:
     - pulls the workspace/project from DB, and
     - checks user membership.

2. Does it expose logs, comments, chat, or collab data?
   - ✔ Ensure it:
     - scopes everything by workspace/project,
     - uses collab auth helpers where available.

3. Does it use any API keys or secrets?
   - ✔ Ensure they come from env, not hard-coded.

4. Does it send config to the client?
   - ✔ Ensure only `PUBLIC_*` values are exposed.

If any answer is “no”, fix the route or open a ticket before shipping.

---

## 5. Known good areas (v1 snapshot)

As of this version, we intend:

- Collab auth (`server/collab/auth.ts`) to enforce membership for:
  - chat
  - comments
  - logs
  - ask-file

If a future change bypasses these helpers or introduces a new route without membership checks, it should be flagged and corrected.

This doc is a living guide.  
When we add new surfaces (e.g. Autopilot actions, AI agents touching workspace data), they must follow these same rules.

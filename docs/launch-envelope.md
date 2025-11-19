# YBuilt – Launch Envelope (v1 Backend)

This file captures the **current, honest launch envelope** for the YBuilt platform backend.
It is **not** a hard limit baked into code. It is a description of what we have tested and what we are comfortable promising today.

---

## 1. Who this is for (v1)

- Solo developers
- Small teams / early agencies
- Early adopters building real sites/apps with:
  - live previews
  - deploys
  - collaboration (chat, comments, logs)
  - limited code execution in a sandbox

We are **not yet** targeting:
- Enterprise SSO / SOC2 customers
- Heavily regulated industries (healthcare, banking, etc.)

---

## 2. Scale target for v1 (tested envelope)

The backend architecture is **multi-tenant** and designed to scale as far as infra allows.
There is **no hard coded maximum** number of:
- users
- workspaces
- projects

For now, we define the **tested envelope** as:

- Up to **N active users** online at the same time (to be updated from load tests)
- Up to **M concurrent collaborators** per workspace (realistic target: 10–30 to start)
- Up to **X code-execution jobs per minute** across the whole platform

These numbers are intentionally conservative and should be updated after:
- load tests
- real-world traffic
- infra upgrades (more app instances, DB tier upgrades, caching, etc.)

---

## 3. Architectural intent (no arbitrary caps)

We explicitly **do not** want arbitrary limits in code like “max 200 workspaces”.

Instead:

- All core entities (users, teams, workspaces, projects, comments, chat) are designed as **rows in the database**, not in-memory global maps.
- Each request is scoped by:
  - user → team(s) → workspace(s) → project(s)
- Collaboration (sockets, logs, comments, chat) is implemented with:
  - Socket.IO rooms
  - ability to move to a shared adapter (e.g. Redis) when running multiple app instances

Capacity is therefore a function of:
- number and size of app instances
- DB capacity (tier, indexes, replicas)
- caching strategy
- queue/worker setup for heavy jobs

As we scale infra, the effective capacity of the system should increase without core backend rewrites.

---

## 4. Future envelopes

As we grow, we will update this file to reflect:

- New tested limits (e.g. “5,000 concurrent users”, “100 collaborators per workspace”)
- Infra changes (e.g. “App running on k8s with 8 pods”, “Postgres with read replicas”, “Redis cache in front of hot routes”)
- Any places where we **intentionally** add caps for cost or safety
  - e.g. max code-exec jobs per user per day
  - max AI tokens per plan

This file is a living contract between:
- what the backend is architected to do
- what we are comfortable promising to real customers

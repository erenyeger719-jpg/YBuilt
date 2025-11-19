// tests/logs.collab.spec.ts
//
// Integration tests for server/routes/logs.ts with collab scoping.
// We verify three behaviours:
//
// 1) No workspace/project scope → route is a no-op for collab, returns 200.
// 2) Scope present + no user → 403 forbidden (collab_scope_denied).
// 3) Scope present + user.id set → 200 OK.

import { describe, it, expect } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import logsRouter from "../server/routes/logs.ts";

function makeApp(withUser: boolean): Express {
  const app = express();

  if (withUser) {
    // Minimal fake auth: attach a user with an id so getCollabPrincipal
    // sees a principal.userId and allows access.
    app.use((req, _res, next) => {
      (req as any).user = { id: "u-test-123" };
      next();
    });
  }

  app.use("/api/logs", logsRouter);
  return app;
}

describe("logs routes + collab scoping", () => {
  it("allows /recent when no workspace/project scope is provided", async () => {
    const app = makeApp(false);

    const res = await request(app)
      .get("/api/logs/recent?limit=1")
      .expect(200);

    expect(res.body).toHaveProperty("ok", true);
    expect(res.body).toHaveProperty("items");
  });

  it("denies /recent when scope is provided but no user is present", async () => {
    const app = makeApp(false);

    const res = await request(app)
      .get("/api/logs/recent?workspaceId=ws-123&projectId=proj-456&limit=1")
      .expect(403);

    expect(res.body).toMatchObject({
      ok: false,
      error: "forbidden",
      reason: "collab_scope_denied",
    });
  });

  it("allows /recent when scope is provided and a user is present", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .get("/api/logs/recent?workspaceId=ws-123&projectId=proj-456&limit=1")
      .expect(200);

    expect(res.body).toHaveProperty("ok", true);
    expect(res.body).toHaveProperty("items");
  });

  it("denies /by-id when scope is provided but no user is present", async () => {
    const app = makeApp(false);

    const res = await request(app)
      .get("/api/logs/by-id/req-123?workspaceId=ws-123&projectId=proj-456")
      .expect(403);

    expect(res.body).toMatchObject({
      ok: false,
      error: "forbidden",
      reason: "collab_scope_denied",
    });
  });

  it("allows /by-id when scope is provided and a user is present", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .get("/api/logs/by-id/req-123?workspaceId=ws-123&projectId=proj-456")
      .expect(200);

    expect(res.body).toHaveProperty("ok", true);
  });
});

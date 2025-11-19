// tests/comments.collab.spec.ts
//
// Integration tests for server/routes/comments.js with collab scoping.
//
// We verify:
// 1) Missing scope → 400 (we require workspaceId + projectId at API level).
// 2) Scope + no user → 403 forbidden (collab_scope_denied).
// 3) Scope + user → can create, list, resolve, and delete comments.

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import commentsRouter from "../server/routes/comments.js";

function makeApp(withUser: boolean): Express {
  const app = express();

  app.use(express.json());

  if (withUser) {
    app.use((req, _res, next) => {
      (req as any).user = { id: "u-test-123" };
      next();
    });
  }

  app.use("/api/comments", commentsRouter);
  return app;
}

describe("comments routes + collab scoping", () => {
  beforeEach(() => {
    // Nothing to reset yet; the router's in-memory store is process-wide,
    // but tests below are written to not depend on isolation across runs.
  });

  it("returns 400 when workspace/project scope is missing on GET", async () => {
    const app = makeApp(true);

    const res = await request(app).get("/api/comments").expect(400);

    expect(res.body).toMatchObject({
      ok: false,
      error: "missing_scope",
    });
  });

  it("returns 403 when scope is provided but no user is present (POST)", async () => {
    const app = makeApp(false);

    const res = await request(app)
      .post("/api/comments")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
        body: "Hello",
      })
      .expect(403);

    expect(res.body).toMatchObject({
      ok: false,
      error: "forbidden",
      reason: "collab_scope_denied",
    });
  });

  it("allows full lifecycle with scope + user present", async () => {
    const app = makeApp(true);

    // Create
    const createRes = await request(app)
      .post("/api/comments")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
        filePath: "/src/index.tsx",
        body: "First comment",
      })
      .expect(201);

    expect(createRes.body).toHaveProperty("ok", true);
    expect(createRes.body).toHaveProperty("item");
    const commentId = createRes.body.item.id as string;

    // List
    const listRes = await request(app)
      .get(
        "/api/comments?workspaceId=ws-1&projectId=proj-1&filePath=/src/index.tsx"
      )
      .expect(200);

    expect(listRes.body).toHaveProperty("ok", true);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(listRes.body.items.length).toBeGreaterThanOrEqual(1);

    // Resolve
    const resolveRes = await request(app)
      .post(`/api/comments/${commentId}/resolve`)
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
      })
      .expect(200);

    expect(resolveRes.body).toHaveProperty("ok", true);
    expect(resolveRes.body.item.resolved).toBe(true);

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
      })
      .expect(200);

    expect(deleteRes.body).toHaveProperty("ok", true);
  });

  it("returns 404 when resolving a non-existent comment", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .post("/api/comments/non-existent-id/resolve")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
      })
      .expect(404);

    expect(res.body).toMatchObject({
      ok: false,
      error: "not_found",
    });
  });

  it("returns 404 when deleting a non-existent comment", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .delete("/api/comments/non-existent-id")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
      })
      .expect(404);

    expect(res.body).toMatchObject({
      ok: false,
      error: "not_found",
    });
  });
});

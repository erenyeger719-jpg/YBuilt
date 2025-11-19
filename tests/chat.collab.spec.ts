// tests/chat.collab.spec.ts
//
// Integration tests for server/routes/chat.js with collab scoping.
//
// We verify:
// 1) Missing scope → 400 (workspaceId + projectId required).
// 2) Scope + no user → 403 forbidden (collab_scope_denied).
// 3) Scope + user → can send, list, and delete messages.

import { describe, it, expect } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import chatRouter from "../server/routes/chat.js";

function makeApp(withUser: boolean): Express {
  const app = express();

  app.use(express.json());

  if (withUser) {
    app.use((req, _res, next) => {
      (req as any).user = { id: "u-test-123" };
      next();
    });
  }

  app.use("/api/chat", chatRouter);
  return app;
}

describe("chat routes + collab scoping", () => {
  it("returns 400 when workspace/project scope is missing on GET /messages", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .get("/api/chat/messages")
      .expect(400);

    expect(res.body).toMatchObject({
      ok: false,
      error: "missing_scope",
    });
  });

  it("returns 403 when scope is provided but no user is present (POST /messages)", async () => {
    const app = makeApp(false);

    const res = await request(app)
      .post("/api/chat/messages")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
        text: "Hello world",
      })
      .expect(403);

    expect(res.body).toMatchObject({
      ok: false,
      error: "forbidden",
      reason: "collab_scope_denied",
    });
  });

  it("allows basic lifecycle with scope + user present", async () => {
    const app = makeApp(true);

    // Send message
    const sendRes = await request(app)
      .post("/api/chat/messages")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
        threadId: "main",
        text: "First message",
      })
      .expect(201);

    expect(sendRes.body).toHaveProperty("ok", true);
    expect(sendRes.body).toHaveProperty("item");
    const msgId = sendRes.body.item.id as string;

    // List messages
    const listRes = await request(app)
      .get(
        "/api/chat/messages?workspaceId=ws-1&projectId=proj-1&threadId=main"
      )
      .expect(200);

    expect(listRes.body).toHaveProperty("ok", true);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(listRes.body.items.length).toBeGreaterThanOrEqual(1);

    // Delete message
    const delRes = await request(app)
      .delete(`/api/chat/messages/${msgId}`)
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
      })
      .expect(200);

    expect(delRes.body).toHaveProperty("ok", true);
  });

  it("returns 404 when deleting a non-existent message", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .delete("/api/chat/messages/non-existent-id")
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

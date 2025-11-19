// tests/collab.ask-file.spec.ts
//
// Integration tests for server/routes/collab.ask-file.ts with collab scoping.
//
// We verify:
// 1) Missing scope → 400 (workspaceId + projectId required).
// 2) Scope + no user → 403 forbidden (collab_scope_denied).
// 3) Scope + user + missing file → 404 (file_not_found).
// 4) Scope + user + real file → 200 with ok:true and meta.

import { describe, it, expect } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import collabAskFileRouter from "../server/routes/collab.ask-file.ts";

function makeApp(withUser: boolean): Express {
  const app = express();

  app.use(express.json());

  if (withUser) {
    app.use((req, _res, next) => {
      (req as any).user = { id: "u-test-123" };
      next();
    });
  }

  app.use("/api/collab", collabAskFileRouter);
  return app;
}

describe("collab ask-file route + collab scoping", () => {
  it("returns 400 when workspace/project scope is missing", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .post("/api/collab/ask-file")
      .send({
        filePath: "server/routes/chat.ts",
        question: "What does this file do?",
      })
      .expect(400);

    expect(res.body).toMatchObject({
      ok: false,
      error: "missing_scope",
    });
  });

  it("returns 403 when scope is provided but no user is present", async () => {
    const app = makeApp(false);

    const res = await request(app)
      .post("/api/collab/ask-file")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
        filePath: "server/routes/chat.ts",
        question: "Explain this route",
      })
      .expect(403);

    expect(res.body).toMatchObject({
      ok: false,
      error: "forbidden",
      reason: "collab_scope_denied",
    });
  });

  it("returns 404 when the target file does not exist", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .post("/api/collab/ask-file")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
        filePath: "server/routes/no-such-file-xyz.ts",
        question: "Will this fail?",
      })
      .expect(404);

    expect(res.body).toMatchObject({
      ok: false,
      error: "file_not_found",
    });
  });

  it("returns 200 with an answer and meta for a real file", async () => {
    const app = makeApp(true);

    const res = await request(app)
      .post("/api/collab/ask-file")
      .send({
        workspaceId: "ws-1",
        projectId: "proj-1",
        filePath: "server/routes/chat.ts",
        question: "Summarize this chat route.",
        selection: { lineStart: 1, lineEnd: 20 },
      })
      .expect(200);

    expect(res.body).toHaveProperty("ok", true);
    expect(typeof res.body.answer).toBe("string");

    const meta = res.body.meta;
    expect(meta).toBeTruthy();
    expect(meta.workspaceId).toBe("ws-1");
    expect(meta.projectId).toBe("proj-1");
    expect(meta.filePath).toBe("server/routes/chat.ts");
    expect(meta.selection).toBeTruthy();
    expect(meta.selection.lineStart).toBeGreaterThanOrEqual(1);
    expect(meta.selection.lineEnd).toBeGreaterThanOrEqual(
      meta.selection.lineStart
    );
    expect(typeof meta.snippetPreview).toBe("string");
    expect(meta.snippetPreview.length).toBeGreaterThan(0);
  });
});

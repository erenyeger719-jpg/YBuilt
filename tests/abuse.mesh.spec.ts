// tests/abuse.mesh.spec.ts
import { describe, it, expect } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { abuseMesh } from "../server/middleware/abuse.mesh";
import fs from "fs";
import path from "path";

function makeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: any = undefined;

  const res: Partial<Response> & {
    _headers: typeof headers;
    _body: any;
    _statusCode: number;
  } = {
    _headers: headers,
    _body: body,
    _statusCode: statusCode,
    setHeader(name: string, value: any) {
      headers[name] = String(value);
      return this as any;
    },
    status(code: number) {
      statusCode = code;
      (this as any)._statusCode = code;
      return this as any;
    },
    json(payload: any) {
      body = payload;
      (this as any)._body = payload;
      return this as any;
    },
    locals: {},
  };

  return res as Response & {
    _headers: Record<string, string>;
    _body: any;
    _statusCode: number;
  };
}

describe("abuse.mesh – abuseMesh", () => {
  it("passes through clean prompts without logging", () => {
    const req = {
      method: "POST",
      path: "/instant",
      body: { prompt: "just a normal landing page prompt" },
      headers: { "user-agent": "test-agent" },
    } as unknown as Request;

    const res = makeRes();
    let calledNext = false;
    const next: NextFunction = () => {
      calledNext = true;
    };

    const mw = abuseMesh();
    mw(req, res, next);

    expect(calledNext).toBe(true);
    expect((res.locals as any).abuse).toBeUndefined();
    expect(res._headers["X-Abuse-Reasons"]).toBeUndefined();
  });

  it("flags sketchy prompts, sets locals/header, and writes JSONL audit", () => {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(".cache", "abuse");
    const meshFile = path.join(dir, `mesh-${day}.jsonl`);

    // Clean up any previous run for determinism
    try {
      if (fs.existsSync(meshFile)) {
        fs.unlinkSync(meshFile);
      }
    } catch {
      // ignore cleanup errors
    }

    const req = {
      method: "POST",
      path: "/instant",
      body: {
        prompt:
          "This is guaranteed profit, free money pump and dump, 1000% return",
      },
      headers: {
        "user-agent": "test-agent",
        "x-forwarded-for": "203.0.113.1",
      },
    } as unknown as Request;

    const res = makeRes();
    let calledNext = false;
    const next: NextFunction = () => {
      calledNext = true;
    };

    const mw = abuseMesh();
    mw(req, res, next);

    expect(calledNext).toBe(true);

    // locals
    const abuse = (res.locals as any).abuse;
    expect(abuse).toBeDefined();
    expect(abuse.reasons).toContain("sketchy_prompt");

    // header
    expect(res._headers["X-Abuse-Reasons"]).toContain("sketchy_prompt");

    // JSONL log
    const exists = fs.existsSync(meshFile);
    expect(exists).toBe(true);

    const content = fs.readFileSync(meshFile, "utf8").trim();
    expect(content.length).toBeGreaterThan(0);

    const lines = content.split("\n");
    const last = JSON.parse(lines[lines.length - 1]);

    expect(last.path).toBe("/instant");
    expect(last.reasons).toContain("sketchy_prompt");
    expect(last.ip).toBe("203.0.113.1");
  });

  it("logs workspaceId when header is set", () => {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(".cache", "abuse");
    const meshFile = path.join(dir, `mesh-${day}.jsonl`);

    // Clean up any previous run for determinism
    try {
      if (fs.existsSync(meshFile)) {
        fs.unlinkSync(meshFile);
      }
    } catch {
      // ignore cleanup errors
    }

    const req = {
      method: "POST",
      path: "/instant",
      body: {
        prompt: "free money pump and dump", // will trigger sketchy_prompt
      },
      headers: {
        "user-agent": "test-agent",
        "x-forwarded-for": "198.51.100.2",
        "x-workspace-id": "ws_test",
      },
    } as unknown as Request;

    const res = makeRes();
    let calledNext = false;
    const next: NextFunction = () => {
      calledNext = true;
    };

    const mw = abuseMesh();
    mw(req, res, next);

    expect(calledNext).toBe(true);

    const exists = fs.existsSync(meshFile);
    expect(exists).toBe(true);

    const content = fs.readFileSync(meshFile, "utf8").trim();
    const lines = content.split("\n");
    const last = JSON.parse(lines[lines.length - 1]);

    expect(last.path).toBe("/instant");
    expect(last.reasons).toContain("sketchy_prompt");
    expect(last.ip).toBe("198.51.100.2");

    // new check: workspace awareness
    expect(last.workspaceId).toBe("ws_test");
  });
});

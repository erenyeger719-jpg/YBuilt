// tests/abuse.mesh.spec.ts
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { abuseMesh } from "../server/middleware/abuse.mesh";
import * as fs from "fs";

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
    const spy = vi.spyOn(fs, "appendFileSync").mockImplementation(() => {});

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
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("flags sketchy prompts and writes an audit entry", () => {
    const spy = vi.spyOn(fs, "appendFileSync").mockImplementation(() => {});

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

    // audit log got a JSONL write
    expect(spy).toHaveBeenCalled();
    const [filePath, line] = spy.mock.calls[0] as [string, string];
    expect(filePath).toContain(".cache");
    expect(line).toContain('"path":"/instant"');
    expect(line).toContain('"sketchy_prompt"');

    spy.mockRestore();
  });
});

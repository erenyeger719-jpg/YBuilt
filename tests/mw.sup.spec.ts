// tests/mw.sup.spec.ts
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { supGuard } from "../server/mw/sup";
import * as policy from "../server/sup/policy.core";

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

describe("mw/sup – supGuard", () => {
  it("allows safe content and calls next()", () => {
    const spy = vi
      .spyOn(policy, "supDecide")
      .mockReturnValue({ mode: "allow", reasons: [] } as any);

    const req = {
      method: "POST",
      path: "/instant",
      body: { prompt: "just a normal prompt" },
      headers: {},
    } as unknown as Request;

    const res = makeRes();
    let calledNext = false;
    const next: NextFunction = () => {
      calledNext = true;
    };

    const mw = supGuard("ai");
    mw(req, res, next);

    expect(calledNext).toBe(true);
    expect(res._body).toBeUndefined();
    expect(res._headers["X-SUP-Mode"]).toBe("allow");
    expect(res._headers["X-SUP-Policy-Version"]).toBe(policy.POLICY_VERSION);
    expect(res._headers["X-SUP-Reasons"]).toBe("");
    spy.mockRestore();
  });

  it("blocks risky content on hot routes with sup_block envelope", () => {
    const spy = vi
      .spyOn(policy, "supDecide")
      .mockReturnValue({ mode: "block", reasons: ["unproven_claims"] } as any);

    const req = {
      method: "POST",
      path: "/instant",
      body: { prompt: "we are #1 and 1000% better" },
      headers: {},
    } as unknown as Request;

    const res = makeRes();
    let calledNext = false;
    const next: NextFunction = () => {
      calledNext = true;
    };

    const mw = supGuard("ai");
    mw(req, res, next);

    const body = res._body;

    expect(calledNext).toBe(false);
    expect(body).toMatchObject({
      ok: true,
      result: {
        error: "sup_block",
        sup: {
          mode: "block",
          reasons: ["unproven_claims"],
        },
      },
    });

    // fallback is nested under result
    expect(body.result).toBeDefined();
    expect(body.result.fallback).toBeDefined();

    const fallback = body.result.fallback;
    expect(fallback.status).toBe("fallback");
    expect(typeof fallback.code).toBe("string");
    expect(fallback.code.startsWith("sup_block.")).toBe(true);
    expect(typeof fallback.title).toBe("string");
    expect(typeof fallback.body).toBe("string");

    expect(res._headers["X-SUP-Mode"]).toBe("block");
    expect(res._headers["X-SUP-Reasons"]).toContain("unproven_claims");
    spy.mockRestore();
  });

  it("fails closed when supDecide throws but still calls next()", () => {
    const spy = vi
      .spyOn(policy, "supDecide")
      .mockImplementation(() => {
        throw new Error("boom");
      });

    const req = {
      method: "POST",
      path: "/instant",
      body: { prompt: "anything" },
      headers: {},
    } as unknown as Request;

    const res = makeRes();
    let calledNext = false;
    const next: NextFunction = () => {
      calledNext = true;
    };

    const mw = supGuard("ai");
    mw(req, res, next);

    expect(calledNext).toBe(true);
    expect(res._body).toBeUndefined();
    expect(res._headers["X-SUP-Mode"]).toBe("strict");
    expect(res._headers["X-SUP-Reasons"]).toContain("sup_internal_error");
    spy.mockRestore();
  });
});
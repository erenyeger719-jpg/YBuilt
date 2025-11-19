// tests/backend.quotas-plans.test.ts
// Run with: pnpm tsx tests/backend.quotas-plans.test.ts

import assert from "node:assert/strict";
import { quotaGate } from "../server/middleware/limits.ts";

type AnyReq = any;
type AnyRes = any;

function makeReq(
  path: string,
  method: string,
  headers: Record<string, string> = {},
): AnyReq {
  return {
    method,
    originalUrl: path,
    url: path,
    path,
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    ip: "127.0.0.1",
  };
}

function makeRes(): AnyRes {
  const res: AnyRes = {
    statusCode: 200,
    headers: {} as Record<string, any>,
    body: undefined as any,
    setHeader(name: string, value: any) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function main() {
  // One quota rule, similar to what you have in server/index.ts
  const gate = quotaGate([
    {
      path: /^\/api\/previews\/fork/i,
      limit: 2, // base limit (free plan)
      methods: ["POST"],
      keyFn: () => "user-1",
    },
  ]);

  function callOnce(req: AnyReq, res: AnyRes) {
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    gate(req, res, next);
    return { nextCalled };
  }

  // --- Free plan: allow 2, block 3rd ---
  {
    const path = "/api/previews/fork";
    const headers: Record<string, string> = {}; // no x-plan => free

    const req1 = makeReq(path, "POST", headers);
    const res1 = makeRes();
    let r = callOnce(req1, res1);
    assert.equal(r.nextCalled, true, "free: first call should pass");

    const req2 = makeReq(path, "POST", headers);
    const res2 = makeRes();
    r = callOnce(req2, res2);
    assert.equal(r.nextCalled, true, "free: second call should pass");

    const req3 = makeReq(path, "POST", headers);
    const res3 = makeRes();
    r = callOnce(req3, res3);
    assert.equal(r.nextCalled, false, "free: third call should be blocked");
    assert.equal(res3.statusCode, 429, "free: third call should return 429");
    assert.ok(res3.body, "free: response body should exist");
    assert.equal(res3.body.error, "quota_exceeded");
    assert.equal(res3.body.plan, "free");
    assert.equal(res3.body.limit, 2);
  }

  // --- Creator plan: should allow more than free ---
  {
    const path = "/api/previews/fork";
    const headers: Record<string, string> = { "x-plan": "creator" };

    let allowed = 0;
    for (let i = 0; i < 4; i++) {
      const req = makeReq(path, "POST", headers);
      const res = makeRes();
      const { nextCalled } = callOnce(req, res);
      if (nextCalled) {
        allowed += 1;
      } else {
        // If we ever hit quota, assert shape then break.
        assert.equal(res.statusCode, 429);
        assert.equal(res.body.error, "quota_exceeded");
        assert.equal(res.body.plan, "creator");
        break;
      }
    }

    // Free hit the wall at 2; creator should comfortably do 3+.
    assert.ok(allowed >= 3, "creator plan should allow more than free");
  }

  console.log("backend.quotas-plans.test: OK");
}

main();

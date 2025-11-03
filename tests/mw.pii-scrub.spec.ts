// tests/mw.pii-scrub.spec.ts
import { describe, it, expect } from "vitest";
import piiScrub from "../server/mw/pii-scrub";

function makeReqRes(body: any = {}) {
  const headers: Record<string, string> = {};

  const req: any = { body };
  const res: any = {
    locals: {},
    setHeader: (k: string, v: string) => {
      headers[k] = String(v);
    },
  };

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  return { req, res, headers, next: next as any, getNextCalled: () => nextCalled };
}

describe("mw/pii-scrub – piiScrub middleware", () => {
  it("redacts emails, phones, and credit-cards from prompt and copy", () => {
    const { req, res, headers, next, getNextCalled } = makeReqRes({
      prompt: "Email me at test@example.com or call +1 555-123-4567",
      copy: {
        hero: "Pay with 4111 1111 1111 1111 now!",
      },
    });

    const mw = piiScrub();
    mw(req as any, res as any, next);

    expect(getNextCalled()).toBe(true);

    // prompt scrubbed
    expect(req.body.prompt).not.toContain("test@example.com");
    expect(req.body.prompt).not.toContain("555-123-4567");
    expect(req.body.prompt).toContain("[EMAIL]");
    expect(req.body.prompt).toContain("[PHONE]");

    // nested copy scrubbed
    expect(req.body.copy.hero).not.toContain("4111 1111 1111 1111");
    expect(req.body.copy.hero).toContain("[CC]");

    // headers + locals set
    expect(headers["X-PII-Redacted"]).toBe("1");
    expect(headers["X-PII-Counts"]).toBeTruthy();
    expect((res.locals as any).pii).toBeDefined();
    expect((res.locals as any).pii.redacted).toBe(true);
  });

  it("leaves safe bodies alone and does not set PII headers", () => {
    const { req, res, headers, next, getNextCalled } = makeReqRes({
      prompt: "Just a normal marketing headline.",
      copy: { hero: "Nothing sensitive here." },
    });

    const mw = piiScrub();
    mw(req as any, res as any, next);

    expect(getNextCalled()).toBe(true);

    // Body unchanged
    expect(req.body.prompt).toBe("Just a normal marketing headline.");
    expect(req.body.copy.hero).toBe("Nothing sensitive here.");

    // No PII headers if nothing was redacted
    expect(headers["X-PII-Redacted"]).toBeUndefined();
    expect(headers["X-PII-Counts"]).toBeUndefined();
    expect((res.locals as any).pii).toBeUndefined();
  });
});

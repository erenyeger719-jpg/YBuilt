// tests/flow.email.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { handleWelcome } from "../server/routes/flow.email.ts";

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
  };

  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn().mockImplementation((body: any) => {
    res.body = body;
    return res;
  });

  return res as Response & { statusCode: number; body: any };
}

// keep original fetch so we can put it back after each test
const originalFetch = (globalThis as any).fetch;

describe("flow.email – /welcome handler", () => {
  beforeEach(() => {
    delete process.env.EMAIL_WELCOME_ENDPOINT;
    delete process.env.EMAIL_WELCOME_FROM;
    vi.restoreAllMocks();
    (globalThis as any).fetch = originalFetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it("returns 400 missing_api_key when header is absent", async () => {
    const req = {
      headers: {},
      body: { email: "user@example.com" },
    } as unknown as Request;
    const res = makeRes();

    await handleWelcome(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: "missing_api_key",
    });
  });

  it("returns 400 invalid_email for bad email", async () => {
    const req = {
      headers: { "x-email-api-key": "secret-key" },
      body: { email: "not-an-email" },
    } as unknown as Request;
    const res = makeRes();

    await handleWelcome(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: "invalid_email",
    });
  });

  it("returns stub response when endpoint/from are not configured and never logs the key", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const req = {
      headers: { "x-email-api-key": "secret-key" },
      body: {
        email: "User@Example.com",
        pageId: "pg1",
        meta: { source: "test" },
      },
    } as unknown as Request;
    const res = makeRes();

    await handleWelcome(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      stub: true,
      warning: "email_not_configured",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [label, payload] = logSpy.mock.calls[0] as [string, any];

    expect(label).toBe("[flow.email] welcome (stub)");
    expect(payload).toMatchObject({
      to: "user@example.com",
      pageId: "pg1",
      configured: false,
    });
    expect(payload).not.toHaveProperty("apiKey");
    // extra safety: payload should not accidentally contain the raw key string
    expect(JSON.stringify(payload)).not.toContain("secret-key");
  });

  it("calls provider and returns ok when configured and provider succeeds (no key leaked in logs)", async () => {
    process.env.EMAIL_WELCOME_ENDPOINT = "https://example.test/welcome";
    process.env.EMAIL_WELCOME_FROM = "noreply@example.test";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    (globalThis as any).fetch = fetchMock;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const req = {
      headers: { "x-email-api-key": "secret-key" },
      body: {
        email: "user@example.com",
        pageId: "pg1",
        meta: { source: "test" },
      },
    } as unknown as Request;
    const res = makeRes();

    await handleWelcome(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, any];

    expect(endpoint).toBe("https://example.test/welcome");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.headers["x-api-key"]).toBe("secret-key");

    const parsed = JSON.parse(init.body);
    expect(parsed).toMatchObject({
      to: "user@example.com",
      from: "noreply@example.test",
      pageId: "pg1",
      meta: { source: "test" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // log should be the non-stub variant and MUST NOT contain the key
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [label, payload] = logSpy.mock.calls[0] as [string, any];

    expect(label).toBe("[flow.email] welcome");
    expect(JSON.stringify(payload)).not.toContain("secret-key");
  });

  it("returns 502 email_send_failed when provider responds with error", async () => {
    process.env.EMAIL_WELCOME_ENDPOINT = "https://example.test/welcome";
    process.env.EMAIL_WELCOME_FROM = "noreply@example.test";

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    (globalThis as any).fetch = fetchMock;

    const req = {
      headers: { "x-email-api-key": "secret-key" },
      body: { email: "user@example.com" },
    } as unknown as Request;
    const res = makeRes();

    await handleWelcome(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      ok: false,
      error: "email_send_failed",
      status: 503,
    });
  });

  it("returns 502 email_send_failed when provider throws", async () => {
    process.env.EMAIL_WELCOME_ENDPOINT = "https://example.test/welcome";
    process.env.EMAIL_WELCOME_FROM = "noreply@example.test";

    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    (globalThis as any).fetch = fetchMock;

    const req = {
      headers: { "x-email-api-key": "secret-key" },
      body: { email: "user@example.com" },
    } as unknown as Request;
    const res = makeRes();

    await handleWelcome(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      ok: false,
      error: "email_send_failed",
    });
  });
});

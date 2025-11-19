// tests/routes.abuse.spec.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import fs from "fs";
import path from "path";
import type { Server } from "http";

const TEST_LOG = path.resolve(".cache/test.abuse.log");

let server: Server | null = null;
let baseUrl = "";

// Helper to start a tiny app with the real abuse router
async function startTestServer() {
  // Make sure tests log to a separate file
  process.env.ABUSE_LOG_FILE = TEST_LOG;

  const app = express();
  app.use(express.json());

  const mod = await import("../server/routes/abuse.ts");
  const abuseRouter = mod.default;

  app.use("/api/abuse", abuseRouter);

  await new Promise<void>((resolve) => {
    const s = app.listen(0, () => {
      server = s;
      const addr = s.address();
      const port =
        typeof addr === "string" ? 80 : (addr && (addr as any).port) || 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopTestServer() {
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
    server = null;
  }
  if (fs.existsSync(TEST_LOG)) {
    try {
      fs.unlinkSync(TEST_LOG);
    } catch {
      // ignore
    }
  }
}

beforeAll(async () => {
  await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

describe("abuse routes", () => {
  it("writes a line for /report", async () => {
    const res = await (globalThis as any).fetch(
      `${baseUrl}/api/abuse/report`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "user sent extremely abusive content",
          where: "/api/ai/act?mode=autopilot",
          meta: { kind: "prompt_abuse", userId: "test-user" },
        }),
      }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });

    const raw = fs.readFileSync(TEST_LOG, "utf8");
    const lines = raw
      .trim()
      .split("\n")
      .filter(Boolean);

    expect(lines.length).toBeGreaterThanOrEqual(1);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.reason).toContain("abusive content");
    expect(last.where).toBe("/api/ai/act?mode=autopilot");
  });

  it("respects /intake and logs with alias marker", async () => {
    const res = await (globalThis as any).fetch(
      `${baseUrl}/api/abuse/intake`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "vitest-abuse-suite",
        },
        body: JSON.stringify({
          type: "generic",
          note: "test intake note",
          meta: { source: "unit-test" },
        }),
      }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });

    const raw = fs.readFileSync(TEST_LOG, "utf8");
    const lines = raw
      .trim()
      .split("\n")
      .filter(Boolean);

    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.where).toBe("intake");
    expect(last.meta).toBeDefined();
    expect(last.meta.note).toBe("test intake note");
  });

  it("returns recent entries from /recent", async () => {
    const res = await (globalThis as any).fetch(
      `${baseUrl}/api/abuse/recent?limit=10`
    );

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeGreaterThan(0);

    const last = json.items[json.items.length - 1];
    expect(typeof last.reason).toBe("string");
    expect(last.ts).toBeDefined();
  });
});

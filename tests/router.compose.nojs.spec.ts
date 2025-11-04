// tests/router.compose.nojs.spec.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// --- Mocks ---
// Mock server/ai/router.ts so we don't pull in subrouters (and avoid circular router.use issues)
vi.mock("../server/ai/router.ts", () => {
  return {
    LAST_COMPOSE: null,
    DEV_PREVIEW_DIR: ".cache/dev-previews",
    PREVIEW_DIR: ".cache/previews",
    ensureCache: () => {},
  };
});

// Mock router helpers so cacheMW + proof stuff are safe and cheap in tests
vi.mock("../server/ai/router.helpers.ts", () => {
  return {
    requireFetch: () => (globalThis as any).fetch,
    baseUrl: () => "http://localhost",
    childHeaders: () => ({}),
    sha1: () => "sha1-test",
    escapeHtml: (s: string) => s,
    drainMode: () => false,

    // Important: make cacheMW a no-op middleware
    cacheMW: () => (_req: any, _res: any, next: any) => next(),

    // Keep SUP/Risk stuff off for this test
    hasRiskyClaims: () => false,
    isProofStrict: () => false,

    fetchTextWithTimeout: async () => "",
    segmentSwapSections: (sections: any) => sections,
    inferAudience: () => "",
    quickGuessIntent: () => null,
    stableStringify: (v: any) => JSON.stringify(v),
    dslKey: () => "dsl-key-test",
    applyChipLocal: (x: any) => x,
    auditUXFromHtml: () => ({ issues: [] }),
    injectCssIntoHead: (html: string) => html,
  };
});

// Mock cache so /instant never hits any "sticky" branches
vi.mock("../server/intent/cache.ts", () => {
  return {
    cacheGet: () => null,
    cacheSet: () => {},
    normalizeKey: (s: string) => s,
  };
});

// Now import the compose setup function (after mocks)
import { setupComposeRoutes } from "../server/ai/router.compose";

describe("ai/router.compose – noJs flag wiring", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Create a router just for compose routes
    const compose = express.Router();
    setupComposeRoutes(compose);

    // Mount it where the main app would
    app.use("/ai", compose);
  });

  it("includes a boolean noJs flag in the /instant JSON response", async () => {
    const res = await request(app)
      .post("/ai/instant")
      .send({
        prompt: "test prompt for noJs wiring",
        sessionId: "test-session",
      })
      .expect(200);

    // The route should always include noJs
    expect(res.body).toHaveProperty("noJs");
    expect(typeof res.body.noJs).toBe("boolean");
  });
});

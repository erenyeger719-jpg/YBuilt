// tests/router.compose.nojs.spec.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Import the compose router
import { composeRouter } from "../server/ai/router.compose";

// IMPORTANT: mock shouldStripJS so it's predictable
vi.mock("../server/perf/budgets", async (orig) => {
  const actual = await (orig as any)();
  return {
    ...actual,
    shouldStripJS: vi.fn(() => true), // always say "noJs = true" in this test
  };
});

describe("ai/router.compose – noJs flag wiring", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/ai", composeRouter);
  });

  it("includes noJs=true in the compose JSON response when shouldStripJS returns true", async () => {
    const res = await request(app)
      .post("/ai/compose")         // adjust path if your route is different
      .send({
        // minimal valid body your /compose expects; simplify if you can
        brief: { goal: "test", audience: "testers" },
      })
      .expect(200);

    // We mocked shouldStripJS to always be true
    expect(res.body.noJs).toBe(true);

    // If you also put noJs inside perf, you can assert that too:
    if (res.body.perf) {
      expect(res.body.perf.noJs).toBe(true);
    }
  });
});

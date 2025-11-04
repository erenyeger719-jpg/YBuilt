// tests/router.compose.nojs.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Import the *actual* compose router (as used in production)
import { composeRouter } from "../server/ai/subrouters";

describe("ai/router.compose – noJs flag wiring", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mount compose router under /ai, like main router does
    app.use("/ai", composeRouter);
  });

  it("includes a boolean noJs flag in the /instant JSON response", async () => {
    const res = await request(app)
      .post("/ai/instant")
      .send({
        prompt: "test prompt for noJs wiring",
        sessionId: "test-session",
      })
      .expect(200);

    // Check that the noJs flag is present and boolean
    expect(res.body).toHaveProperty("noJs");
    expect(typeof res.body.noJs).toBe("boolean");
  });
});

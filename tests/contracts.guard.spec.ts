import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("contracts guard", () => {
  it("blocks when proof metrics are bad and sets guard headers", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const res = await a
      .post("/api/ai/act")
      .send({
        action: {
          kind: "compose",
          args: { pageId: "pg_bad_contracts_123" },
        },
      });

    // contractsGuard should intercept and block
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe("contracts_failed");

    // Guard headers should be present
    expect(res.headers["x-guard-cls"]).toBeDefined();
    expect(res.headers["x-guard-lcp"]).toBeDefined();
    expect(res.headers["x-guard-a11y"]).toBeDefined();
    expect(res.headers["x-guard-proof"]).toBeDefined();
    expect(res.headers["x-guard-proof"]).toBe("false");
  });
});

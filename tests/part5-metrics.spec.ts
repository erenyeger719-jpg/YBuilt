import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Part5: metrics & proof & previews", () => {
  it("/proof/:id auto-creates minimal card if missing", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const r = await a.get("/api/ai/proof/pg_auto_123");
    expect(r.body.ok).toBe(true);
    expect(r.body.proof.pageId).toBe("pg_auto_123");
    expect(r.body.proof.signature).toBeDefined();
  });

  it("preview path traversal is blocked", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const r = await a.get("/api/ai/previews/../../../etc/passwd");
    expect([400,500]).toContain(r.status);
  });

  it("/metrics returns safe snapshot", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const r = await a.get("/api/ai/metrics");
    expect(r.body.ok).toBe(true);
    expect(r.body.url_costs).toBeDefined();
  });
});

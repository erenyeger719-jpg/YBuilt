import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
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
    expect([400, 500]).toContain(r.status);
  });

  it("/metrics returns safe snapshot", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const r = await a.get("/api/ai/metrics");
    expect(r.body.ok).toBe(true);
    expect(r.body.url_costs).toBeDefined();
  });

  it("/metrics/guardrail returns SUP + KPI guardrail snapshot", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Seed a tiny SUP audit log so we can see non-null sup + sup_rates.
    const logsDir = path.join(".logs", "sup");
    const auditPath = path.join(logsDir, "audit.jsonl");

    fs.mkdirSync(logsDir, { recursive: true });

    const lines = [
      JSON.stringify({
        mode: "allow",
        ms: 100,
        pii_present: false,
        abuse_reasons: [],
      }),
      JSON.stringify({
        mode: "block",
        ms: 300,
        pii_present: true,
        abuse_reasons: ["spam"],
      }),
    ];

    fs.writeFileSync(auditPath, lines.join("\n") + "\n", "utf8");

    const r = await a.get("/api/ai/metrics/guardrail");

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    const { sup, sup_rates, conversions_total, last_convert_ts } = r.body;

    // Basic shape checks
    expect(sup).toBeTruthy();
    expect(typeof sup.total).toBe("number");
    expect(sup.total).toBeGreaterThan(0);

    expect(sup_rates).toBeTruthy();
    expect(sup_rates).toHaveProperty("allow_pct");
    expect(sup_rates).toHaveProperty("block_pct");
    expect(sup_rates).toHaveProperty("pii_pct");
    expect(sup_rates).toHaveProperty("abuse_pct");

    // With 1 allow + 1 block + 1 pii + 1 abuse row,
    // everything should be ~50%.
    expect(sup_rates.allow_pct).toBeCloseTo(50, 1);
    expect(sup_rates.block_pct).toBeCloseTo(50, 1);
    expect(sup_rates.pii_pct).toBeCloseTo(50, 1);
    expect(sup_rates.abuse_pct).toBeCloseTo(50, 1);

    // KPI fields should always be present, even if zero.
    expect(typeof conversions_total).toBe("number");
    expect(typeof last_convert_ts).toBe("number");
  });
});

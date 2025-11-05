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

  it("regenerates a minimal proof card when the on-disk proof JSON is corrupt", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const id = "pg_corrupt_proof";
    const proofDir = path.join(".cache", "proof");
    const proofPath = path.join(proofDir, `${id}.json`);

    // Ensure the proof directory exists
    fs.mkdirSync(proofDir, { recursive: true });

    // Write invalid JSON to simulate a corrupt proof card
    fs.writeFileSync(proofPath, "{ this is not valid json", "utf8");

    const r = await a.get(`/api/ai/proof/${id}`);

    // Should not 500, and should return a sane minimal proof card
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.proof).toBeTruthy();
    expect(r.body.proof.pageId).toBe(id);
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

  it("/metrics tolerates a corrupt url.costs cache file", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const cacheDir = path.join(".cache");
    const costsPath = path.join(cacheDir, "url.costs.json");

    fs.mkdirSync(cacheDir, { recursive: true });

    // Write invalid JSON to simulate a corrupt cache file
    fs.writeFileSync(costsPath, "{ not valid json", "utf8");

    const r = await a.get("/api/ai/metrics");

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    const { url_costs } = r.body;

    // Shape checks: even with corrupt cache, we should still expose url_costs
    expect(url_costs).toBeDefined();
    expect(url_costs).toHaveProperty("pages");
    expect(url_costs).toHaveProperty("cents_total");
    expect(url_costs).toHaveProperty("tokens_total");
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

  it("/metrics/guardrail tolerates corrupt or mixed SUP audit logs", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const logsDir = path.join(".logs", "sup");
    const auditPath = path.join(logsDir, "audit.jsonl");
    fs.mkdirSync(logsDir, { recursive: true });

    const lines = [
      "this is not json at all",
      JSON.stringify({
        mode: "allow",
        ms: 120,
        pii_present: false,
        abuse_reasons: [],
      }),
      "{ bad json line",
      JSON.stringify({
        mode: "strict",
        ms: 250,
        pii_present: true,
        abuse_reasons: ["abuse"],
      }),
      "", // blank line
    ];

    fs.writeFileSync(auditPath, lines.join("\n") + "\n", "utf8");

    const r = await a.get("/api/ai/metrics/guardrail");

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    const { sup, sup_rates } = r.body;

    // SUP summary should exist and have a numeric total
    expect(sup).toBeTruthy();
    expect(typeof sup.total).toBe("number");
    expect(sup.total).toBeGreaterThan(0); // at least the valid rows

    // Rates object shape should still be present
    expect(sup_rates).toBeTruthy();
    expect(sup_rates).toHaveProperty("allow_pct");
    expect(sup_rates).toHaveProperty("strict_pct");
    expect(sup_rates).toHaveProperty("block_pct");
    expect(sup_rates).toHaveProperty("pii_pct");
    expect(sup_rates).toHaveProperty("abuse_pct");
  });
});

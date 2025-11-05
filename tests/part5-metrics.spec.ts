import { describe, it, expect, vi } from "vitest";
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

  it("/kpi returns a KPI snapshot without 500s", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const r = await a.get("/api/ai/kpi");

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    // Basic KPI counters should always be present
    expect(r.body).toHaveProperty("conversions_total");
    expect(r.body).toHaveProperty("last_convert_ts");
    expect(typeof r.body.conversions_total).toBe("number");
    expect(typeof r.body.last_convert_ts).toBe("number");

    // Bandit state should be an object (possibly empty)
    expect(r.body).toHaveProperty("bandits");
    expect(typeof r.body.bandits).toBe("object");
  });

  it("/risk returns a risk flag for a prompt without crashing", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const prompt = "This is a harmless test prompt";

    const r = await a.get(
      `/api/ai/risk?prompt=${encodeURIComponent(prompt)}`,
    );

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    // Echoed prompt + boolean risky flag
    expect(r.body.prompt).toBe(prompt);
    expect(typeof r.body.risky).toBe("boolean");
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

  it("/metrics survives fs.readFileSync throwing on url.costs.json", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Capture the real readFileSync
    const realReadFileSync = fs.readFileSync;

    const spy = vi
      .spyOn(fs, "readFileSync")
      .mockImplementation((...args: any[]) => {
        const filePath = String(args[0]);

        // Only break url.costs.json reads, let everything else work
        if (filePath.includes("url.costs.json")) {
          throw new Error("simulated read failure");
        }

        return realReadFileSync.apply(fs, args as any);
      });

    let r;
    try {
      r = await a.get("/api/ai/metrics");
    } finally {
      // Always restore, even if the request throws
      spy.mockRestore();
    }

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.url_costs).toBeDefined();
  });

  it("/proof/:id survives fs.readFileSync throwing when loading proof file", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const id = "pg_fs_error_proof";
    const proofDir = path.join(".cache", "proof");
    const proofPath = path.join(proofDir, `${id}.json`);

    // Ensure the proof file exists so that existsSync passes
    fs.mkdirSync(proofDir, { recursive: true });
    fs.writeFileSync(proofPath, '{"ok":true}', "utf8");

    // Capture the real implementation so we can delegate for non-proof reads
    const realReadFileSync = fs.readFileSync;

    const spy = vi
      .spyOn(fs, "readFileSync")
      .mockImplementation((...args: any[]) => {
        const filePath = String(args[0]);

        // Only break reads for this specific proof JSON, let everything else work
        if (filePath.includes(path.join(".cache", "proof")) && filePath.endsWith(`${id}.json`)) {
          throw new Error("simulated proof read failure");
        }

        return realReadFileSync.apply(fs, args as any);
      });

    let r;
    try {
      r = await a.get(`/api/ai/proof/${id}`);
    } finally {
      // Always restore, even if the request fails
      spy.mockRestore();
    }

    // Endpoint must not 500 even if the proof file read fails.
    expect(r.status).toBe(200);
    expect(r.body).toBeTruthy();
    expect(r.body.ok).toBe(true);

    // We should still get a sane minimal proof card back.
    expect(r.body.proof).toBeTruthy();
    expect(r.body.proof.pageId).toBe(id);
    expect(r.body.proof.signature).toBeDefined();
  });
});

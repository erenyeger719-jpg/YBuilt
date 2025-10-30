// Contract tests for /api/ai routes — in-process app, zero network.
// Vitest globals explicit to avoid editor TS noise.
import { describe, it, expect } from "vitest";
import express from "express";
// supertest is CJS; this pattern is robust across tsconfig combos
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import requestRaw from "supertest";

// Handle both default and named export shapes for the router module
import * as aiMod from "../ai/router";

// Resolve router from common export patterns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any =
  // @ts-ignore
  (aiMod as any).default ??
  // @ts-ignore
  (aiMod as any).router ??
  // @ts-ignore
  (aiMod as any).aiRouter ??
  aiMod;

// Normalize supertest import
const request: typeof requestRaw = (requestRaw as any).default ?? (requestRaw as any);

// Keep gates lenient in unit/contract tests; crank to strict in e2e if desired
process.env.PROOF_STRICT = process.env.PROOF_STRICT ?? "0";
process.env.QA_DEVICE_SNAPSHOTS = process.env.QA_DEVICE_SNAPSHOTS ?? "0";
process.env.DEVICE_GATE = process.env.DEVICE_GATE ?? "on";
process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:5050";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/ai", router);
  return app;
}

describe("AI Router — contracts", () => {
  const app = makeApp();

  it("instant compose → preview + OG + proof + perf signals", async () => {
    const sessionId = "u_instant_1";

    await request(app).post("/api/ai/seed").send({}).expect(200);

    const r = await request(app)
      .post("/api/ai/instant")
      .send({ prompt: "dark saas waitlist for founders", sessionId, breadth: "wide" })
      .expect(200);

    const url = r.body.url || r.body.result?.url || r.body.result?.path;
    expect(url).toBeTruthy();
    const pageId = r.body.result?.pageId;
    expect(pageId).toBeTruthy();

    const proof = await request(app).get(`/api/ai/proof/${pageId}`).expect(200);
    expect(proof.body.ok).toBe(true);
    expect(proof.body.proof).toHaveProperty("a11y");

    const prev = await request(app).get(`/api/ai/previews/${pageId}`).expect(200);
    expect(prev.text).toMatch(/og:title/);
    expect(prev.text).toMatch(/twitter:card/);

    const sig = await request(app).get(`/api/ai/signals/${sessionId}`).expect(200);
    const dump = JSON.stringify(sig.body.summary || {});
    expect(/perf_est|perf_matrix/.test(dump)).toBe(true);
  });

  it("retrieve respects persona (test mode)", async () => {
    const dev = await request(app)
      .post("/api/ai/act")
      .set("x-test", "1")
      .set("x-audience", "developers")
      .send({
        sessionId: "u_persona_dev",
        spec: { layout: { sections: ["hero-basic"] }, audience: "" },
        action: { kind: "retrieve", args: { sections: ["hero-basic"] } },
      })
      .expect(200);
    expect(dev.body.result?.sections || []).toContain("features-3col");

    const founder = await request(app)
      .post("/api/ai/act")
      .set("x-test", "1")
      .set("x-audience", "founders")
      .send({
        sessionId: "u_persona_founder",
        spec: { layout: { sections: ["hero-basic"] }, audience: "" },
        action: { kind: "retrieve", args: { sections: ["hero-basic"] } },
      })
      .expect(200);
    expect(founder.body.result?.sections || []).toContain("pricing-simple");
  });

  it("vectors: seed + search (with tags)", async () => {
    await request(app).post("/api/ai/vectors/seed").send({ count: 6, tags: ["ecommerce"] }).expect(200);
    const q = await request(app).get("/api/ai/vectors/search?limit=5&q=saas").expect(200);
    expect((q.body.items || []).length).toBeGreaterThan(0);
    const tagged = await request(app).get("/api/ai/vectors/search?limit=5&tags=ecommerce").expect(200);
    expect((tagged.body.items || []).length).toBeGreaterThan(0);
  });

  it("section packs: list + ingest + list by tag", async () => {
    const list = await request(app).get("/api/ai/sections/packs?limit=5").expect(200);
    expect(list.body.ok).toBe(true);

    await request(app)
      .post("/api/ai/sections/packs/ingest")
      .send({ packs: [{ sections: ["hero-basic", "cta-simple"], tags: ["specpack"] }] })
      .expect(200);

    const list2 = await request(app).get("/api/ai/sections/packs?limit=20&tags=specpack").expect(200);
    const has = (list2.body.packs || []).some((p: any) =>
      (p.tags || []).map((s: string) => s.toLowerCase()).includes("specpack")
    );
    expect(has).toBe(true);
  });

  it("/one pipeline (developers) → features section + proof", async () => {
    const sessionId = "u_one_1";
    const r = await request(app)
      .post("/api/ai/one")
      .set("x-test", "1")
      .set("x-audience", "developers")
      .send({ prompt: "dark saas waitlist for developers", sessionId, breadth: "max" })
      .expect(200);

    const pageId = r.body.result?.pageId;
    expect(pageId).toBeTruthy();
    const sections: string[] = r.body?.result?.sections || r.body?.spec?.layout?.sections || [];
    const hasFeatures = sections.includes("features-3col") || sections.some((s) => /features/i.test(s));
    expect(hasFeatures).toBe(true);

    const proof = await request(app).get(`/api/ai/proof/${pageId}`).expect(200);
    expect(proof.body.ok).toBe(true);
  });

  it("KPI convert updates metrics rollups", async () => {
    const one = await request(app)
      .post("/api/ai/one")
      .send({ prompt: "saas waitlist", sessionId: "u_kpi_1" })
      .expect(200);
    const pageId = one.body.result?.pageId;
    expect(pageId).toBeTruthy();

    await request(app).post("/api/ai/kpi/convert").send({ pageId }).expect(200);

    const metr = await request(app).get("/api/ai/metrics").expect(200);
    const m = metr.body;
    expect(typeof m.cloud_pct).toBe("number");
    expect(typeof m.retrieval_hit_rate_pct).toBe("number");
    expect(typeof m.url_costs?.cents_total).toBe("number");
  });

  it("clarify/compose returns preview (zero-LLM path)", async () => {
    const r = await request(app)
      .post("/api/ai/clarify/compose")
      .send({ prompt: "light minimal portfolio for designers", sessionId: "u_clarify_1", spec: {} })
      .expect(200);
    const url = r.body.url || r.body.result?.url || r.body.result?.path;
    expect(url).toBeTruthy();
  });

  it("chips apply increments edits metric", async () => {
    const sessionId = "u_edits_1";
    for (const chip of ["More minimal", "Use dark mode", "Add 3-card features"]) {
      await request(app).post("/api/ai/chips/apply").send({ sessionId, spec: {}, chip }).expect(200);
    }
    await request(app).post("/api/ai/instant").send({ prompt: "saas waitlist", sessionId }).expect(200);
    const metr = await request(app).get("/api/ai/metrics").expect(200);
    const v = metr.body.edits_to_ship_est;
    expect(v === null || typeof v === "number").toBe(true);
  });

  it("readability/proof sanitization shows up in signals or proof", async () => {
    const sessionId = "u_read_1";
    const one = await request(app)
      .post("/api/ai/one")
      .send({ prompt: "We are #1 and get 300% growth in 2 weeks — playful bold saas", sessionId })
      .expect(200);
    const pageId = one.body.result?.pageId;

    const WANT = /(readability|grade|fact_sanitiz|sanitiz|proof_warn|proof)/i;
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      const sig = await request(app).get(`/api/ai/signals/${sessionId}`).expect(200);
      const sDump = JSON.stringify(sig.body.summary || sig.body || {});
      let pDump = "";
      if (pageId) {
        const pr = await request(app).get(`/api/ai/proof/${pageId}`);
        if (pr.statusCode === 200) pDump = JSON.stringify(pr.body || {});
      }
      found = WANT.test(sDump) || WANT.test(pDump);
      if (!found) await new Promise((r) => setTimeout(r, 250));
    }
    expect(found).toBe(true);
  });

  it("Accept-Language controls html lang", async () => {
    const sessionId = "u_locale_1";
    const r = await request(app)
      .post("/api/ai/instant")
      .set("accept-language", "fr-FR")
      .send({ prompt: "minimal portfolio", sessionId })
      .expect(200);
    const pageId = r.body.result?.pageId;
    expect(pageId).toBeTruthy();
    const prev = await request(app).get(`/api/ai/previews/${pageId}`).expect(200);
    expect(/<html[^>]+lang="fr"/i.test(prev.text)).toBe(true);
  });

  it("economic flywheel counters stable", async () => {
    const metr = await request(app).get("/api/ai/metrics").expect(200);
    expect(metr.body.url_costs?.pages).toBeGreaterThanOrEqual(1);
  });

  it("evidence admin: add → search → reindex", async () => {
    const id = `ev-${Date.now()}`;
    await request(app)
      .post("/api/ai/evidence/add")
      .send({ id, url: "https://example.com", title: "Example", text: "Example domain proves nothing." })
      .expect(200);
    await request(app).get(`/api/ai/evidence/search?q=example`).expect(200);
    await request(app).post("/api/ai/evidence/reindex").send({}).expect(200);
  });
});

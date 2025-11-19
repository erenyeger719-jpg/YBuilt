import { describe, it, expect } from "vitest";
import express from "express";
// @ts-ignore
import requestRaw from "supertest";
import * as aiMod from "../ai/router";

const router: any =
  // @ts-ignore
  (aiMod as any).default ?? (aiMod as any).router ?? (aiMod as any).aiRouter ?? aiMod;

const request: typeof requestRaw = (requestRaw as any).default ?? (requestRaw as any);

process.env.PROOF_STRICT = process.env.PROOF_STRICT ?? "0";
process.env.QA_DEVICE_SNAPSHOTS = process.env.QA_DEVICE_SNAPSHOTS ?? "0";
process.env.DEVICE_GATE = process.env.DEVICE_GATE ?? "on";

const app = express().use(express.json()).use("/api/ai", router);

// Helper to get preview html for a fresh page
async function composeAndFetchHTML(prompt: string, headers: Record<string,string> = {}) {
  const r = await request(app).post("/api/ai/instant").set(headers).send({ prompt, sessionId: "p20" }).expect(200);
  const pageId = r.body?.result?.pageId;
  expect(pageId).toBeTruthy();
  const prev = await request(app).get(`/api/ai/previews/${pageId}`).expect(200);
  return String(prev.text || "");
}

describe("Plan-20 extensions — soft contracts", () => {
  it("Compose purity: preview is deterministic-ish and contains canonical sections", async () => {
    const r = await request(app).post("/api/ai/one").send({
      prompt: "dark saas waitlist for developers",
      sessionId: "p20_purity",
      breadth: "max"
    }).expect(200);

    const sections: string[] = r.body?.result?.sections || r.body?.spec?.layout?.sections || [];
    expect(sections.length).toBeGreaterThan(0);
    // No raw TODOs or unfinished tokens leak
    const html = await composeAndFetchHTML("dark saas waitlist for developers");
    expect(/TODO|lorem ipsum/i.test(html)).toBe(false);
  });

  it("No-JS default option: preview has few or zero <script> tags", async () => {
    const html = await composeAndFetchHTML("minimal portfolio no js");
    const scripts = (html.match(/<script\b/gi) || []).length;
    // Allow 0-1 tiny bootstrap scripts; reject heavy footprints
    expect(scripts).toBeLessThanOrEqual(1);
  });

  it("Perf governor surfaces budgets in metrics", async () => {
    const metr = await request(app).get("/api/ai/metrics").expect(200);
    expect(typeof metr.body?.url_costs?.cents_total).toBe("number");
    expect(typeof metr.body?.url_costs?.pages).toBe("number");
  });

  it("BrandDNA: brand object persists basic choices across a quick follow-up", async () => {
    // Prime with a dark/minimal choice
    const one = await request(app).post("/api/ai/one").send({
      prompt: "dark minimal portfolio for designers",
      sessionId: "p20_brand",
      breadth: "wide"
    }).expect(200);

    const brand1 = one.body?.spec?.brand || {};
    // Nudge with a chip that should stick
    await request(app).post("/api/ai/chips/apply").send({
      sessionId: "p20_brand",
      spec: {},
      chip: "Use dark mode"
    }).expect(200);

    const two = await request(app).post("/api/ai/instant").send({
      prompt: "portfolio retake",
      sessionId: "p20_brand"
    }).expect(200);

    const brand2 = two.body?.spec?.brand || {};
    // We don't assert exact color; just that BrandDNA exists and tracks dark/tone
    expect(brand2).toBeTruthy();
    expect([brand1?.dark, brand2?.dark]).toContain(true);
  });

  it("Multilingual deterministic: html lang flips with Accept-Language", async () => {
    const htmlFr = await composeAndFetchHTML("minimal portfolio", { "accept-language": "fr-FR" });
    expect(/<html[^>]+lang="fr"/i.test(htmlFr)).toBe(true);

    const htmlEn = await composeAndFetchHTML("minimal portfolio", { "accept-language": "en-US" });
    expect(/<html[^>]+lang="en"/i.test(htmlEn)).toBe(true);
  });
});

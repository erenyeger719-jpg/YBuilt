import "./mocks";
import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("E2E golden journeys", () => {
  it("Zero-latency compose journey", async () => {
    const a = agent({ PREWARM_TOKEN: "", PROOF_STRICT: "0" });
    const z = await a.post("/api/ai/instant").send({ prompt: "minimal portfolio, light" });
    expect(z.body.ok).toBe(true);
    const pageId = z.body.result?.pageId || "pg_missing";
    const proof = await a.get(`/api/ai/proof/${pageId}`);
    expect(proof.body.ok).toBe(true);
    const cv = await a.post("/api/ai/kpi/convert").send({ pageId });
    expect(cv.body.ok).toBe(true);
  });

  it("Playbook→retrieve→compose via /one then promote", async () => {
    const a = agent({ PREWARM_TOKEN: "", PROOF_STRICT: "0" });
    const one = await a.post("/api/ai/one").send({ prompt: "dark saas waitlist for founders", sessionId: "s-one" });
    expect(one.body.ok).toBe(true);
    const promo = await a.post("/api/ai/ab/promote").send({
      sessionId: "s-one",
      winner: { sections: ["hero-basic","pricing-simple"], copy: { CTA_LABEL: "Try it" } },
      audit: { via: "test" }
    });
    expect(promo.body.ok).toBe(true);
  });

  it("Proof-strict enforcement blocks risky prompt", async () => {
    const a = agent({ PREWARM_TOKEN: "", PROOF_STRICT: "1" });
    const r = await a.post("/api/ai/one").send({ prompt: "we are #1 and 500% better", sessionId: "s-risk" });
    expect(r.body.ok).toBe(true);
    expect(r.body.result?.error).toBe("proof_gate_fail");
  });
});

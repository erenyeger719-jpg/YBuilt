import "./mocks"; // <-- important
import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Part3: /act, /one, /instant, /chips/apply, /ab/promote", () => {
  it("/act retrieve personalizes sections by audience", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const r = await a.post("/api/ai/act").send({
      sessionId: "s1",
      spec: { layout:{ sections:["hero-basic"] } },
      action: { kind:"retrieve", args:{ sections:["hero-basic"], audience:"developers" } }
    });
    expect(r.body.ok).toBe(true);
    expect(r.body.result.sections).toContain("features-3col");
  });

  it("PROOF_STRICT blocks risky /instant", async () => {
    const a = agent({ PREWARM_TOKEN: "", PROOF_STRICT: "1" });
    const r = await a.post("/api/ai/instant").send({
      prompt: "We are #1 with 300% better results"
    });
    expect(r.body.ok).toBe(true);
    expect(r.body.result.error).toBe("proof_gate_fail");
  });

  it("/chips/apply returns cost+receipt via contracts guard prep", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const r = await a.post("/api/ai/chips/apply").send({
      patch: { copy: { HEADLINE: "New" } }
    });
    expect(r.body.ok).toBe(true);
    expect(r.body.meta?.cost).toBeDefined();
    expect(r.body.meta?.receipt?.summary).toBeDefined();
  });

  it("/ab/promote merges winner and remembers last good", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const r = await a.post("/api/ai/ab/promote").send({
      sessionId: "s-promote",
      winner: { sections: ["hero-basic","features-3col"], copy: { CTA_LABEL:"Join" } },
      audit: { who: "test" }
    });
    expect(r.body.ok).toBe(true);
    expect(r.body.applied.copyKeys).toContain("CTA_LABEL");
  });
});

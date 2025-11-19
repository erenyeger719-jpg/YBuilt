// server/tests/ai.brain.contracts.test.ts
import { describe, it, expect } from "vitest";

const BASE = process.env.AI_BASE ?? "http://localhost:5050/api/ai";
const A = (p: string) => `${BASE}${p}`;

async function jfetch(url: string, body?: any, headers: Record<string,string> = {}) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { ok: false, error: "bad_json", raw: txt }; }
}

describe("AI Brain Micro-Contracts", () => {
  it("Outcome brain: KPI convert is monotonic", async () => {
    // Get baseline
    const before = await jfetch(A("/kpi"));
    const c0 = Number(before?.conversions_total ?? 0);

    // Ship one instant page (dev path; zero LLM)
    const out = await jfetch(A("/instant"), { prompt: "minimal dark saas", sessionId: "kpi1", ship: true });
    expect(out.ok).toBe(true);
    const pageId = out?.result?.pageId;
    expect(typeof pageId).toBe("string");

    // Convert it
    const conv = await jfetch(A("/kpi/convert"), { pageId });
    expect(conv.ok).toBe(true);

    // Verify monotonic counter
    const after = await jfetch(A("/kpi"));
    const c1 = Number(after?.conversions_total ?? 0);
    expect(c1).toBeGreaterThanOrEqual(c0 + 1);
  });

  it("Massive token search: breadth=wide and max yield composed result with brand tokens", async () => {
    // wide
    const wide = await jfetch(A("/one"), { prompt: "dark saas waitlist", sessionId: "tok-wide", breadth: "wide" }, { "x-test": "1" });
    expect(wide.ok).toBe(true);
    expect(wide?.result?.kind ?? "compose").toBe("compose");

    // brand tokens should exist on result.brand or spec.brand
    const btWide = wide?.result?.brand?.tokens || wide?.spec?.brand?.tokens;
    expect(!!btWide).toBe(true);

    // max
    const max = await jfetch(A("/one"), { prompt: "dark saas waitlist", sessionId: "tok-max", breadth: "max" }, { "x-test": "1" });
    expect(max.ok).toBe(true);
    const btMax = max?.result?.brand?.tokens || max?.spec?.brand?.tokens;
    expect(!!btMax).toBe(true);
  });

  it("Personalization (low-creep): developers get features, founders get pricing", async () => {
    const spec = { layout: { sections: ["hero-basic", "cta-simple"] }, audience: "" };

    // Developers
    const dev = await jfetch(A("/act"), { sessionId: "aud-dev", spec, action: { kind: "retrieve", args: { sections: spec.layout.sections } } }, { "x-test": "1", "x-audience": "developers" });
    expect(dev.ok).toBe(true);
    const sDev = dev?.result?.sections || [];
    expect(sDev).toContain("features-3col");
    expect(sDev).not.toContain("pricing-simple");

    // Founders
    const fnd = await jfetch(A("/act"), { sessionId: "aud-fnd", spec, action: { kind: "retrieve", args: { sections: spec.layout.sections } } }, { "x-test": "1", "x-audience": "founders" });
    expect(fnd.ok).toBe(true);
    const sFnd = fnd?.result?.sections || [];
    expect(sFnd).toContain("pricing-simple");
  });

  it("Zero-JS default: preview HTML has no <script>", async () => {
    const out = await jfetch(A("/instant"), { prompt: "light portfolio", sessionId: "nojss", ship: true }, { "x-test": "1" });
    expect(out.ok).toBe(true);
    const pageId = out?.result?.pageId;
    const html = await (await fetch(A(`/previews/${pageId}`))).text();
    expect(/<script\b/i.test(html)).toBe(false);
  });

  it("Proof Card exists for last page", async () => {
    const out = await jfetch(A("/instant"), { prompt: "proof check", sessionId: "proof1", ship: true }, { "x-test": "1" });
    const pageId = out?.result?.pageId;
    const proof = await jfetch(A(`/proof/${pageId}`));
    expect(proof.ok).toBe(true);
    expect(proof?.proof?.pageId).toBe(pageId);
    expect(proof?.proof).toHaveProperty("proof_ok");
  });

  it("Vector library: seed and search return items", async () => {
    const seed = await jfetch(A("/vectors/seed"), { count: 12, tags: ["saas","ecommerce"] }, { "x-test": "1" });
    expect(seed.ok).toBe(true);

    const search = await jfetch(A("/vectors/search?q=logo"), undefined, { "x-test": "1" });
    expect(search.ok).toBe(true);
    expect(Array.isArray(search.items)).toBe(true);
    expect(search.items.length).toBeGreaterThan(0);
  });

  it("Section marketplace: packs list responds", async () => {
    const packs = await jfetch(A("/sections/packs"), undefined, { "x-test": "1" });
    expect(packs.ok).toBe(true);
    expect(Array.isArray(packs.packs)).toBe(true);
  });

  it("CiteLock-Pro strict: hype is blocked", async () => {
    const res = await jfetch(A("/one"),
      { prompt: "We are #1 with 200% growth and 10x ROI", sessionId: "strict1" },
      { "x-proof-strict": "1", "x-test": "1" }
    );
    expect(res.ok).toBe(true);
    // When strict, compose may return an error object instead of a URL
    const err = res?.result?.error || res?.ran?.error;
    expect(err === "proof_gate_fail").toBe(true);
  });
});

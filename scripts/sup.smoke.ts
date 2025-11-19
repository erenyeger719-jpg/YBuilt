// scripts/sup.smoke.ts
import assert from "node:assert/strict";

const BASE = process.env.APP_ORIGIN || "http://localhost:5050";

async function post<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function run() {
  console.log("SUP smoke — start");

  // 1) Zero-latency path (4)
  const t0 = Date.now();
  const instant = await post<any>("/api/ai/instant", {
    prompt: "hello",
    noModel: true,
    seed: 42,
  });
  const dt = Date.now() - t0;
  assert.ok(dt < 1000, `instant too slow: ${dt}ms`);
  assert.equal(instant?.debug?.tokensUsed ?? 0, 0, "instant should be token-free");

  // 2) Failure-aware search (18) — feed a failing spec → expect search fallback flag
  const failing = await post<any>("/api/ai/compose", {
    goal: "hero",
    spec: { requireBudgetUnderKb: 5, forceHugeAsset: true }, // obviously impossible
    seed: 7,
  });
  assert.ok(
    failing?.debug?.failureAware === true || failing?.debug?.appliedFallback === "search",
    "expected failure-aware fallback"
  );

  // 3) CiteLock-Pro (6) — force factual line; require evidence or rewrite
  const fact = await post<any>("/api/ai/compose", {
    goal: "faq",
    snippets: [{ id: "claim", text: "The Eiffel Tower is in Berlin." }],
    requireEvidence: true,
  });
  const hasProof = !!fact?.proof?.items?.length;
  const rewrote = /paris/i.test(JSON.stringify(fact));
  assert.ok(hasProof || rewrote, "expected evidence or corrected rewrite");

  // 4) Perf governor (12) — oversize section gets downgraded
  const heavy = await post<any>("/api/ai/compose", {
    goal: "gallery",
    budget: { bytesMax: 50_000, requestsMax: 10 },
    tryOversized: true,
  });
  assert.ok(
    heavy?.debug?.perf?.withinBudget === true,
    "perf budgets must be enforced"
  );
  if (heavy?.debug?.perf?.downgraded) {
    console.log("perf: auto-downgraded ✅");
  }

  // 5) Compose purity (10) — final is pure code with schema pass
  assert.ok(heavy?.artifact?.html || heavy?.artifact?.astro || heavy?.artifact?.react, "expected code artifact");
  assert.ok(heavy?.debug?.schema?.passed === true, "schema must pass");

  // 6) Multilingual deterministic (17)
  const es1 = await post<any>("/api/ai/compose", { goal: "hero", locale: "es-ES", seed: 11 });
  const es2 = await post<any>("/api/ai/compose", { goal: "hero", locale: "es-ES", seed: 11 });
  assert.equal(JSON.stringify(es1?.artifact), JSON.stringify(es2?.artifact), "locale+seed must be deterministic");

  // 7) No-JS default (19)
  const plain = await post<any>("/api/ai/compose", { goal: "pricing", preferNoJS: true });
  assert.ok(/<noscript>/.test(plain?.artifact?.html || ""), "expect no-JS pathway baked in");

  // 8) OG/social bundle (14)
  assert.ok(plain?.meta?.og?.image && plain?.meta?.og?.title, "OG/meta must be present");

  // 9) Proof Card (15)
  assert.ok(plain?.proofCard?.a11y && plain?.proofCard?.perf && plain?.proofCard?.evidence !== undefined, "proof card must exist");

  // 10) Outcome brain – counters wired (1)
  const outcome = await post<any>("/api/ai/outcome", {
    pageId: "test-page",
    sections: ["hero","pricing","faq"],
    event: "conversion",
  });
  assert.ok(outcome?.ok === true, "outcome ingestion must succeed");

  console.log("SUP smoke — all checks ✅");
}

run().catch((e) => {
  console.error("SUP smoke FAILED:", e);
  process.exit(1);
});

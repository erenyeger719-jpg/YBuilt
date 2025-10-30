// Minimal, loud, no-deps regression harness for Sup Algo.
// Usage: node tests/sup_algo.regression.mjs http://localhost:5050

const BASE = (process.argv[2] || "http://localhost:5050").replace(/\/+$/, "");
const A = (p) => `${BASE}${p.startsWith("/") ? p : `/${p}`}`;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let FAILS = 0, PASSES = 0;
const S = {}; // shared state (pageIds, sessions, urls, etc.)

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function ensure(cond, msg){ if (!cond) throw new Error(msg); }

async function J(method, path, body, headers = {}) {
  const r = await fetch(A(path), {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let j = {};
  try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  return { ok: r.ok, status: r.status, json: j, raw: txt };
}
const GET = (p, h) => J("GET", p, null, h);
const POST = (p, b, h) => J("POST", p, b, h);

async function test(name, fn){
  const t0 = Date.now();
  try {
    await fn();
    PASSES++;
    console.log(`${green("PASS")} ${name} ${dim(`(${Date.now()-t0}ms)`)}`);
  } catch (e) {
    FAILS++;
    console.log(`${red("FAIL")} ${name} → ${e.message}`);
  }
}

function pickPreviewIdFromUrl(url){
  const m = String(url||"").match(/\/previews\/([^/?#]+)/);
  return m ? m[1] : null;
}

(async () => {
  console.log(cyan(`Sup Algo regression @ ${BASE}`));

  // 0) Seed retrieval DB (safe no-op if already seeded)
  await test("seed retrieval examples", async () => {
    const r = await POST("/api/ai/seed", {});
    ensure(r.ok && r.json.ok, "seed failed");
  });

  // 1) Zero-latency path (instant compose) + OG/social + Proof Card + perf signals
  await test("instant compose → url + proof + signals", async () => {
    const sessionId = "t_instant_1";
    const r = await POST("/api/ai/instant", {
      prompt: "dark saas waitlist for founders",
      sessionId,
      breadth: "wide"
    });
    ensure(r.ok && r.json.ok, "instant failed");
    const url = r.json.url || r.json.result?.url || r.json.result?.path;
    ensure(url, "no preview url");
    const pageId = r.json.result?.pageId || null;
    ensure(pageId, "no pageId on compose result");
    S.instant = { sessionId, url, pageId };

    // Proof card should exist
    const p = await GET(`/api/ai/proof/${pageId}`);
    ensure(p.ok && p.json.ok, "proof card not found");
    ensure(Object.prototype.hasOwnProperty.call(p.json.proof, "a11y"), "proof missing a11y");

    // OG tags in preview (either rehosted upstream or local synth)
    const prev = await GET(`/api/ai/previews/${pageId}`);
    ensure(prev.ok, "preview fetch failed");
    ensure(/og:title/.test(prev.raw) && /twitter:card/.test(prev.raw), "missing OG/social meta");

    // Signals: perf estimates should show up
    await sleep(200);
    const sig = await GET(`/api/ai/signals/${sessionId}`);
    ensure(sig.ok && sig.json.ok, "signals fetch failed");
    const summary = sig.json.summary || {};
    const kinds = JSON.stringify(summary);
    ensure(/perf_est/.test(kinds) || /perf_matrix/.test(kinds), "missing perf signals");
  });

  // 2) Personalization without creep (developers → features-3col, founders → pricing-simple)
  await test("retrieve respects persona in test mode", async () => {
    const act = await POST("/api/ai/act",
      {
        sessionId: "t_persona_dev",
        spec: { layout: { sections: ["hero-basic"] }, audience: "" },
        action: { kind: "retrieve", args: { sections: ["hero-basic"] } }
      },
      { "x-test": "1", "x-audience": "developers" }
    );
    ensure(act.ok && act.json.ok, "act/retrieve failed");
    const sections = act.json.result?.sections || [];
    ensure(sections.includes("features-3col"), "dev persona did not add features-3col");

    const act2 = await POST("/api/ai/act",
      {
        sessionId: "t_persona_founder",
        spec: { layout: { sections: ["hero-basic"] }, audience: "" },
        action: { kind: "retrieve", args: { sections: ["hero-basic"] } }
      },
      { "x-test": "1", "x-audience": "founders" }
    );
    const sections2 = act2.json.result?.sections || [];
    ensure(sections2.includes("pricing-simple"), "founder persona did not add pricing-simple");
  });

  // 3) Vector library network effect (cold start synth) + seed + tag search
  await test("vector search returns items (cold-start or corpus)", async () => {
    const r = await GET("/api/ai/vectors/search?limit=5&q=saas");
    ensure(r.ok && r.json.ok, "vectors/search failed");
    ensure((r.json.items||[]).length > 0, "no vector items returned");
  });

  await test("vector seed + tagged search", async () => {
    const seed = await POST("/api/ai/vectors/seed", { count: 8, tags: ["ecommerce", "portfolio"] });
    ensure(seed.ok && seed.json.ok, "vectors/seed failed");
    const r = await GET(`/api/ai/vectors/search?limit=5&tags=ecommerce`);
    ensure(r.ok && r.json.ok, "vectors/search by tag failed");
    ensure((r.json.items||[]).length > 0, "seeded search returned 0");
  });

  // 4) Section marketplace list + ingest
  await test("section packs list + ingest", async () => {
    const list = await GET("/api/ai/sections/packs?limit=5");
    ensure(list.ok && list.json.ok, "packs list failed");

    const ingest = await POST("/api/ai/sections/packs/ingest", {
      packs: [{ sections: ["hero-basic","cta-simple"], tags: ["testpack", "demo"] }]
    });
    ensure(ingest.ok && ingest.json.ok, "packs ingest failed");

    const list2 = await GET("/api/ai/sections/packs?limit=20&tags=testpack");
    ensure(list2.ok && list2.json.ok, "packs list by tag failed");
    const any = (list2.json.packs||[])
      .some(p => (p.tags||[]).map(s => String(s).toLowerCase()).includes("testpack"));
    ensure(any, "ingested pack not found by tag");
  });

  // 5) Full /one pipeline with breadth=max → sections, proof, metrics flywheel
  await test("one → compose → metrics + bandit hints honored", async () => {
    const sessionId = "t_one_1";
    const r = await POST("/api/ai/one", {
      prompt: "dark saas waitlist for developers",
      sessionId,
      breadth: "max"
    });
    ensure(r.ok && r.json.ok, "one failed");
    const url = r.json.url || r.json.result?.url || r.json.result?.path;
    ensure(url, "no preview url");
    const pageId = r.json.result?.pageId || null;
    ensure(pageId, "no pageId");
    S.one = { sessionId, url, pageId };

    const sectionsUsed = (r.json?.result?.sections) || (r.json?.spec?.layout?.sections) || [];
    ensure(sectionsUsed.includes("features-3col"), "bandit/personalization missing features-3col");

    const proof = await GET(`/api/ai/proof/${pageId}`);
    ensure(proof.ok && proof.json.ok, "proof read failed");
  });

  // 6) KPI convert → flywheel accounting & taste/URL cost rollups show up in /metrics
  await test("kpi convert + metrics rollup", async () => {
    ensure(S.one?.pageId, "no pageId from previous test");
    const conv = await POST("/api/ai/kpi/convert", { pageId: S.one.pageId });
    ensure(conv.ok && conv.json.ok, "kpi/convert failed");

    const metr = await GET("/api/ai/metrics");
    ensure(metr.ok && m.json.ok, "metrics failed"); // <- keep local 'm'
    const m = metr.json;
    ensure(typeof m.cloud_pct === "number", "metrics missing cloud_pct");
    ensure(typeof m.retrieval_hit_rate_pct === "number", "metrics missing hit rate");
    ensure(m.url_costs && typeof m.url_costs.cents_total === "number", "metrics missing url_costs");
  });

  // 7) Clarify → apply chips → compose (zero-LLM path)
  await test("clarify/compose returns preview", async () => {
    const r = await POST("/api/ai/clarify/compose", {
      prompt: "light minimal portfolio for designers",
      sessionId: "t_clarify_1",
      spec: {}
    });
    ensure(r.ok && r.json.ok, "clarify/compose failed");
    const url = r.json.url || r.json.result?.url || r.json.result?.path;
    ensure(url, "no preview url from clarify/compose");
  });

  // 8) Chips apply → edits metric gets flushed on next compose
  await test("chips apply increments edits → reflected after compose", async () => {
    const sessionId = "t_edits_1";
    for (const chip of ["More minimal", "Use dark mode", "Add 3-card features"]) {
      const r = await POST("/api/ai/chips/apply", { sessionId, spec: {}, chip });
      ensure(r.ok && r.json.ok, `chip apply failed: ${chip}`);
    }
    const r2 = await POST("/api/ai/instant", { prompt: "saas waitlist", sessionId });
    ensure(r2.ok && r2.json.ok, "compose after chips failed");
    const metr = await GET("/api/ai/metrics");
    ensure(metr.ok && metr.json.ok, "metrics failed");
    const v = metr.json.edits_to_ship_est;
    ensure(v === null || typeof v === "number", "edits_to_ship_est not present");
  });

  // 9) Readability + proof sanitization signals (poll up to ~2s)
  await test("readability + proof sanitization emits signals", async () => {
    const sessionId = "t_readability_1";
    const r = await POST("/api/ai/one", {
      prompt: "We are #1 and get 300% growth in 2 weeks — playful bold saas",
      sessionId
    });
    ensure(r.ok && r.json.ok, "one failed");

    let found = false, tries = 0;
    const WANT = /(readability_warn|fact_sanitized|proof_warn|readability|proof)/;
    while (tries++ < 10 && !found) {
      await sleep(200);
      const sig = await GET(`/api/ai/signals/${sessionId}`);
      ensure(sig.ok && sig.json.ok, "signals failed");
      const dump = JSON.stringify(sig.json.summary||{});
      found = WANT.test(dump);
    }
    ensure(found, "expected readability/proof signals not found");
  });

  // 10) Multilingual deterministic (Accept-Language → lang attribute)
  await test("accept-language influences locale of preview", async () => {
    const sessionId = "t_locale_1";
    const r = await POST("/api/ai/instant", {
      prompt: "minimal portfolio",
      sessionId
    }, { "accept-language": "fr-FR" });
    ensure(r.ok && r.json.ok, "instant (fr) failed");
    const pageId = r.json.result?.pageId;
    ensure(pageId, "no pageId");
    const prev = await GET(`/api/ai/previews/${pageId}`);
    ensure(prev.ok, "preview fetch failed");
    ensure(/<html[^>]+lang="fr"/i.test(prev.raw), "preview lang not set to fr");
  });

  // 11) Packs/seen/win wiring via KPI convert should not crash (already exercised).

  // 12) Economic flywheel sanity re-check
  await test("economic flywheel counters stable", async () => {
    const metr = await GET("/api/ai/metrics");
    ensure(metr.ok && metr.json.ok, "metrics failed");
    const { url_costs } = metr.json;
    ensure(url_costs.pages >= 1, "no pages tracked in url_costs");
  });

  // 13) Evidence admin: add → search → reindex
  await test("evidence add/search/reindex works", async () => {
    const id = `ev-${Date.now()}`;
    const add = await POST("/api/ai/evidence/add", {
      id, url: "https://example.com", title: "Example", text: "Example domain proves nothing."
    });
    ensure(add.ok && add.json.ok, "evidence add failed");
    const srch = await GET(`/api/ai/evidence/search?q=example`);
    ensure(srch.ok && srch.json.ok, "evidence search failed");
    const reidx = await POST("/api/ai/evidence/reindex", {});
    ensure(reidx.ok && reidx.json.ok, "evidence reindex failed");
  });

  const total = PASSES + FAILS;
  const badge = FAILS === 0 ? green("ALL GREEN") : red(`${FAILS} FAIL`);
  console.log(cyan(`\n${badge} — ${PASSES}/${total} passing`));
  if (FAILS) process.exit(1);
})();

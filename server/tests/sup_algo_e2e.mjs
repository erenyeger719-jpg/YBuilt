// Node 18+ (native fetch). Run: node tests/sup_algo_e2e.mjs http://localhost:3000
// Optional: BASE can be full '/api/ai' path (defaults to http://localhost:5050/api/ai)

const BASE = (process.argv[2] || process.env.BASE || "http://localhost:5050") + "/api/ai";
const ORIGIN = BASE.replace(/\/api\/ai\/?$/, "");
const t0 = Date.now();

const results = [];
function log(ok, name, detail = "") {
  const s = ok ? "✅" : "❌";
  results.push({ ok, name, detail });
  console.log(`${s} ${name}${detail ? " — " + detail : ""}`);
}
function title(s) { console.log("\n— " + s); }

// unique session ids to avoid cross-run bleed
const sid = (name) => `${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

async function fjson(path, { method = "GET", body, headers = {}, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const txt = await r.text();
    let json = null;
    try { json = JSON.parse(txt); } catch {}
    return { ok: r.ok, status: r.status, json, txt };
  } finally { clearTimeout(id); }
}
async function ftext(url, timeout = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return await r.text();
  } finally { clearTimeout(id); }
}
function abs(urlOrPath) {
  if (!urlOrPath) return null;
  return /^https?:\/\//i.test(urlOrPath) ? urlOrPath : `${ORIGIN}${urlOrPath}`;
}

(async () => {
  title("Smoke: metrics endpoint");
  {
    const r = await fjson("/metrics");
    log(r.ok && r.json?.ok === true, "Metrics up", r.ok ? "" : `HTTP_${r.status}`);
  }

  title("Zero-latency compose (Instant path) + Proof card + OG tags");
  let pageId1 = null, url1 = null;
  {
    const r = await fjson("/instant", {
      method: "POST",
      body: { prompt: "dark saas waitlist for founders", sessionId: "e2e-instant-1" },
      headers: { "accept-language": "en-US" }
    });
    const ok = r.ok && r.json?.ok && (r.json?.url || r.json?.result?.url || r.json?.result?.path);
    url1 = r.json?.url || r.json?.result?.url || r.json?.result?.path || null;
    pageId1 = r.json?.result?.pageId || null;
    log(ok, "Instant → URL returned", ok ? url1 : `HTTP_${r.status}`);
    if (pageId1) {
      const p = await fjson(`/proof/${pageId1}`);
      log(p.ok && p.json?.ok, "Proof card written", p.ok ? "" : `HTTP_${p.status}`);
    } else {
      log(false, "Proof card absent", "pageId missing");
    }
    if (url1) {
      const html = await ftext(abs(url1));
      const hasOG = /<meta[^>]+property=["']og:/.test(html);
      const hasTitle = /<title>/i.test(html);
      log(hasOG && hasTitle, "SEO/OG bundle present", hasOG ? "OG ✓" : "OG missing");
    }
  }

  title("Personalization without creep (developers vs founders)");
  {
    // Developers — strong signal + fresh session
    try {
      const r = await fetch(`${BASE}/act`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-audience": "developers",
          "x-test": "1"
        },
        body: JSON.stringify({
          sessionId: sid("e2e-dev"),
          spec: { intent: { audience: "developers" }, layout: { sections: ["cta-simple"] } },
          action: { kind: "retrieve", args: { sections: ["cta-simple"], audience: "developers" } }
        })
      });
      const j = await r.json();
      const got = (j?.result?.sections || []).join(",");
      const ok = Boolean(j?.ok) && got.includes("features-3col");
      log(ok, "Audience(dev) → adds features-3col", got || "");
    } catch (e) {
      log(false, "Audience(dev) → adds features-3col", e?.message || String(e));
    }

    // Founders — strong signal + fresh session
    try {
      const r = await fetch(`${BASE}/act`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-audience": "founders",
          "x-test": "1"
        },
        body: JSON.stringify({
          sessionId: sid("e2e-founders"),
          spec: { intent: { audience: "founders" }, layout: { sections: ["hero-basic","cta-simple"] } },
          action: { kind: "retrieve", args: { sections: ["hero-basic","cta-simple"], audience: "founders" } }
        })
      });
      const j = await r.json();
      const got = (j?.result?.sections || []).join(",");
      const ok = Boolean(j?.ok) && got.includes("pricing-simple");
      log(ok, "Audience(founders) → adds pricing-simple", got || "");
    } catch (e) {
      log(false, "Audience(founders) → adds pricing-simple", e?.message || String(e));
    }
  }

  title("Massive token-space search (wide/max toggles) + Proof visual score");
  let visualDefault = null, visualMax = null;
  {
    // Default breadth
    const r0 = await fjson("/one", {
      method: "POST",
      body: { prompt: "minimal portfolio light", sessionId: "e2e-tokens-0" }
    });
    const pid0 = r0.json?.result?.pageId;
    const proof0 = pid0 ? await fjson(`/proof/${pid0}`) : null;
    visualDefault = proof0?.json?.proof?.visual ?? proof0?.json?.visual ?? null;
    log(Boolean(pid0), "one(default) → page", pid0 || "");
    // Max breadth
    const r1 = await fjson("/one", {
      method: "POST",
      body: { prompt: "minimal portfolio light", sessionId: "e2e-tokens-1", breadth: "max" }
    });
    const pid1 = r1.json?.result?.pageId;
    const proof1 = pid1 ? await fjson(`/proof/${pid1}`) : null;
    visualMax = proof1?.json?.proof?.visual ?? proof1?.json?.visual ?? null;
    log(Boolean(pid1), "one(max) → page", pid1 || "");
    const visOK = Number.isFinite(visualDefault) && Number.isFinite(visualMax);
    log(visOK, "Proof visual scores present", `default=${visualDefault}, max=${visualMax}`);
  }

  title("Vector library network effect (seed → search)");
  {
    const seed = await fjson("/vectors/seed", { method: "POST", body: { count: 12 } });
    log(seed.ok && seed.json?.ok, "Vector seed ok", `≈${seed.json?.approx_assets || "?"}`);
    const q = await fjson("/vectors/search?q=saas&limit=8");
    const items = q.json?.items || [];
    log(q.ok && Array.isArray(items) && items.length > 0, "Vector search returns items", `n=${items.length}`);
  }

  title("Section marketplace (ranked + ingest)");
  {
    const list = await fjson("/sections/packs?limit=5");
    log(list.ok && list.json?.packs, "Packs ranked list ok", `n=${(list.json?.packs || []).length}`);
    const ingestBody = {
      packs: [{
        id: `user-pack-${Date.now()}`,
        sections: ["hero-basic","features-3col","cta-simple"],
        tags: ["ecommerce","community"]
      }]
    };
    const ingest = await fjson("/sections/packs/ingest", { method: "POST", body: ingestBody });
    log(ingest.ok && ingest.json?.ok, "Packs ingest ok", `added=${(ingest.json?.added ?? "?")}`);
  }

  title("Economic flywheel counters + retrieval hit-rate");
  {
    const m = await fjson("/metrics");
    const ok = m.ok && m.json?.ok;
    const pages = m.json?.url_costs?.pages ?? null;
    const hit = m.json?.retrieval_hit_rate_pct ?? null;
    log(ok, "Metrics snapshot ok", ok ? "" : `HTTP_${m.status}`);
    log(Number.isFinite(pages), "Pages costed present", `pages=${pages}`);
    log(Number.isFinite(hit), "Retrieval hit-rate present", `hit=${hit}%`);
  }

  title("KPI loop (convert) + Shadow RL reward hook");
  {
    // Make a fresh page and mark conversion
    const r = await fjson("/instant", {
      method: "POST",
      body: { prompt: "demo page light minimal", sessionId: "e2e-kpi" }
    });
    const pid = r.json?.result?.pageId;
    const conv = pid ? await fjson("/kpi/convert", { method: "POST", body: { pageId: pid } }) : { ok:false, status:0 };
    log(Boolean(pid), "Compose page for conversion", pid || "");
    log(conv.ok && conv.json?.ok, "Mark conversion ok", conv.ok ? "" : `HTTP_${conv.status}`);
  }

  title("Multilingual deterministic path (hi-IN header doesn’t crash)");
  {
    const r = await fjson("/instant", {
      method: "POST",
      headers: { "accept-language": "hi-IN,hi;q=0.9" },
      body: { prompt: "saas waitlist", sessionId: "e2e-multi" }
    });
    log(r.ok && r.json?.ok, "Instant (hi-IN) ok", r.ok ? "" : `HTTP_${r.status}`);
  }

  title("Device/perf estimates (CLS/LCP) embedded in Proof");
  {
    const r = await fjson("/instant", {
      method: "POST",
      body: { prompt: "portfolio page", sessionId: "e2e-perf" }
    });
    const pid = r.json?.result?.pageId;
    const proof = pid ? await fjson(`/proof/${pid}`) : null;
    const cls = proof?.json?.proof?.cls_est ?? proof?.json?.cls_est ?? null;
    const lcp = proof?.json?.proof?.lcp_est_ms ?? proof?.json?.lcp_est_ms ?? null;
    const ok = (cls === null || Number.isFinite(cls)) && (lcp === null || Number.isFinite(lcp));
    log(Boolean(pid), "Compose page for perf", pid || "");
    log(ok, "CLS/LCP estimates present (or null)", `CLS=${cls} LCP=${lcp}`);
  }

  title("CiteLock-Pro present (proof map exists)");
  {
    const r = await fjson("/instant", {
      method: "POST",
      body: { prompt: "we are #1 and deliver 200% growth", sessionId: "e2e-proof" }
    });
    const pid = r.json?.result?.pageId;
    const proof = pid ? await fjson(`/proof/${pid}`) : null;
    const hasMap = proof?.json?.proof?.facts || proof?.json?.facts;
    log(Boolean(pid), "Compose page for proof", pid || "");
    log(Boolean(hasMap), "Proof map present", hasMap ? "✓" : "missing");
  }

  title("No-JS default option (fallback page contains no <script>)");
  {
    const r = await fjson("/instant", {
      method: "POST",
      body: { prompt: "minimal landing, light", sessionId: "e2e-nojs" }
    });
    const url = r.json?.url || r.json?.result?.url || r.json?.result?.path || null;
    let ok = false, detail = "no url";
    if (url) {
      const html = await ftext(abs(url));
      ok = !/<script\b/i.test(html);            // no <script> tags
      detail = ok ? "no scripts found" : "script tag present";
    }
    log(ok, "No-JS default page", detail);
  }

  // Final summary
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n=== Sup Algo E2E: ${pass}/${results.length} checks passed in ${Date.now() - t0}ms ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error("Harness crashed:", e?.message || e);
  process.exit(1);
});

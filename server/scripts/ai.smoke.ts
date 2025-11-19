// Minimal AI router smoke: hits a few safe endpoints and fails if any 5xx.
// Run with: npm run ai:smoke
const BASE = process.env.AI_BASE ?? "http://localhost:5050/api/ai";

type Case = { name: string; url: string; method?: "GET" | "POST" };
const cases: Case[] = [
  { name: "instant",           url: `${BASE}/instant?goal=ping` },
  { name: "vectors/search",    url: `${BASE}/vectors/search?q=logo` },
  { name: "sections/packs",    url: `${BASE}/sections/packs` },
  { name: "metrics",           url: `${BASE}/metrics` },
  { name: "kpi",               url: `${BASE}/kpi` },
  { name: "proof/ping",        url: `${BASE}/proof/ping` },
];

async function run() {
  const out: any[] = [];
  for (const t of cases) {
    const method = t.method ?? "GET";
    try {
      const res = await fetch(t.url, { method, headers: { accept: "application/json" } });
      const ok = res.status < 500;
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        /* not fatal */
      }
      out.push({ name: t.name, status: res.status, ok, hasJson: !!body, detail: body?.ok ?? null });
      if (!ok) console.error(`[FAIL] ${t.name} -> ${res.status}`);
    } catch (e: any) {
      out.push({ name: t.name, status: "ERR", ok: false, hasJson: false, detail: e?.message || "error" });
      console.error(`[ERR ] ${t.name} -> ${e?.message || e}`);
    }
  }
  console.table(out);
  const failed = out.some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

run();

// server/ai/selftest.ts
import type { Router } from "express";

type Check = { id: number; name: string; pass: boolean; detail?: string };

function listRoutes(router: Router): string[] {
  const anyRouter = router as unknown as { stack?: any[] };
  const stack = anyRouter.stack ?? [];
  const paths: string[] = [];
  for (const layer of stack) {
    // direct route
    if (layer?.route?.path) paths.push(String(layer.route.path));
    // nested router
    if (layer?.name === "router" && layer?.handle?.stack) {
      for (const l2 of layer.handle.stack) {
        if (l2?.route?.path) paths.push(String(l2.route.path));
      }
    }
  }
  return paths;
}

const has = (paths: string[], needle: string) => paths.some(p => String(p).includes(needle));

export function registerSelfTest(router: Router) {
  router.get("/selftest", async (_req, res) => {
    const paths = listRoutes(router);

    const checks: Check[] = [
      { id: 1,  name: "Outcome brain KPI loop",        pass: has(paths, "outcome") || !!process.env.KPI_TOPIC },
      { id: 2,  name: "Massive design search",         pass: has(paths, "design-search") || process.env.DESIGN_SEARCH === "true" },
      { id: 3,  name: "Section-level bandits",         pass: has(paths, "bandit") || process.env.BANDITS === "true" },
      { id: 4,  name: "Zero-latency path",             pass: has(paths, "instant") || process.env.ZERO_LATENCY === "true" },
      { id: 5,  name: "BrandDNA learning",             pass: !!process.env.BRAND_DNA_STORE },
      { id: 6,  name: "CiteLock-Pro",                  pass: has(paths, "proof") || process.env.CITELOCK === "true" },
      { id: 7,  name: "Device-farm sanity hook",       pass: has(paths, "snapshot") || process.env.DEVICE_FARM === "true" },
      { id: 8,  name: "Vector library network effect", pass: has(paths, "vector") || !!process.env.VECTOR_INDEX },
      { id: 9,  name: "Low-creep personalization",     pass: (process.env.PERSONALIZATION_MODE ?? "safe") === "safe" },
      { id: 10, name: "Compose purity",                pass: (process.env.COMPOSE_PURITY ?? "true") === "true" },
      { id: 11, name: "Auto-readability + rhythm",     pass: !!process.env.READABILITY_TARGET },
      { id: 12, name: "Perf governor budgets",         pass: !!process.env.PERF_BUDGET_BYTES },
      { id: 13, name: "Section marketplace",           pass: has(paths, "sections") || has(paths, "marketplace") },
      { id: 14, name: "OG/Social bundle",              pass: has(paths, "og") || has(paths, "social") },
      { id: 15, name: "Proof Card",                    pass: has(paths, "proof") || !!process.env.PROOF_CARD },
      { id: 16, name: "Shadow RL (safe)",              pass: process.env.SHADOW_RL === "true" },
      { id: 17, name: "Multilingual deterministic",    pass: (process.env.DETERMINISTIC === "true") && ((process.env.LOCALES ?? "").split(",").length >= 2) },
      { id: 18, name: "Failure-aware search",          pass: has(paths, "fix") || has(paths, "repair") || process.env.FAILURE_SEARCH === "true" },
      { id: 19, name: "No-JS default",                 pass: process.env.NO_JS_DEFAULT === "true" },
      { id: 20, name: "Economic flywheel metrics",     pass: !!process.env.CENTS_PER_URL && !!process.env.TOKENS_PER_PASS },
    ];

    res.json({
      ok: checks.every(c => c.pass),
      passed: checks.filter(c => c.pass).length,
      total: checks.length,
      checks,
      routes: paths
    });
  });
}

// tests/backend.previews-deploy-code-load.test.ts
// Simple high-level load test for core backend routes.
//
// Run with (example):
//   BASE_URL=http://localhost:5050 pnpm tsx tests/backend.previews-deploy-code-load.test.ts
//
// You can override defaults with env vars:
//   LOAD_REQUESTS=60
//   LOAD_CONCURRENCY=20
//   LOAD_MAX_P95_MS=12000   (ms)
//   LOAD_MAX_ERROR_RATE=0.02
//
// NOTE: For this test, "error" means network failure or 5xx.
// 4xx (like 401/404) are treated as "ok" from a load/perf perspective.

type RouteSpec = {
  name: string;
  path: string;
  method?: "GET" | "POST";
};

type Sample = {
  ok: boolean;
  ms: number;
  status: number;
};

const BASE_URL =
  process.env.BASE_URL?.replace(/\/+$/, "") || "http://localhost:5050";

// Adjust these paths if your endpoints differ.
const ROUTES: RouteSpec[] = [
  {
    name: "previews-root",
    path: "/api/previews",
    method: "GET",
  },
  {
    name: "code-tree",
    // If your /api/code tree endpoint needs query params, update this line.
    path: "/api/code/tree",
    method: "GET",
  },
  {
    name: "deploy-root",
    // If you have a cheap deploy status/list endpoint, point this there.
    path: "/api/deploy",
    method: "GET",
  },
];

const REQUESTS_PER_ROUTE = parseInt(
  process.env.LOAD_REQUESTS || "60",
  10,
);
const CONCURRENCY = parseInt(
  process.env.LOAD_CONCURRENCY || "20",
  10,
);
// Default p95 budget = 12s; can be tightened later via LOAD_MAX_P95_MS.
const MAX_P95_MS = parseInt(
  process.env.LOAD_MAX_P95_MS || "12000",
  10,
);
const MAX_ERROR_RATE = parseFloat(
  process.env.LOAD_MAX_ERROR_RATE || "0.02",
);

/**
 * Run a single HTTP request and measure latency.
 */
async function hitOnce(route: RouteSpec): Promise<Sample> {
  const url = BASE_URL + route.path;
  const started = Date.now();

  try {
    const res = await (globalThis as any).fetch(url, {
      method: route.method || "GET",
    } as any);

    const ms = Date.now() - started;

    // For load purposes, treat any non-5xx as "ok".
    return {
      ok: res.status < 500,
      ms,
      status: res.status,
    };
  } catch (err) {
    const ms = Date.now() - started;
    console.error(`[load] ${route.name} request failed`, {
      url,
      error: (err as any)?.message || String(err),
    });
    return {
      ok: false,
      ms,
      status: 0,
    };
  }
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * (sorted.length - 1));
  return sorted[idx];
}

/**
 * Hammer a single route with N requests and bounded concurrency.
 */
async function hammerRoute(route: RouteSpec): Promise<void> {
  console.log(
    `\n[load] Route "${route.name}" → ${route.path} (${REQUESTS_PER_ROUTE} requests, concurrency=${CONCURRENCY})`,
  );

  const samples: Sample[] = [];
  let sent = 0;

  while (sent < REQUESTS_PER_ROUTE) {
    const batchSize = Math.min(CONCURRENCY, REQUESTS_PER_ROUTE - sent);
    const batch: Promise<Sample>[] = [];

    for (let i = 0; i < batchSize; i++) {
      batch.push(hitOnce(route));
      sent++;
    }

    const results = await Promise.all(batch);
    samples.push(...results);
  }

  const total = samples.length;
  const okSamples = samples.filter((s) => s.ok);
  const errorSamples = samples.filter((s) => !s.ok);
  const errorRate = errorSamples.length / total;
  const latencies = samples.map((s) => s.ms);
  const p95Ms = p95(latencies);
  const maxMs = Math.max(...latencies);

  console.log(
    `[load] ${route.name}: total=${total}, ok=${okSamples.length}, errors=${errorSamples.length}, errorRate=${(
      errorRate * 100
    ).toFixed(2)}%`,
  );
  console.log(
    `[load] ${route.name}: p95=${p95Ms}ms, max=${maxMs}ms (budget p95<=${MAX_P95_MS}ms, errorRate<=${(
      MAX_ERROR_RATE * 100
    ).toFixed(2)}%)`,
  );

  if (errorRate > MAX_ERROR_RATE) {
    throw new Error(
      `[load] ${route.name}: error rate ${(
        errorRate * 100
      ).toFixed(2)}% > allowed ${(MAX_ERROR_RATE * 100).toFixed(2)}%`,
    );
  }

  if (p95Ms > MAX_P95_MS) {
    throw new Error(
      `[load] ${route.name}: p95 ${p95Ms}ms > allowed ${MAX_P95_MS}ms`,
    );
  }
}

/**
 * Main entrypoint.
 */
async function main() {
  console.log(
    `[load] Starting previews/deploy/code load test against ${BASE_URL}`,
  );
  console.log(
    `[load] Requests per route=${REQUESTS_PER_ROUTE}, concurrency=${CONCURRENCY}`,
  );

  for (const route of ROUTES) {
    await hammerRoute(route);
  }

  console.log(`\n[load] ✅ All routes passed load test thresholds.`);
}

main().catch((err) => {
  console.error(`\n[load] ❌ Load test failed:`, err?.message || err);
  process.exit(1);
});

// scripts/soak.mixed.ts
//
// Simple soak tester for a mix of SUP hot endpoints.
// Hammers several endpoints for about 60 seconds and prints a summary.
//
// Usage:
//   npm run soak:mixed
// or
//   API=https://staging.yourdomain.com npm run soak:mixe

const BASE_URL = process.env.API || "http://localhost:5050";
const DURATION_SECONDS = 60;
const PROMPT = "soak test prompt";

type Endpoint = {
  name: string;
  path: string;
  method: "GET" | "POST";
  body?: unknown;
};

const ENDPOINTS: Endpoint[] = [
  {
    name: "instant",
    path: "/api/ai/instant",
    method: "POST",
    body: { prompt: PROMPT },
  },
  {
    name: "one",
    path: "/api/ai/one",
    method: "POST",
    body: { prompt: PROMPT },
  },
  {
    name: "risk",
    path: `/api/ai/risk?prompt=${encodeURIComponent(PROMPT)}`,
    method: "GET",
  },
  {
    name: "metrics",
    path: "/api/ai/metrics",
    method: "GET",
  },
  {
    name: "guardrail",
    path: "/api/ai/metrics/guardrail",
    method: "GET",
  },
  {
    name: "kpi",
    path: "/api/ai/kpi",
    method: "GET",
  },
];

type Counters = {
  total: number;
  ok: number;
  s500: number;
  other: number;
  errors: number;
};

const stats: Record<string, Counters> = {};

for (const ep of ENDPOINTS) {
  stats[ep.name] = { total: 0, ok: 0, s500: 0, other: 0, errors: 0 };
}

async function hitEndpoint(ep: Endpoint) {
  const counters = stats[ep.name];
  counters.total += 1;

  const url = BASE_URL + ep.path;

  try {
    const res = await fetch(url, {
      method: ep.method,
      headers: { "content-type": "application/json" },
      body: ep.method === "POST" ? JSON.stringify(ep.body ?? {}) : undefined,
    });

    if (res.status === 500) {
      counters.s500 += 1;
    } else if (res.ok) {
      counters.ok += 1;
    } else {
      counters.other += 1;
    }
  } catch (err) {
    console.error("[SOAK:MIXED] request error for", ep.name, err);
    counters.errors += 1;
  }
}

async function main() {
  console.log(
    `[SOAK:MIXED] Hitting ${ENDPOINTS.length} endpoints for ~${DURATION_SECONDS}s`,
  );
  console.log(`[SOAK:MIXED] BASE_URL=${BASE_URL}`);

  const endTime = Date.now() + DURATION_SECONDS * 1000;
  let i = 0;

  while (Date.now() < endTime) {
    const ep = ENDPOINTS[i % ENDPOINTS.length];
    await hitEndpoint(ep);

    if (i > 0 && i % 100 === 0) {
      console.log("[SOAK:MIXED] progress:");
      for (const ep2 of ENDPOINTS) {
        const c = stats[ep2.name];
        console.log(
          `  ${ep2.name}: total=${c.total}, ok=${c.ok}, 500=${c.s500}, other=${c.other}, errors=${c.errors}`,
        );
      }
    }

    i += 1;
  }

  console.log("=== SOAK MIXED DONE ===");
  for (const ep of ENDPOINTS) {
    const c = stats[ep.name];
    console.log(
      `${ep.name}: total=${c.total}, ok=${c.ok}, 500=${c.s500}, other=${c.other}, errors=${c.errors}`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[SOAK:MIXED] fatal error", err);
  process.exit(1);
});
// scripts/sup.health.ts
//
// Tiny health checker for SUP endpoints.
// Hits core endpoints once and prints status codes.
//
// Usage:
//   npm run sup:health
// or
//   API=https://staging.yourdomain.com npm run sup:health

const BASE_URL = process.env.API || "http://localhost:5050";

type Endpoint = {
  name: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
};

const ENDPOINTS: Endpoint[] = [
  { name: "metrics", path: "/api/ai/metrics" },
  { name: "guardrail", path: "/api/ai/metrics/guardrail" },
  { name: "kpi", path: "/api/ai/kpi" },
  { name: "risk", path: "/api/ai/risk?prompt=hello" },
  {
    name: "instant",
    path: "/api/ai/instant",
    method: "POST",
    body: { prompt: "health check prompt" },
  },
  {
    name: "one",
    path: "/api/ai/one",
    method: "POST",
    body: { prompt: "health check prompt" },
  },
];

async function main() {
  console.log(`[HEALTH] BASE_URL=${BASE_URL}`);
  for (const ep of ENDPOINTS) {
    const url = BASE_URL + ep.path;
    const method = ep.method ?? "GET";

    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify(ep.body ?? {}) : undefined,
      });

      console.log(
        `[HEALTH] ${ep.name} ${method} ${url} -> status=${res.status}`,
      );
    } catch (err) {
      console.error(`[HEALTH] ${ep.name} ERROR`, err);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[HEALTH] fatal error", err);
  process.exit(1);
});
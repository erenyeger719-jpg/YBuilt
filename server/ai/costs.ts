// server/ai/costs.ts
// Light telemetry with an explicit "pricing pending" flag.
// Until pricing is finalized, cents=0 and pending=true.

type Cost = { latencyMs: number; tokens: number; cents: number; pending: boolean };

const PRICING_UNSET =
  String(process.env.PRICING_UNSET || "true").toLowerCase() !== "false";

// Tunables (used only when PRICING_UNSET=false)
const DEFAULT_TOKENS_PER_CHAR = Math.max(
  1,
  parseInt(process.env.COST_TOKENS_PER_1KCHARS || "250", 10) // ≈1 token/4 chars
);
const DEFAULT_LAT_MS = Math.max(1, parseInt(process.env.COST_LAT_MS || "400", 10)); // avg E2E latency
const CPM_USD = Math.max(0, parseFloat(process.env.COST_CPM_USD || "3.00")); // $/1k tokens
const USD_TO_CENTS = 100;

let warned = false;

function countTokensLike(obj: any): number {
  const s = JSON.stringify(obj ?? "");
  const chars = s.length;
  const tokens = Math.ceil((chars / 1000) * DEFAULT_TOKENS_PER_CHAR);
  return Math.max(1, tokens);
}

export function estimateCost(specOrPrepared: any): Cost {
  if (PRICING_UNSET && !warned) {
    warned = true;
    // one-time breadcrumb in logs so no one forgets:
    console.warn(
      "[costs] Pricing is UNSET. Returning cents=0 with pending=true. " +
        "Set PRICING_UNSET=false and COST_CPM_USD/VITE_FX_USD_INR later."
    );
  }

  const tokens = countTokensLike({
    sections: specOrPrepared?.sections,
    copy: specOrPrepared?.copy,
    brand: specOrPrepared?.brand,
  });

  const latencyMs = DEFAULT_LAT_MS;

  if (PRICING_UNSET) {
    return { latencyMs, tokens, cents: 0, pending: true };
  }

  const cents = (tokens / 1000) * CPM_USD * USD_TO_CENTS;
  return { latencyMs, tokens, cents: Math.round(cents * 100) / 100, pending: false };
}

// Optional helper if you need it elsewhere
export const pricingUnset = PRICING_UNSET;

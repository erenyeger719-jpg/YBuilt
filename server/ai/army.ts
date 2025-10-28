// server/ai/army.ts
// ULTI SUP ALGO — 20-plan Army Orchestrator (zero-LLM path, starvation-first)

import { cheapCopy, guessBrand } from "../intent/copy.ts";
import { fillSlots } from "../intent/slots.ts";
import { listPacksRanked } from "../sections/packs.ts";

type Plan = {
  tone: "minimal" | "playful" | "serious";
  dark: boolean;
  breadth: "" | "wide";
  sections: string[];
};

type ArmyResult = {
  best: {
    url: string | null;
    pageId: string | null;
    score: number;
    plan: Plan;
  } | null;
  leaderboard: Array<{ score: number; plan: Plan; url: string | null; pageId: string | null }>;
  tried: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJSONWithTimeout(url: string, opts: any = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...(opts || {}), signal: ctrl.signal });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `HTTP_${(r as any).status}`);
    return JSON.parse(txt || "{}");
  } finally {
    clearTimeout(id);
  }
}

function buildPlans(): Plan[] {
  const packs = listPacksRanked().slice(0, 8); // take top 8 inventory entries
  const tones: Plan["tone"][] = ["minimal", "playful", "serious"];
  const darks = [false, true] as const;
  const breadths: Plan["breadth"][] = ["", "wide"];

  const combos: Plan[] = [];
  let pi = 0;
  for (const tone of tones) {
    for (const dark of darks) {
      for (const breadth of breadths) {
        // rotate through the top packs
        const pick = packs[pi % Math.max(1, packs.length)];
        combos.push({
          tone,
          dark,
          breadth,
          sections: (pick?.sections || ["hero-basic", "cta-simple"]).slice(),
        });
        pi++;
      }
    }
  }

  // sprinkle a few heavier and lighter presets to reach 20
  const light = ["hero-basic"];
  const medium = ["hero-basic", "features-3col", "cta-simple"];
  const heavy = ["hero-basic", "features-3col", "pricing-simple", "faq-accordion", "cta-simple"];
  combos.push({ tone: "minimal", dark: false, breadth: "", sections: light });
  combos.push({ tone: "serious", dark: true, breadth: "", sections: medium });
  combos.push({ tone: "playful", dark: false, breadth: "wide", sections: heavy });
  combos.push({ tone: "serious", dark: false, breadth: "wide", sections: heavy });
  combos.push({ tone: "minimal", dark: true, breadth: "", sections: medium });

  return combos.slice(0, 20);
}

function scoreProofCard(pc: any): number {
  let s = 0;
  const proofOk = !!pc?.proof_ok;
  const a11y = !!pc?.a11y;
  const visual = Number(pc?.visual ?? 0);
  const lcp = Number(pc?.lcp_est_ms ?? 3000);
  const cls = Number(pc?.cls_est ?? 0.2);

  s += proofOk ? 100 : -50;
  s += a11y ? 20 : -10;
  s += Math.max(0, Math.min(50, visual * 0.5));
  if (lcp < 2500) s += 10;
  if (lcp > 4000) s -= 10;
  if (cls < 0.10) s += 5;
  if (cls > 0.25) s -= 5;

  return Math.round(s);
}

async function composeOnce(baseUrl: string, prompt: string, sessionId: string, plan: Plan) {
  // Build deterministic spec + copy (no LLM)
  const spec = {
    summary: prompt,
    brand: { tone: plan.tone, dark: plan.dark },
    layout: { sections: plan.sections },
    confidence: 0.7,
  } as any;

  let copy = cheapCopy(prompt, {
    vibe: plan.tone,
    color_scheme: plan.dark ? "dark" : "light",
    sections: plan.sections,
  } as any);
  copy = (fillSlots({ prompt, spec, copy }) as any).copy;

  const brandColor =
    guessBrand({ vibe: plan.tone, color_scheme: plan.dark ? "dark" : "light", sections: plan.sections } as any) ||
    "#6d28d9";

  const composeAction = {
    kind: "compose",
    cost_est: 0,
    gain_est: 20,
    args: {
      sections: plan.sections,
      copy,
      brand: { primary: brandColor },
      breadth: plan.breadth, // "" or "wide"
    },
  };

  const r = await fetchJSONWithTimeout(`${baseUrl}/api/ai/act`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, spec: { ...spec, brandColor, copy }, action: composeAction }),
  });

  const url = r?.result?.url || r?.result?.path || null;
  const pageId = r?.result?.pageId || null;

  // Pull Proof Card with small retries (FS write is synchronous, but be gentle)
  let proof: any = null;
  if (pageId) {
    for (let i = 0; i < 5; i++) {
      try {
        const pc = await fetchJSONWithTimeout(`${baseUrl}/api/ai/proof/${pageId}`, { method: "GET" }, 8000);
        if (pc?.ok && pc?.proof) {
          proof = pc.proof;
          break;
        }
      } catch {}
      await sleep(120);
    }
  }

  return { url, pageId, proof };
}

async function runInBatches<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as any;
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runArmy(args: { prompt: string; sessionId: string; baseUrl: string; concurrency?: number }): Promise<ArmyResult> {
  const { prompt, sessionId, baseUrl, concurrency = 4 } = args;
  const plans = buildPlans();

  const results = await runInBatches(plans, concurrency, async (plan) => {
    const { url, pageId, proof } = await composeOnce(baseUrl, prompt, sessionId, plan);
    const score = proof ? scoreProofCard(proof) : -999;
    return { plan, url, pageId, score };
  });

  const ranked = results
    .filter((r) => r.url && r.pageId)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] || null;
  const leaderboard = ranked.slice(0, 5).map((r) => ({
    score: r.score,
    plan: r.plan,
    url: r.url,
    pageId: r.pageId,
  }));

  return {
    best: best ? { url: best.url, pageId: best.pageId, score: best.score, plan: best.plan } : null,
    leaderboard,
    tried: results.length,
  };
}

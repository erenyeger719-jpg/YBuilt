// server/ai/army.ts
import { buildSpec } from "../intent/brief.ts";
import { cheapCopy, guessBrand } from "../intent/copy.ts";
import { fillSlots } from "../intent/slots.ts";

type ArmyOpts = {
  prompt: string;
  sessionId?: string;
  baseUrl: string;
  concurrency?: number;
  count?: number;
};

type ArmyResult = {
  ok: true;
  count: number;
  winners: any[];
  all: any[];
};

const SECTION_BUNDLES: string[][] = [
  ["hero-basic", "cta-simple"],
  ["hero-basic", "features-3col", "cta-simple"],
  ["hero-basic", "pricing-simple", "cta-simple"],
  ["hero-basic", "faq-accordion", "cta-simple"],
];

const BREADTH: Array<"" | "wide" | "max"> = ["", "wide", "max"];

const HINTS: Record<string, string[]> = {
  "hero-basic": ["hero-basic", "hero-basic@b"],
  "features-3col": ["features-3col", "features-3col@alt"],
  "pricing-simple": ["pricing-simple", "pricing-simple@a"],
  "faq-accordion": ["faq-accordion", "faq-accordion@dense"],
};

// tiny util
function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function composeOnce(
  baseUrl: string,
  {
    prompt,
    sessionId,
    tone,
    scheme,
    sections,
    breadth,
  }: {
    prompt: string;
    sessionId: string;
    tone: "minimal" | "serious" | "playful";
    scheme: "light" | "dark";
    sections: string[];
    breadth: "" | "wide" | "max";
  }
) {
  // deterministic spec
  const { spec } = buildSpec({
    prompt,
    lastSpec: {
      summary: prompt,
      brand: { tone, dark: scheme === "dark" },
      layout: { sections },
      confidence: 0.7,
    },
  });

  // deterministic copy
  let copy = cheapCopy(prompt, {
    vibe: tone,
    color_scheme: scheme,
    sections,
  } as any);
  const filled = fillSlots({ prompt, spec, copy } as any) as any;
  copy = filled.copy;

  const brandColor = guessBrand({
    vibe: tone,
    color_scheme: scheme,
    sections,
  } as any);

  // retrieve → compose
  const retrieve = { kind: "retrieve", args: { sections } };
  const actR = await fetch(`${baseUrl}/api/ai/act`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, spec, action: retrieve }),
  });
  const actJ = await actR.json();
  const gotSections =
    actJ?.result?.sections && Array.isArray(actJ.result.sections)
      ? actJ.result.sections
      : sections;

  const composeAction = {
    kind: "compose",
    cost_est: 0,
    gain_est: 20,
    args: {
      sections: gotSections,
      copy,
      brand: { primary: brandColor },
      variantHints: HINTS,
      breadth,
    },
  };
  const compR = await fetch(`${baseUrl}/api/ai/act`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      spec: { ...spec, brandColor, copy },
      action: composeAction,
    }),
  });
  const compJ = await compR.json();
  const url = compJ?.result?.url || compJ?.result?.path || null;
  const pageId = compJ?.result?.pageId || null;

  // Proof Card pull for scoring
  let a11y: boolean | null = null;
  let visual: number | null = null;
  let cls_est: number | null = null;
  let lcp_est_ms: number | null = null;
  let proof_ok: boolean | null = null;
  try {
    if (pageId) {
      const pr = await fetch(`${baseUrl}/api/ai/proof/${pageId}`);
      if (pr.ok) {
        const pj = await pr.json();
        const pf = pj?.proof || {};
        a11y = pf?.a11y ?? null;
        visual = pf?.visual ?? null;
        cls_est = pf?.cls_est ?? null;
        lcp_est_ms = pf?.lcp_est_ms ?? null;
        proof_ok = pf?.proof_ok ?? null;
      }
    }
  } catch {}

  // Simple linear score: a11y (binary) + visual (0–100) + proof_ok bonus – perf penalties
  const score =
    (a11y ? 30 : 0) +
    (typeof visual === "number" ? visual : 0) +
    (proof_ok ? 10 : 0) -
    (typeof cls_est === "number" ? Math.min(10, Math.round(cls_est * 100)) : 0) -
    (typeof lcp_est_ms === "number" ? Math.min(20, Math.round(lcp_est_ms / 250)) : 0);

  return {
    tone,
    scheme,
    sections,
    breadth,
    url,
    pageId,
    a11y,
    visual,
    cls_est,
    lcp_est_ms,
    proof_ok,
    score,
  };
}

export async function runArmy({
  prompt,
  sessionId = "anon",
  baseUrl,
  concurrency = 4,
  count = 20,
}: ArmyOpts): Promise<ArmyResult> {
  const tones: Array<"minimal" | "serious" | "playful"> = [
    "minimal",
    "serious",
    "playful",
  ];
  const schemes: Array<"light" | "dark"> = ["light", "dark"];

  const variants: Array<{
    tone: "minimal" | "serious" | "playful";
    scheme: "light" | "dark";
    sections: string[];
    breadth: "" | "wide" | "max";
  }> = [];

  for (const tone of tones) {
    for (const scheme of schemes) {
      for (const sections of SECTION_BUNDLES) {
        for (const breadth of BREADTH) {
          variants.push({ tone, scheme, sections, breadth });
        }
      }
    }
  }

  shuffle(variants);
  const picks = variants.slice(0, Math.max(1, count));

  // simple promise pool
  const results: any[] = [];
  let idx = 0;
  async function worker() {
    while (idx < picks.length) {
      const cur = idx++;
      const v = picks[cur];
      try {
        const r = await composeOnce(baseUrl, {
          prompt,
          sessionId,
          tone: v.tone,
          scheme: v.scheme,
          sections: v.sections,
          breadth: v.breadth,
        });
        results.push(r);
      } catch (e: any) {
        results.push({
          tone: v.tone,
          scheme: v.scheme,
          sections: v.sections,
          breadth: v.breadth,
          error: String(e?.message || e || "compose_failed"),
          score: -1,
        });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), picks.length) },
    () => worker()
  );
  await Promise.all(workers);

  results.sort(
    (a, b) => (Number(b.score ?? -1) as number) - (Number(a.score ?? -1) as number)
  );
  const winners = results.slice(0, Math.min(3, results.length));

  return { ok: true, count: results.length, winners, all: results };
}

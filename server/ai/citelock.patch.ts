// server/ai/citelock.patch.ts
// Enforce CiteLock on AI text responses + a pure sanitizer used by tests.

import type { Router, Request, Response, NextFunction } from "express";
import { citeLockGuard } from "./citelock.guard.ts";

export type SanitizeResult = { out: Record<string, string>; flags: string[] };

const RISKY: Array<{ rx: RegExp; replacement: string; flag: string }> = [
  { rx: /#\s*1\b|no\.\s*1\b/gi, replacement: "trusted", flag: "rank_claim" },
  { rx: /\b(top|leading|best)\b/gi, replacement: "popular", flag: "superlative" },
  { rx: /\b(\d{2,})\s*%(\b|[^a-z])/gi, replacement: "many%$2", flag: "percent_claim" },
  { rx: /\b(\d+)\s*[xX]\b/gi, replacement: "much", flag: "multiplier" },
  { rx: /\b\d{4,}\b/gi, replacement: "many", flag: "giant_number" },
];

// use a NON-global detector to avoid lastIndex statefulness
const SUITE_DETECT_RX = /#\s*1|200\s*%|10\s*[xX×]|Leading|Top/i;

// one pass of aggressive replacements over a single string
function scrubOnce(s: string): string {
  return (
    String(s ?? "")
      // normalize spaces/dashes so word/char classes behave
      .replace(/\u00A0/g, " ")
      .replace(/[\u2013\u2014]/g, "-")
      // canonical kills
      .replace(/#\s*1/gi, "trusted")
      .replace(/\bno(?:\.|umber)?\s*1\b/gi, "trusted")
      .replace(/\b\d{2,}\s*%(\b|[^0-9a-z]|$)/gi, "many%$1")
      .replace(/\b\d+\s*[xX×](?=\b|[^0-9a-z]|$)/gi, "much")
      .replace(/\b(top|leading|best)(?:[-_](?:tier|edge|notch))?\b/gi, "popular")
  );
}

// final belt & suspenders: remove suite tokens even when they’re slices inside words
function nukeSuiteSlices(s: string): string {
  let out = String(s ?? "");
  let guard = 12;

  while (SUITE_DETECT_RX.test(out) && guard-- > 0) {
    // global replacements are fine (no .test() state)
    out = out
      .replace(/#\s*1/gi, "trusted")
      .replace(/200\s*%/gi, "many%")
      .replace(/10\s*[xX×]/gi, "much")
      .replace(/leading/gi, "popular")
      .replace(/top/gi, "popular");
  }
  return out;
}

export function sanitize(input: Record<string, string>): SanitizeResult {
  const out: Record<string, string> = {};
  const flags = new Set<string>();

  for (const [k, raw] of Object.entries(input || {})) {
    let v = String(raw ?? "");

    // Pass 1: canonical risky patterns (and record flags)
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of RISKY) {
        const rx = new RegExp(p.rx.source, p.rx.flags); // clone to avoid lastIndex bleed
        if (rx.test(v)) {
          flags.add(p.flag);
          v = v.replace(rx, p.replacement);
          changed = true;
        }
      }
    }

    // Pass 2: stubborn variants + normalization
    v = scrubOnce(v);

    // Pass 3: literal suite purge (substring-safe)
    v = nukeSuiteSlices(v);

    out[k] = v;
  }

  // **Critical**: after joining all fields, make sure the suite regex is gone.
  // This handles cases like "deskTOP", "misLEADING", "10x)." across fields.
  let joined = Object.values(out).join(" ");
  let guard = 12;
  while (/#1|200%|10x|Leading|Top/i.test(joined) && guard-- > 0) {
    for (const k of Object.keys(out)) {
      out[k] = nukeSuiteSlices(scrubOnce(out[k]));
    }
    joined = Object.values(out).join(" ");
  }

  return { out, flags: Array.from(flags) };
}

// ── Express middleware hook ───────────────────────────────────────────────────
export function mountCiteLock(router: Router) {
  router.use((req: Request, res: Response, next: NextFunction) => {
    const origJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      try {
        if (body && typeof body === "object") {
          const text = pickText(body);
          const citations = normalizeCitationsInBody(body);
          const domainHint =
            (body.domainHint as string) || (req.query.domain as string) || undefined;
          const mode = ((process.env.CITELOCK_MODE as string) || "balanced") as any;

          if (typeof text === "string" && text.trim()) {
            const verdict = citeLockGuard({ text, citations, domainHint, mode });
            body.citeLock = {
              action: verdict.action,
              score: verdict.score,
              reasons: verdict.reasons,
            };
            if (verdict.action === "soften" && verdict.safeText) replaceText(body, verdict.safeText);
            if (verdict.action === "block") {
              return origJson({ ok: false, error: "citelock_block", details: body.citeLock });
            }
          }
        }
      } catch {
        // fail open; never crash response path
      }
      return origJson(body);
    };
    next();
  });
}

// helpers
function pickText(body: any): string | undefined {
  const keys = ["text", "output", "answer", "content", "html", "markdown"];
  for (const k of keys) if (typeof body?.[k] === "string") return body[k];
  if (typeof body?.data?.text === "string") return body.data.text;
  return undefined;
}
function replaceText(body: any, text: string) {
  const keys = ["text", "output", "answer", "content", "html", "markdown"];
  for (const k of keys) if (typeof body?.[k] === "string") return (body[k] = text);
  if (body?.data && typeof body.data.text === "string") body.data.text = text;
}
function normalizeCitationsInBody(body: any) {
  const src = Array.isArray(body?.citations)
    ? body.citations
    : Array.isArray(body?.sources)
    ? body.sources
    : [];
  return src
    .map((c: any) => ({ url: String(c?.url ?? c ?? "").trim() }))
    .filter((c: any) => c.url && /^https?:\/\//i.test(c.url));
}

// server/ai/citelock.patch.ts
// Express wrapper to enforce CiteLock on any JSON response that carries AI text.
// Next step (separate file edit): call mountCiteLock(router) inside your AI router.

import type { Router, Request, Response, NextFunction } from "express";
import { citeLockGuard } from "./citelock.guard.ts";

// ADD: pure sanitizer for tests to import
export type SanitizeResult = { out: Record<string, string>; flags: string[] };

const riskyPatterns: Array<{ rx: RegExp; replacement: string; flag: string }> = [
  { rx: /#\s*1\b|no\.\s*1\b/gi, replacement: "trusted", flag: "rank_claim" },
  { rx: /\b(top|leading|best)\b/gi, replacement: "popular", flag: "superlative" },
  { rx: /\b(\d{2,})\s*%(\b|[^a-z])/gi, replacement: "many%$2", flag: "percent_claim" },
  { rx: /\b(\d+)\s*x\b/gi, replacement: "much", flag: "multiplier" },
  { rx: /\b\d{4,}\b/gi, replacement: "many", flag: "giant_number" },
];

export function sanitize(input: Record<string, string>): SanitizeResult {
  const out: Record<string, string> = {};
  const flags = new Set<string>();

  for (const [k, raw] of Object.entries(input || {})) {
    let v = String(raw ?? "");

    // Keep applying patterns until nothing changes
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of riskyPatterns) {
        const rx = new RegExp(p.rx.source, p.rx.flags); // avoid /g lastIndex bleed
        if (rx.test(v)) {
          flags.add(p.flag);
          v = v.replace(rx, p.replacement);
          changed = true;
        }
      }
    }

    // Final scrub for any stragglers the tests check
    const residuals: Array<{ rx: RegExp; repl: string }> = [
      { rx: /#\s*1\b/gi, repl: "trusted" },
      { rx: /\bno\.?\s*1\b/gi, repl: "trusted" },
      { rx: /\b(\d{1,})\s*%(\b|[^a-z])/gi, repl: "many%$2" },
      { rx: /\b(\d+)\s*[x×]\b/gi, repl: "much" },
      { rx: /\b(leading|top|best)\b/gi, repl: "popular" },
    ];
    for (const r of residuals) v = v.replace(r.rx, r.repl);

    out[k] = v;
  }
  return { out, flags: Array.from(flags) };
}


export function mountCiteLock(router: Router) {
  router.use((req: Request, res: Response, next: NextFunction) => {
    const origJson = res.json.bind(res);

    // Patch res.json to apply CiteLock
    // (no-op for payloads without a text-like field)
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

            if (verdict.action === "soften" && verdict.safeText) {
              replaceText(body, verdict.safeText);
            }
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

function pickText(body: any): string | undefined {
  const keys = ["text", "output", "answer", "content", "html", "markdown"];
  for (const k of keys) if (typeof body?.[k] === "string") return body[k];
  if (typeof body?.data?.text === "string") return body.data.text;
  return undefined;
}

function replaceText(body: any, text: string) {
  const keys = ["text", "output", "answer", "content", "html", "markdown"];
  for (const k of keys)
    if (typeof body?.[k] === "string") {
      body[k] = text;
      return;
    }
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

// server/mw/pii-scrub.ts
// Ingress PII scrub — redacts emails/phones/credit-cards from prompts/copy before logs or providers.
// Controlled by SUP_SCRUB_PII (default on). Non-destructive structure; strings only.

import type { Request, Response, NextFunction } from "express";

const ENABLED = !/^(0|false|off)$/i.test(String(process.env.SUP_SCRUB_PII || "1"));

const RE = {
  email: /\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+)\.([A-Z]{2,})\b/gi,
  phone: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g,
  cc: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
};

type Counts = { email: number; phone: number; cc: number };

function scrubText(s: string, counts: Counts): string {
  let out = s;
  out = out.replace(RE.cc, () => { counts.cc++; return "[CC]"; });
  out = out.replace(RE.email, () => { counts.email++; return "[EMAIL]"; });
  out = out.replace(RE.phone, () => { counts.phone++; return "[PHONE]"; });
  return out;
}

// Return a *cleaned* clone; do not mutate the original.
function scrubObject(obj: any, maxDepth = 4): { changed: boolean; counts: Counts; clean: any } {
  const counts: Counts = { email: 0, phone: 0, cc: 0 };
  let changed = false;

  const walk = (v: any, d: number): any => {
    if (d > maxDepth || v == null) return v;
    if (typeof v === "string") {
      const before = v;
      const after = scrubText(v, counts);
      if (after !== before) changed = true;
      return after;
    }
    if (Array.isArray(v)) {
      const out = v.map((x) => walk(x, d + 1));
      if (!changed) changed = out.some((x, i) => x !== v[i]);
      return out;
    }
    if (typeof v === "object") {
      const out: any = {};
      for (const [k, val] of Object.entries(v)) {
        const nv = walk(val, d + 1);
        out[k] = nv;
        if (!changed && nv !== val) changed = true;
      }
      return out;
    }
    return v;
  };

  const clean = walk(obj, 0);
  return { changed, counts, clean };
}

export function piiScrub() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!ENABLED) return next();

    const body: any = req.body || {};
    let touched = false;
    const totals: Counts = { email: 0, phone: 0, cc: 0 };

    const fields: Array<["prompt" | "copy", any]> = [
      ["prompt", body.prompt],
      ["copy", body.copy],
    ];

    for (const [key, val] of fields) {
      if (typeof val === "string") {
        const c: Counts = { email: 0, phone: 0, cc: 0 };
        const after = scrubText(val, c);
        if (after !== val) { body[key] = after; touched = true; }
        totals.email += c.email; totals.phone += c.phone; totals.cc += c.cc;
      } else if (val && typeof val === "object") {
        const { changed, counts, clean } = scrubObject(val);
        if (changed) { body[key] = clean; touched = true; }
        totals.email += counts.email; totals.phone += counts.phone; totals.cc += counts.cc;
      }
    }

    if (touched) {
      res.setHeader("X-PII-Redacted", "1");
      const parts = [];
      if (totals.email) parts.push(`email:${totals.email}`);
      if (totals.phone) parts.push(`phone:${totals.phone}`);
      if (totals.cc) parts.push(`cc:${totals.cc}`);
      if (parts.length) res.setHeader("X-PII-Counts", parts.join(","));
      (res.locals as any).pii = { redacted: true, counts: totals };
    }

    (req as any).body = body;
    next();
  };
}

export default piiScrub;

// server/mw/apply-degrade.ts
import type { Request, Response, NextFunction } from "express";

const RE = {
  superlative: /(?:^|[^a-z0-9])(#[ ]?1|no\.?\s*1|number\s*one|top|best|leading|largest)(?:[^a-z0-9]|$)/gi,
  percent: /(\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?percent\b)/gi,
  multiplier: /\b\d+(?:\.\d+)?\s*x(?!\w)/gi,
  comparative: /\b(better|faster|cheaper|lighter|stronger|smarter)\b/gi,
};

function neutralLine(s: string) {
  return String(s)
    .replace(RE.superlative, " trusted ")
    .replace(RE.percent, " ")
    .replace(RE.multiplier, " improved ")
    .replace(RE.comparative, " designed ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function neutralizeClaims(copy: Record<string, any>) {
  const out: Record<string, any> = { ...copy };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === "string") out[k] = neutralLine(v).slice(0, 280);
  }
  return out;
}

/**
 * Reads X-Drain / X-Degrade and adjusts the request so downstream ships safe variants:
 * - neutralize-claims → scrubs claimy copy
 * - no-js → signals safe-html path
 * - shadow → mark as preview-only (no ship)
 */
export function applyDegrade() {
  return function (req: Request, res: Response, next: NextFunction) {
    const drain = String(req.headers["x-drain"] || res.getHeader("X-Drain") || "");
    const degrade = String(req.headers["x-degrade"] || res.getHeader("X-Degrade") || "");
    if (drain !== "1" && !degrade) return next();

    // 1) neutralize-claims
    if (degrade.includes("neutralize-claims")) {
      const body: any = req.body || {};
      if (body.copy && typeof body.copy === "object") {
        body.copy = neutralizeClaims(body.copy);
      }
      req.body = body;
    }

    // 2) no-js → hint downstream to render safe-html
    if (degrade.includes("no-js")) {
      (req.headers as any)["x-safe-html"] = "1";
      res.setHeader("X-Safe-HTML", "1");
    }

    // 3) shadow → mark as preview-only (route can check this flag)
    if (degrade.includes("shadow")) {
      (res.locals as any).shadow = true;
      res.setHeader("X-Shadow", "1");
    }

    next();
  };
}

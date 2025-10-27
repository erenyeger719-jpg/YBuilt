// server/intent/builder.ts
import { runStaticChecks } from "./tests.ts";
import { safeHtmlAutoFix, applyIndexOps } from "./autofix.ts";

async function fetchTextWithTimeout(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal as any });
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP_${r.status}`);
    return txt;
  } finally {
    clearTimeout(id);
  }
}

async function callReview(baseUrl: string, code: string, sessionId: string) {
  try {
    const r = await fetch(`${baseUrl}/api/ai/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, sessionId, tier: "balanced" }),
    });
    const j = await r.json();
    return Array.isArray(j?.review?.issues) ? j.review.issues : [];
  } catch {
    return [];
  }
}

export async function runBuilder(params: {
  prompt: string;
  sessionId?: string;
  baseUrl: string;
  autofix?: boolean; // optional auto-fix pass
}) {
  const sessionId = params.sessionId || "anon";

  // 1) Reuse your brain: intent → retrieve → compose (via /api/ai/one)
  const oneR = await fetch(`${params.baseUrl}/api/ai/one`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: params.prompt, sessionId }),
  });
  const one = await oneR.json();
  if (!one?.ok) {
    return { ok: false, error: "one_failed", detail: one?.error || null };
  }

  const url = one?.url || one?.result?.url || null;
  const spec = one?.spec || {};
  if (!url) {
    return {
      ok: true,
      url: null,
      spec,
      tests: { pass: false, score: 0, issues: [{ type: "html", msg: "No URL shipped" }] },
    };
  }

  // 2) Pull HTML of the shipped page (coarse but good enough)
  let html = "";
  try {
    html = await fetchTextWithTimeout(url, 12000);
  } catch {
    // Still return URL + spec even if we couldn't fetch content
    return {
      ok: true,
      url,
      spec,
      tests: { pass: false, score: 0, issues: [{ type: "perf", msg: "Fetch of preview timed out" }] },
    };
  }

  // 3) Run baseline checks
  const tests0 = runStaticChecks({
    html,
    brandPrimary: spec?.brandColor || spec?.brand?.primary,
    dark: !!spec?.brand?.dark,
  });
  if (tests0.pass || !params.autofix) {
    return { ok: true, url, spec, tests: tests0 };
  }

  // 4) Safe local fixes
  const safe = safeHtmlAutoFix(html, spec);
  const tests1 = runStaticChecks({
    html: safe.html,
    brandPrimary: spec?.brandColor || spec?.brand?.primary,
    dark: !!spec?.brand?.dark,
  });
  if (tests1.pass) {
    return {
      ok: true,
      url,
      spec,
      tests: tests1,
      autofix: { stage: "local", changes: safe.changes },
    };
  }

  // 5) Fallback: one critic pass on index.html only
  const issues = await callReview(params.baseUrl, safe.html, sessionId);
  const ops = (issues[0]?.ops || []).filter((op: any) => String(op?.file) === "index.html");
  const applied = applyIndexOps(safe.html, ops);
  const tests2 = runStaticChecks({
    html: applied.html,
    brandPrimary: spec?.brandColor || spec?.brand?.primary,
    dark: !!spec?.brand?.dark,
  });

  return {
    ok: true,
    url,
    spec,
    tests: tests2,
    autofix: {
      stage: "review",
      local_changes: safe.changes,
      review_ops_applied: applied.applied,
      review_ops_total: ops.length,
      issues_count: Array.isArray(issues) ? issues.length : 0,
    },
  };
}

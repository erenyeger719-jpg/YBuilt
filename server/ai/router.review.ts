// server/ai/router.review.ts - Part 2: Review & Planning Routes
import { Router } from "express";
import express from "express";
import { 
  pickModel,
  pickTierByConfidence,
  issuesKeyset,
  jaccard,
  sha1,
  quickGuessIntent,
  applyChipLocal,
  requireFetch,
  baseUrl
} from "./router.helpers.ts";
import { LAST_REVIEW_SIG } from "./router.ts";

// Import dependencies
import { buildSpec } from "../intent/brief.ts";
import { nextActions } from "../intent/planner.ts";
import { filterIntent } from "../intent/filter.ts";
import { clarifyChips } from "../intent/clarify.ts";
import { pickExpertFor, recordExpertOutcome, expertsForTask } from "../intent/experts.ts";
import { chatJSON } from "../llm/registry.ts";
import { pickFromPlaybook } from "../intent/playbook.ts";
import { pushSignal, summarize } from "../intent/signals.ts";
import { cheapCopy, guessBrand } from "../intent/copy.ts";
import { fillSlots } from "../intent/slots.ts";

// Setup function to mount all review/planning routes
export function setupReviewRoutes(router: Router) {
  
  // ---------- /review ----------
  router.post("/review", express.json(), async (req, res) => {
    try {
      let { code = "", tier = "balanced", sessionId = "anon" } = (req.body || {}) as any;
      if (!code || typeof code !== "string")
        return res.status(400).json({ ok: false, error: "Missing code" });
      if (!process.env.OPENAI_API_KEY)
        return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not set" });

      // Trim gigantic inputs (cost guard)
      const codeTrim = String(code).slice(0, 60_000);
      const sig = sha1(codeTrim);
      if (LAST_REVIEW_SIG.get(sessionId) === sig) {
        return res.json({ ok: true, review: { issues: [] }, note: "skipped_same_code" });
      }

      const system = `
You analyze tiny static web projects (index.html, styles.css, app.js).
Return ONLY JSON with this exact shape, no prose:
{"issues":[{"type":"accessibility|performance|html|css|js|semantics|seo|content|other","msg":"short","fix":"short","ops":[{"file":"index.html|styles.css|app.js","find":"...","replace":"...","isRegex":false}]}]}
Rules:
- Prefer precise find/replace ops.
- Only files: index.html, styles.css, app.js.
- To append: {"file":"...","find":"$$EOF$$","replace":"\\n...","isRegex":false}
- If nothing to fix, return {"issues":[]}.
`.trim();

      const user = `CODE BUNDLE:\n${codeTrim}\n---\nTIER: ${tier}`;

      async function runCritic(exp: any) {
        const t0 = Date.now();

        // Use registry-based call rather than direct OpenAI HTTP
        const { json } = await chatJSON({
          task: "critic",
          system,
          user,
          temperature: 0,
          max_tokens: Number(process.env.OPENAI_REVIEW_MAXTOKENS || 600),
          timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 20000),
          tags: { model_hint: exp.model },
          req, // allow header overrides: x-llm-provider, x-llm-shadow
        });

        const ms = Date.now() - t0;
        try {
          recordExpertOutcome(exp.key, {
            success: true,
            ms,
            cents: exp.cost_cents,
            tokens: exp.tokens_est,
          });
        } catch {}
        return Array.isArray(json.issues) ? json.issues : [];
      }

      // Two cheap critics → compare → maybe escalate
      const cheapA = pickExpertFor("critic", { maxCents: 0.05 });
      let cheapB = pickExpertFor("critic", { maxCents: 0.05 });
      if (cheapA && cheapB && cheapA.key === cheapB.key) {
        try {
          const pool = expertsForTask("critic", 0.05);
          cheapB = pool.find((e) => e.key !== cheapA.key) || cheapB;
        } catch {}
      }
      if (!cheapA || !cheapB)
        return res.status(500).json({ ok: false, error: "no_critic_available" });

      const issuesA = await runCritic(cheapA);
      const issuesB = await runCritic(cheapB);

      const sim = jaccard(issuesKeyset(issuesA), issuesKeyset(issuesB));
      let issues = issuesA;

      // If the two cheap passes disagree, escalate once to best critic
      if (sim < 0.7) {
        const best = pickExpertFor("critic"); // no maxCents → can choose best
        if (best) {
          issues = await runCritic(best);
        }
      }

      const cleaned = (issues || []).map((it: any) => ({
        type: String(it.type || "other").slice(0, 40),
        msg: String(it.msg || "").slice(0, 500),
        fix: it.fix ? String(it.fix).slice(0, 4000) : undefined,
        ops: Array.isArray(it.ops)
          ? it.ops
              .filter((op: any) => ["index.html", "styles.css", "app.js"].includes(String(op.file)))
              .map((op: any) => ({
                file: String(op.file),
                find: String(op.find ?? ""),
                replace: String(op.replace ?? ""),
                isRegex: Boolean(op.isRegex),
              }))
          : [],
      }));

      LAST_REVIEW_SIG.set(sessionId, sig);
      return res.json({ ok: true, review: { issues: cleaned } });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || "review_failed" });
    }
  });

  // ---------- /brief ----------
  router.post("/brief", async (req, res) => {
    try {
      const { prompt, spec: lastSpec } = (req.body || {}) as any;
      const out = buildSpec({ prompt, lastSpec });
      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "brief_failed" });
    }
  });

  // ---------- /plan ----------
  router.post("/plan", async (req, res) => {
    try {
      const { spec, signals } = (req.body || {}) as any;
      const actions = nextActions(spec, signals);
      return res.json({ ok: true, actions });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "plan_failed" });
    }
  });

  // ---------- /filter ----------
  router.post("/filter", async (req, res) => {
    try {
      const { prompt = "" } = (req.body || {}) as any;
      const out = await filterIntent(prompt);
      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "filter_failed" });
    }
  });

  // ---------- /clarify ----------
  router.post("/clarify", (req, res) => {
    try {
      const { prompt = "", spec = {} } = (req.body || {}) as any;
      const chips = clarifyChips({ prompt, spec });
      return res.json({ ok: true, chips });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "clarify_failed" });
    }
  });

  // ---------- /clarify/compose (zero-LLM) ----------
  router.post("/clarify/compose", async (req, res) => {
    try {
      const { prompt = "", sessionId = "anon", spec: specIn = {} } = (req.body || {}) as any;

      // Base spec: use existing sections/mode if present, else no-LLM guess
      let base = { ...specIn, brand: { ...(specIn as any).brand || {} } };
      if (
        !Array.isArray((base as any)?.layout?.sections) ||
        !(base as any).layout.sections.length
      ) {
        const fit =
          pickFromPlaybook(prompt) ||
          quickGuessIntent(prompt) || {
            intent: {
              sections: ["hero-basic", "cta-simple"],
              color_scheme: /(^|\s)dark(\s|$)/i.test(String(prompt)) ? "dark" : "light",
              vibe: "minimal",
              audience: "",
            },
          };
        (base as any).layout = { sections: (fit as any).intent.sections };
        if ((base as any).brand.dark == null)
          (base as any).brand.dark = (fit as any).intent.color_scheme === "dark";
        if (!(base as any).brand.tone)
          (base as any).brand.tone =
            (fit as any).intent.vibe === "minimal" ? "minimal" : "serious";
        // propagate audience/intent for downstream personalization
        (base as any).intent = (fit as any).intent || {};
        (base as any).audience = (fit as any).intent?.audience || "";
      }

      // Get clarifier chips and apply them locally
      const chips = clarifyChips({ prompt, spec: base as any });
      let s: any = base;
      for (const c of (chips as any[])) s = applyChipLocal(s, c);

      // Compose using the existing budgeted pipeline
      let copy =
        s.copy ||
        cheapCopy(prompt, {
          vibe: s.brand?.tone || "minimal",
          color_scheme: s.brand?.dark ? "dark" : "light",
          sections: s.layout?.sections || ["hero-basic", "cta-simple"],
        });
      {
        const filled = fillSlots({ prompt, spec: s, copy });
        copy = (filled as any).copy;
      }
      const brandColor = guessBrand({
        vibe: s.brand?.tone || "minimal",
        color_scheme: s.brand?.dark ? "dark" : "light",
        sections: s.layout?.sections || ["hero-basic", "cta-simple"],
      });

      // Import inferAudience when needed
      const { inferAudience, childHeaders } = await import("./router.helpers.ts");
      
      // Set audience on s using prompt + copy before /act
      s.audience = inferAudience({ summary: prompt, intent: s.intent, copy });

      // retrieve → compose
      const retrieve = {
        kind: "retrieve",
        args: { sections: s.layout.sections, audience: String(s.audience || (s.intent?.audience ?? "")) },
      };
      const f3 = requireFetch();
      const actResR = await f3(`${baseUrl(req)}/api/ai/act`, {
        method: "POST",
        headers: childHeaders(req),
        body: JSON.stringify({ sessionId, spec: s, action: retrieve }),
      });
      const actData = await actResR.json();

      let url: string | null = null;
      let result = (actData as any)?.result;
      
      // Variant hints for bandits
      const VARIANT_HINTS: Record<string, string[]> = {
        "hero-basic": ["hero-basic", "hero-basic@b"],
        "features-3col": ["features-3col", "features-3col@alt"],
        "pricing-simple": ["pricing-simple", "pricing-simple@a"],
        "faq-accordion": ["faq-accordion", "faq-accordion@dense"],
      };

      if ((result as any)?.kind === "retrieve" && Array.isArray((result as any).sections)) {
        const composeAction = {
          kind: "compose",
          cost_est: 0,
          gain_est: 20,
          args: {
            sections: (result as any).sections,
            copy,
            brand: { primary: brandColor },
            variantHints: VARIANT_HINTS,
          },
        };
        const f4 = requireFetch();
        const composeR = await f4(`${baseUrl(req)}/api/ai/act`, {
          method: "POST",
          headers: childHeaders(req),
          body: JSON.stringify({
            sessionId,
            spec: { ...s, brandColor, copy },
            action: composeAction,
          }),
        });
        const composeData = await composeR.json();
        url =
          (composeData as any)?.result?.url ||
          (composeData as any)?.result?.path ||
          null;
        result = (composeData as any)?.result;
      }

      const sectionsUsed =
        (result as any)?.sections ||
        ((s as any)?.layout?.sections || []);

      const brandOut =
        (result as any)?.brand
          ? { ...(s as any).brand, ...(result as any).brand }
          : (s as any).brand;

      pushSignal(sessionId, {
        ts: Date.now(),
        kind: "clarify_compose",
        data: { chips },
      });
      
      try {
        if ((result as any)?.sup) {
          res.setHeader("X-SUP-Mode", String(((result as any).sup.mode) || ""));
          const reasons = Array.isArray((result as any).sup.reasons) ? (result as any).sup.reasons.join(",") : "";
          res.setHeader("X-SUP-Reasons", reasons);
        }
      } catch {}
      
      return res.json({
        ok: true,
        url,
        result,
        spec: { ...s, brand: brandOut, copy, brandColor, layout: { sections: sectionsUsed } },
        chips,
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "clarify_compose_failed" });
    }
  });

  // ---------- /signals ----------
  router.post("/signals", (req, res) => {
    const { sessionId = "anon", kind = "", data = {} } = (req.body || {}) as any;
    if (!kind) return res.status(400).json({ ok: false, error: "missing_kind" });
    pushSignal(sessionId, { ts: Date.now(), kind, data });
    return res.json({ ok: true });
  });

  router.get("/signals/:sessionId", (req, res) => {
    return res.json({ ok: true, summary: summarize(req.params.sessionId || "anon") });
  });

  // ---------- /build (ship + test) ----------
  router.post("/build", async (req, res) => {
    try {
      const { prompt = "", sessionId = "anon", autofix = false } = (req.body || {}) as any;
      if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });
      
      const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const { runBuilder } = await import("../intent/builder.ts");
      const out = await runBuilder({ prompt, sessionId, baseUrl: base, autofix });
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "build_failed" });
    }
  });

  // ---------- /army (20-plan orchestrator) ----------
  router.post("/army", async (req, res) => {
    try {
      const { prompt = "", sessionId = "anon", concurrency = 4 } = (req.body || {}) as any;
      if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });

      const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const { runArmy } = await import("./army.ts");
      const out = await runArmy({ prompt, sessionId, baseUrl: base, concurrency });
      return res.json({ ok: true, ...out });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: "army_failed" });
    }
  });
}
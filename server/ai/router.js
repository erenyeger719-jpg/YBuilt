// server/ai/router.js
import express from "express";
import { buildSpec } from "../intent/brief.ts";
import { nextActions } from "../intent/planner.ts";
import { runWithBudget } from "../intent/budget.ts";
import { filterIntent } from "../intent/filter.ts";
import { cheapCopy, guessBrand } from "../intent/copy.ts";
import { pushSignal, summarize, boostConfidence } from "../intent/signals.ts";
import {
  verifyAndPrepare,
  rememberLastGood,
  lastGoodFor,
  defaultsForSections,
  hardenCopy,
} from "../intent/dsl.ts";
import { cacheGet, cacheSet, normalizeKey } from "../intent/cache.ts";
import { pickFromPlaybook } from "../intent/playbook.ts";
import { clarifyChips } from "../intent/clarify.ts";
import { localLabels } from "../intent/localLabels.ts";
import { addExample, nearest } from "../intent/retrieval.ts";
import crypto from "crypto";

export function pickModel(task, tier = "balanced") {
  const map = {
    fast: {
      planner: { provider: "openai", model: "gpt-4o-mini" },
      coder: { provider: "openai", model: "gpt-4o-mini" },
      critic: { provider: "openai", model: "gpt-4o-mini" },
    },
    balanced: {
      planner: { provider: "openai", model: "gpt-4o-mini" },
      coder: { provider: "openai", model: "gpt-4o" },
      critic: { provider: "openai", model: "gpt-4o-mini" },
    },
    best: {
      planner: { provider: "openai", model: "gpt-4o" },
      coder: { provider: "openai", model: "gpt-4o" },
      critic: { provider: "openai", model: "gpt-4o" },
    },
  };
  const tierMap = map[tier] || map.balanced;
  return tierMap[task] || tierMap.coder;
}
export function pickTierByConfidence(c = 0.6) {
  if (c >= 0.8) return "fast";
  if (c >= 0.6) return "balanced";
  return "best";
}

const router = express.Router();

function extractJSON(s) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON in response");
  return s.slice(start, end + 1);
}

// ---------- helpers ----------
function baseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

async function fetchJSONWithTimeout(url, opts, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...(opts || {}), signal: ctrl.signal });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `HTTP_${r.status}`);
    return JSON.parse(txt);
  } finally {
    clearTimeout(id);
  }
}

// Very cheap intent guesser for common phrases (skips a model call a lot)
function quickGuessIntent(prompt) {
  const p = String(prompt || "").toLowerCase();

  const has = (w) => p.includes(w);
  const intent = {
    audience: has("dev")
      ? "developers"
      : has("founder")
      ? "founders"
      : has("shopper")
      ? "shoppers"
      : "",
    goal: has("waitlist")
      ? "waitlist"
      : has("demo")
      ? "demo"
      : has("buy") || has("purchase")
      ? "purchase"
      : has("contact")
      ? "contact"
      : "",
    industry: has("saas") ? "saas" : has("ecommerce") ? "ecommerce" : has("portfolio") ? "portfolio" : "",
    vibe: has("minimal") ? "minimal" : has("bold") ? "bold" : has("playful") ? "playful" : has("serious") ? "serious" : "",
    color_scheme: has("dark") ? "dark" : has("light") ? "light" : "",
    density: has("minimal") ? "minimal" : "",
    complexity: has("simple") ? "simple" : "",
    sections: ["hero-basic", "cta-simple"].concat(has("feature") ? ["features-3col"] : []),
  };

  const filled = Object.values({ ...intent, sections: null }).filter(Boolean).length;
  const coverage = filled / 7; // rough
  const chips = [
    intent.color_scheme !== "light" ? "Switch to light" : "Use dark mode",
    has("minimal") ? "More playful" : "More minimal", // ensures chips actually map to spec changes
    intent.goal === "waitlist" ? "Use email signup CTA" : "Use waitlist",
  ];

  return coverage >= 0.5 ? { intent, confidence: 0.7, chips } : null;
}

// Stable stringify (order-insensitive for objects)
function stableStringify(o) {
  if (Array.isArray(o)) return "[" + o.map(stableStringify).join(",") + "]";
  if (o && typeof o === "object") {
    return (
      "{" +
      Object.keys(o)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableStringify(o[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(o);
}

const LAST_COMPOSE = new Map(); // sessionId -> { key, url }
function dslKey(payload) {
  return sha1(stableStringify(payload));
}

// Apply chip locally (no LLM)
function applyChipLocal(spec = {}, chip = "") {
  const s = { ...spec, brand: { ...(spec.brand || {}) } };

  if (/Switch to light/i.test(chip)) s.brand.dark = false;
  if (/Use dark mode/i.test(chip)) s.brand.dark = true;

  if (/More minimal/i.test(chip) || /Keep it minimal/i.test(chip)) s.brand.tone = "minimal";
  if (/More playful/i.test(chip)) s.brand.tone = "playful";

  // style tier chips
  if (/Use premium style/i.test(chip)) s.brand.tier = "premium";
  if (/Use minimal style/i.test(chip)) s.brand.tier = "minimal";
  if (/Use playful style/i.test(chip)) s.brand.tier = "playful";
  if (/Use brutalist style/i.test(chip)) s.brand.tier = "brutalist";

  if (/Add 3-card features/i.test(chip)) {
    const cur = new Set((s.layout?.sections || []).map(String));
    cur.add("features-3col");
    s.layout = { sections: Array.from(cur) };
  }
  if (/Use 2-column features/i.test(chip)) {
    s.layout = { sections: (s.layout?.sections || []).filter((id) => id !== "features-3col") };
  }

  if (/Use email signup CTA/i.test(chip)) {
    s.copy = { ...(s.copy || {}), CTA_LABEL: "Get started", CTA_HEAD: "Ready when you are" };
  }
  if (/Use waitlist/i.test(chip)) {
    s.copy = { ...(s.copy || {}), CTA_LABEL: "Join the waitlist", CTA_HEAD: "Be first in line" };
  }
  return s;
}

// ---------- /review ----------
const LAST_REVIEW_SIG = new Map(); // sessionId -> last sha1(codeTrim)

router.post("/review", async (req, res) => {
  try {
    let { code = "", tier = "balanced", sessionId = "anon" } = req.body || {};
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

    const { provider, model } = pickModel("critic", tier);
    if (provider !== "openai") {
      return res
        .status(500)
        .json({ ok: false, error: `Provider ${provider} not configured in /ai/review` });
    }

    const payload = {
      model: model || process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      max_tokens: Number(process.env.OPENAI_REVIEW_MAXTOKENS || 600),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };

    // Timeout + JSON-mode fetch
    const data = await fetchJSONWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      Number(process.env.OPENAI_TIMEOUT_MS || 20000)
    );

    const raw = data?.choices?.[0]?.message?.content || "{}";
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = JSON.parse(extractJSON(raw));
    }

    const issues = Array.isArray(json.issues) ? json.issues : [];
    const cleaned = issues.map((it) => ({
      type: String(it.type || "other").slice(0, 40),
      msg: String(it.msg || "").slice(0, 500),
      fix: it.fix ? String(it.fix).slice(0, 4000) : undefined,
      ops: Array.isArray(it.ops)
        ? it.ops
            .filter((op) => ["index.html", "styles.css", "app.js"].includes(String(op.file)))
            .map((op) => ({
              file: String(op.file),
              find: String(op.find ?? ""),
              replace: String(op.replace ?? ""),
              isRegex: Boolean(op.isRegex),
            }))
        : [],
    }));

    LAST_REVIEW_SIG.set(sessionId, sig);
    return res.json({ ok: true, review: { issues: cleaned } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "review failed" });
  }
});

// ---------- brief / plan / filter ----------
router.post("/brief", async (req, res) => {
  try {
    const { prompt, spec: lastSpec } = req.body || {};
    const out = buildSpec({ prompt, lastSpec });
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "brief_failed" });
  }
});

router.post("/plan", async (req, res) => {
  try {
    const { spec, signals } = req.body || {};
    const actions = nextActions(spec, signals);
    return res.json({ ok: true, actions });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "plan_failed" });
  }
});

router.post("/filter", async (req, res) => {
  try {
    const { prompt = "" } = req.body || {};
    const out = await filterIntent(prompt);
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "filter_failed" });
  }
});

// POST /api/ai/clarify  { prompt?: string, spec?: {...} }
router.post("/clarify", (req, res) => {
  try {
    const { prompt = "", spec = {} } = req.body || {};
    const chips = clarifyChips({ prompt, spec });
    return res.json({ ok: true, chips });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "clarify_failed" });
  }
});

// ---------- signals ----------
router.post("/signals", (req, res) => {
  const { sessionId = "anon", kind = "", data = {} } = req.body || {};
  if (!kind) return res.status(400).json({ ok: false, error: "missing_kind" });
  pushSignal(sessionId, { ts: Date.now(), kind, data });
  return res.json({ ok: true });
});

router.get("/signals/:sessionId", (req, res) => {
  return res.json({ ok: true, summary: summarize(req.params.sessionId || "anon") });
});

// ---------- act ----------
router.post("/act", async (req, res) => {
  try {
    const { sessionId = "anon", spec = {}, action = {} } = req.body || {};
    if (!action || !action.kind)
      return res.status(400).json({ ok: false, error: "missing_action" });

    const out = await runWithBudget(sessionId, action, async (_tier) => {
      if (action.kind === "retrieve") {
        const sections = Array.isArray(action.args?.sections)
          ? action.args.sections
          : spec?.layout?.sections || [];
        return { kind: "retrieve", sections };
      }

      if (action.kind === "ask") {
        const { chips } = buildSpec({ lastSpec: spec });
        return { kind: "ask", chips };
      }

      if (action.kind === "patch") {
        const theme = action.args?.theme;
        const next = { ...spec };
        if (theme === "dark" || theme === "light") {
          next.brand = next.brand || {};
          next.brand.dark = theme === "dark";
        }
        return { kind: "patch", spec: next };
      }

      if (action.kind === "compose") {
        const sectionsIn = Array.isArray(action.args?.sections)
          ? action.args.sections
          : spec?.layout?.sections || [];
        const dark = !!spec?.brand?.dark;
        const title = String(spec?.summary || "Preview");

        const proposed = {
          sections: sectionsIn,
          copy: action.args?.copy || spec?.copy || {},
          brand: action.args?.brand || (spec?.brandColor ? { primary: spec.brandColor } : {}),
        };

        let prep = verifyAndPrepare(proposed);
        if (!prep.sections.length) {
          const prev = lastGoodFor(req.body?.sessionId || "anon");
          if (prev) prep = verifyAndPrepare(prev);
        }

        // build prepped copy with defaults and hygiene
        const copyWithDefaults = hardenCopy(prep.sections, {
          ...defaultsForSections(prep.sections),
          ...prep.copy,
        });

        // short-circuit if same DSL as last compose for session
        const payloadForKey = {
          sections: prep.sections,
          dark,
          title,
          copy: copyWithDefaults,
          brand: prep.brand,
          tier: spec?.brand?.tier || "premium",
        };
        const keyNow = dslKey(payloadForKey);
        const last = LAST_COMPOSE.get(req.body?.sessionId || "anon");
        if (last && last.key === keyNow && last.url) {
          return { kind: "compose", path: last.url, url: last.url };
        }

        const r = await fetch(`${baseUrl(req)}/api/previews/compose`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payloadForKey),
        });
        if (!r.ok) return { error: `compose_http_${r.status}` };
        const data = await r.json();

        // remember successful compose for instant reuse
        LAST_COMPOSE.set(req.body?.sessionId || "anon", {
          key: keyNow,
          url: data?.url || data?.path || null,
        });

        try {
          rememberLastGood(req.body?.sessionId || "anon", {
            sections: prep.sections,
            copy: copyWithDefaults,
            brand: prep.brand,
          });
          pushSignal(req.body?.sessionId || "anon", {
            ts: Date.now(),
            kind: "compose_success",
            data: { url: data?.url },
          });
          // store successful example for retrieval reuse
          try {
            await addExample(
              String(req.body?.sessionId || "anon"),
              String(spec?.summary || ""),
              { sections: prep.sections, copy: copyWithDefaults, brand: prep.brand }
            );
          } catch {}
        } catch {}

        return { kind: "compose", ...data };
      }

      return { error: `unknown_action:${action.kind}` };
    });

    return res.json({ ok: true, result: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "act_failed" });
  }
});

// ---------- one ----------
router.post("/one", async (req, res) => {
  try {
    const { prompt = "", sessionId = "anon" } = req.body || {};
    const key = normalizeKey(prompt);

    // 0) Playbook first (no-model)
    let fit = pickFromPlaybook(prompt);

    // 1) Cache / quick guess / local model / cloud
    if (!fit) {
      fit = cacheGet(key);
      if (!fit) {
        const guess = typeof quickGuessIntent === "function" ? quickGuessIntent(prompt) : null;
        if (guess) {
          fit = guess;
        } else {
          const lab = await localLabels(prompt); // free local model
          if (lab?.intent) {
            fit = {
              intent: {
                ...lab.intent,
                sections: lab.intent.sections?.length ? lab.intent.sections : ["hero-basic", "cta-simple"],
              },
              confidence: lab.confidence || 0.7,
              chips: clarifyChips({
                prompt,
                spec: {
                  brand: { dark: lab.intent.color_scheme === "dark" },
                  layout: { sections: lab.intent.sections || ["hero-basic", "cta-simple"] },
                },
              }),
            };
          } else {
            fit = await filterIntent(prompt); // cloud fallback as last resort
          }
        }
        cacheSet(key, fit);
      }
    }

    const { intent, confidence: c0, chips } = fit;
    const summarySignals = summarize(sessionId);
    const confidence = boostConfidence(c0, summarySignals);

    const { spec } = buildSpec({
      prompt,
      lastSpec: {
        summary: prompt,
        brand: {
          tone: intent.vibe === "playful" ? "playful" : intent.vibe === "minimal" ? "minimal" : "serious",
          dark: intent.color_scheme === "dark",
        },
        layout: { sections: intent.sections },
        confidence,
      },
    });

    let copy = fit.copy || cheapCopy(prompt, fit.intent);
    let brandColor = fit.brandColor || guessBrand(fit.intent);
    const actions = nextActions(spec, { chips });

    // Try to reuse a shipped spec (retrieval) before composing
    try {
      const reuse = await nearest(prompt);
      if (reuse) {
        const reusedSections =
          Array.isArray(reuse.sections) && reuse.sections.length
            ? reuse.sections
            : spec?.layout?.sections || [];
        spec.layout = { sections: reusedSections };
        const mergedCopy = { ...(reuse.copy || {}), ...(copy || {}) };
        copy = mergedCopy;
        if (!brandColor && reuse?.brand?.primary) brandColor = reuse.brand.primary;
      }
    } catch {}

    if (!actions.length) return res.json({ ok: true, spec, actions: [], note: "nothing_to_do" });

    const top = actions[0];
    const actResR = await fetch(`${baseUrl(req)}/api/ai/act`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, spec, action: top }),
    });
    const actData = await actResR.json();

    let url = null;
    let usedAction = top;
    let result = actData?.result;

    if (result?.kind === "retrieve" && Array.isArray(result.sections)) {
      const composeAction = {
        kind: "compose",
        cost_est: 3,
        gain_est: 20,
        args: { sections: result.sections, copy, brand: { primary: brandColor } },
      };
      const composeR = await fetch(`${baseUrl(req)}/api/ai/act`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          spec: { ...spec, brandColor, copy },
          action: composeAction,
        }),
      });
      const composeData = await composeR.json();
      url = composeData?.result?.url || composeData?.result?.path || null;
      usedAction = composeAction;
      result = composeData?.result;
    }

    return res.json({
      ok: true,
      spec: { ...spec, brandColor, copy },
      plan: actions,
      ran: usedAction,
      result,
      url,
      chips,
      signals: summarySignals,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "one_failed" });
  }
});

// ---------- instant (zero-LLM compose) ----------
router.post("/instant", async (req, res) => {
  try {
    const { prompt = "", sessionId = "anon" } = req.body || {};

    // 0) No-model intent: playbook → quick guess → safe defaults
    let fit = pickFromPlaybook(prompt) || quickGuessIntent(prompt);
    if (!fit) {
      const dark = /(^|\s)dark(\s|$)/i.test(String(prompt));
      const intent = {
        audience: "",
        goal: "waitlist",
        industry: "",
        vibe: "minimal",
        color_scheme: dark ? "dark" : "light",
        density: "minimal",
        complexity: "simple",
        sections: ["hero-basic", "cta-simple"],
      };
      const chips = clarifyChips({
        prompt,
        spec: { brand: { dark }, layout: { sections: intent.sections } },
      });
      fit = { intent, confidence: 0.6, chips };
    }

    const { intent, chips = [] } = fit;
    const summarySignals = summarize(sessionId);
    const confidence = boostConfidence(fit.confidence || 0.6, summarySignals);

    // Deterministic spec (no model)
    const { spec } = buildSpec({
      prompt,
      lastSpec: {
        summary: prompt,
        brand: {
          tone: intent.vibe === "playful" ? "playful" : intent.vibe === "minimal" ? "minimal" : "serious",
          dark: intent.color_scheme === "dark",
        },
        layout: { sections: intent.sections },
        confidence,
      },
    });

    // Deterministic copy/brand (no model)
    const copy = fit.copy || cheapCopy(prompt, intent);
    const brandColor = fit.brandColor || guessBrand(intent);

    // Always retrieve → compose
    const retrieve = { kind: "retrieve", args: { sections: intent.sections } };
    const actResR = await fetch(`${baseUrl(req)}/api/ai/act`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, spec, action: retrieve }),
    });
    const actData = await actResR.json();

    let url = null;
    let result = actData?.result;

    if (result?.kind === "retrieve" && Array.isArray(result.sections)) {
      const composeAction = {
        kind: "compose",
        cost_est: 0,
        gain_est: 20,
        args: { sections: result.sections, copy, brand: { primary: brandColor } },
      };
      const composeR = await fetch(`${baseUrl(req)}/api/ai/act`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          spec: { ...spec, brandColor, copy },
          action: composeAction,
        }),
      });
      const composeData = await composeR.json();
      url = composeData?.result?.url || composeData?.result?.path || null;
      result = composeData?.result;
    }

    return res.json({
      ok: true,
      source: "instant",
      spec: { ...spec, brandColor, copy },
      url,
      result,
      chips: chips.length ? chips : clarifyChips({ prompt, spec }),
      signals: summarySignals,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "instant_failed" });
  }
});

// ---------- clarify → apply → compose (zero-LLM) ----------
router.post("/clarify/compose", async (req, res) => {
  try {
    const { prompt = "", sessionId = "anon", spec: specIn = {} } = req.body || {};

    // Base spec: use existing sections/mode if present, else no-LLM guess
    let base = { ...specIn, brand: { ...(specIn.brand || {}) } };
    if (!Array.isArray(base?.layout?.sections) || !base.layout.sections.length) {
      const fit =
        pickFromPlaybook(prompt) ||
        quickGuessIntent(prompt) || {
          intent: {
            sections: ["hero-basic", "cta-simple"],
            color_scheme: /(^|\s)dark(\s|$)/i.test(String(prompt)) ? "dark" : "light",
            vibe: "minimal",
          },
        };
      base.layout = { sections: fit.intent.sections };
      if (base.brand.dark == null) base.brand.dark = fit.intent.color_scheme === "dark";
      if (!base.brand.tone) base.brand.tone = fit.intent.vibe === "minimal" ? "minimal" : "serious";
    }

    // Get clarifier chips and apply them locally
    const chips = clarifyChips({ prompt, spec: base });
    let s = base;
    for (const c of chips) s = applyChipLocal(s, c);

    // Compose using the existing budgeted pipeline
    const copy =
      s.copy ||
      cheapCopy(prompt, {
        vibe: s.brand?.tone || "minimal",
        color_scheme: s.brand?.dark ? "dark" : "light",
        sections: s.layout?.sections || ["hero-basic", "cta-simple"],
      });
    const brandColor = guessBrand({
      vibe: s.brand?.tone || "minimal",
      color_scheme: s.brand?.dark ? "dark" : "light",
      sections: s.layout?.sections || ["hero-basic", "cta-simple"],
    });

    // retrieve → compose
    const retrieve = { kind: "retrieve", args: { sections: s.layout.sections } };
    const actResR = await fetch(`${baseUrl(req)}/api/ai/act`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, spec: s, action: retrieve }),
    });
    const actData = await actResR.json();

    let url = null;
    let result = actData?.result;
    if (result?.kind === "retrieve" && Array.isArray(result.sections)) {
      const composeAction = {
        kind: "compose",
        cost_est: 0,
        gain_est: 20,
        args: { sections: result.sections, copy, brand: { primary: brandColor } },
      };
      const composeR = await fetch(`${baseUrl(req)}/api/ai/act`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          spec: { ...s, brandColor, copy },
          action: composeAction,
        }),
      });
      const composeData = await composeR.json();
      url = composeData?.result?.url || composeData?.result?.path || null;
      result = composeData?.result;
    }

    pushSignal(sessionId, { ts: Date.now(), kind: "clarify_compose", data: { chips } });
    return res.json({ ok: true, url, result, spec: { ...s, copy, brandColor }, chips });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "clarify_compose_failed" });
  }
});

// ---------- chips ----------
router.post("/chips/apply", (req, res) => {
  const { sessionId = "anon", spec = {}, chip = "" } = req.body || {};
  try {
    const s = applyChipLocal(spec, chip);
    pushSignal(sessionId, { ts: Date.now(), kind: "chip_apply", data: { chip } });
    return res.json({ ok: true, spec: s });
  } catch {
    return res.status(500).json({ ok: false, error: "chip_apply_failed" });
  }
});

export default router;

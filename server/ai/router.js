// server/ai/router.js
import express from "express";
import fs from "fs";
import { buildSpec } from "../intent/brief.ts";
import { nextActions } from "../intent/planner.ts";
import { runWithBudget } from "../intent/budget.ts";
import { filterIntent } from "../intent/filter.ts";
import { cheapCopy, guessBrand } from "../intent/copy.ts";
import { fillSlots } from "../intent/slots.ts";
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
import {
  decideLabelPath,
  outcomeLabelPath,
  allowCloud,
  pickExpertFor,
  recordExpertOutcome,
} from "../intent/router.brain.ts";
import { expertByKey, expertsForTask } from "../intent/experts.ts";
import { queueShadowEval } from "../intent/shadowEval.ts";
import { runBuilder } from "../intent/builder.ts";
import { generateMedia } from "../media/pool.ts";
import { synthesizeAssets } from "../intent/assets.ts";
import { tokenMixer } from "../design/tokens.ts";
import { buildGrid } from "../design/grid.ts";
import { evaluateDesign } from "../design/score.ts";
import { motionVars } from "../design/motion.ts";
import { sanitizeFacts } from "../intent/citelock.ts";
import { searchBestTokensCached as searchBestTokens } from "../design/search.memo.ts";
import { recordShip, markConversion, kpiSummary, lastShipFor } from "../metrics/outcome.ts";
import { pickVariant, recordSectionOutcome, seedVariants } from "../sections/bandits.ts";
import { buildProof } from "../intent/citelock.pro.ts";
import { checkPerfBudget, downgradeSections, shouldStripJS } from "../perf/budgets.ts";
import { buildSEO } from "../seo/og.ts";
import { suggestFromDNA, recordDNA, learnFromChip } from "../brand/dna.ts";
import { tokenBiasFor, recordTokenWin, recordTokenSeen, retrainTasteNet, maybeNightlyRetrain } from "../design/outcome.priors.ts";
import { quickLayoutSanity, quickPerfEst, matrixPerfEst } from "../qa/layout.sanity.ts";
import { checkCopyReadability } from "../qa/readability.guard.ts";
import { addEvidence, rebuildEvidenceIndex, searchEvidence as _searchEvidence } from "../intent/evidence.ts";
import crypto from "crypto";

// Nightly TasteNet retrain (best-effort, no-op if not due)
try { maybeNightlyRetrain(); } catch {}

// --- SUP ALGO: tiny metrics stores ---
const CACHE_DIR = ".cache";
function ensureCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}
function loadJSON(p, def) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return def;
  }
}
function saveJSON(p, obj) {
  try {
    ensureCache();
    fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  } catch {}
}

const FILE_RETR = ".cache/retrieval.hits.json"; // {tries:number, hits:number}
const FILE_TTU = ".cache/time_to_url.json"; // {ema_ms:number, n:number}
const FILE_EDITS_SESS = ".cache/edits.sessions.json"; // { [sessionId]: number }
const FILE_EDITS_METR = ".cache/edits.metrics.json"; // {ema:number, n:number}

// --- Economic flywheel: cents/tokens per URL ---
const FILE_URLCOST = ".cache/url.costs.json";
function recordUrlCost(pageId, addCents = 0, addTokens = 0) {
  if (!pageId) return;
  const s = loadJSON(FILE_URLCOST, {});
  const cur = s[pageId] || { cents: 0, tokens: 0, ts: Date.now() };
  cur.cents = Number((cur.cents + (addCents || 0)).toFixed(4));
  cur.tokens = (cur.tokens || 0) + (addTokens || 0);
  cur.ts = Date.now();
  s[pageId] = cur;
  saveJSON(FILE_URLCOST, s);
}

function retrMark(hit) {
  const s = loadJSON(FILE_RETR, { tries: 0, hits: 0 });
  s.tries += 1;
  if (hit) s.hits += 1;
  saveJSON(FILE_RETR, s);
}
function ema(prev, x, a = 0.25) {
  return prev == null ? x : (1 - a) * prev + a * x;
}
function recordTTU(ms) {
  const s = loadJSON(FILE_TTU, { ema_ms: null, n: 0 });
  s.ema_ms = ema(s.ema_ms, ms);
  s.n = (s.n || 0) + 1;
  saveJSON(FILE_TTU, s);
}
function editsInc(sessionId) {
  const s = loadJSON(FILE_EDITS_SESS, {});
  s[sessionId] = (s[sessionId] || 0) + 1;
  saveJSON(FILE_EDITS_SESS, s);
}
function editsTakeAndReset(sessionId) {
  const s = loadJSON(FILE_EDITS_SESS, {});
  const k = s[sessionId] || 0;
  s[sessionId] = 0;
  saveJSON(FILE_EDITS_SESS, s);
  return k;
}
function recordEditsMetric(k) {
  const m = loadJSON(FILE_EDITS_METR, { ema: null, n: 0 });
  m.ema = ema(m.ema, k);
  m.n = (m.n || 0) + 1;
  saveJSON(FILE_EDITS_METR, m);
}

// Variant hints to seed bandits (discovery)
const VARIANT_HINTS = {
  "hero-basic": ["hero-basic", "hero-basic@b"],
  "features-3col": ["features-3col", "features-3col@alt"],
  "pricing-simple": ["pricing-simple", "pricing-simple@a"],
  "faq-accordion": ["faq-accordion", "faq-accordion@dense"],
};

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

async function fetchTextWithTimeout(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return await r.text();
  } finally {
    clearTimeout(id);
  }
}

// near-consensus helpers for review
function issuesKeyset(issues = []) {
  return new Set(
    issues.map((i) =>
      `${String(i.type || "")}|${i?.ops?.[0]?.file || ""}|${i?.ops?.[0]?.find || ""}`.slice(0, 200)
    )
  );
}
function jaccard(aSet, bSet) {
  const a = new Set(aSet),
    b = new Set(bSet);
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter || 1;
  return inter / union;
}

// Personalization without creep: 1–2 section swaps max
function segmentSwapSections(ids = [], audience = "all") {
  const set = new Set((ids || []).map(String));
  if (audience === "developers") {
    set.add("features-3col");         // add 3-card features
    set.delete("pricing-simple");     // keep page quieter
  } else if (audience === "founders") {
    set.add("pricing-simple");        // show pricing early
  } else if (audience === "shoppers") {
    set.add("features-3col");
  }
  return Array.from(set);
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
    has("minimal") ? "More playful" : "More minimal",
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

    async function runCritic(exp) {
      const t0 = Date.now();
      const payload = {
        model: exp.model,
        temperature: 0,
        max_tokens: Number(process.env.OPENAI_REVIEW_MAXTOKENS || 600),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      };

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

    const cleaned = (issues || []).map((it) => ({
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
    return res.status(500).json({ ok: false, error: e?.message || "review_failed" });
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

// ---------- build (ship + test) ----------
router.post("/build", async (req, res) => {
  try {
    const { prompt = "", sessionId = "anon", autofix = false } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });
    const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const out = await runBuilder({ prompt, sessionId, baseUrl: base, autofix });
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "build_failed" });
  }
});

// ---------- media (vector-first) ----------
router.post("/media", async (req, res) => {
  try {
    const {
      kind = "illustration",
      prompt = "",
      brand = {},
      prefer = "vector",
      width,
      height,
      sessionId = "anon",
    } = req.body || {};
    const { asset, cached } = await generateMedia({
      kind,
      prompt,
      brand,
      prefer,
      width,
      height,
      sessionId,
    });
    return res.json({ ok: true, asset, cached });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "media_failed" });
  }
});

// --- Evidence admin (CiteLock-Pro) ---
router.post("/evidence/add", (req, res) => {
  try {
    const { id, url, title, text = "" } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: "missing_text" });
    const out = addEvidence({ id, url, title, text });
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "evidence_add_failed" });
  }
});

router.post("/evidence/reindex", (_req, res) => {
  try {
    return res.json({ ok: true, ...rebuildEvidenceIndex() });
  } catch {
    return res.status(500).json({ ok: false, error: "evidence_reindex_failed" });
  }
});

// optional: quick search for debugging
router.get("/evidence/search", (req, res) => {
  try {
    const q = String(req.query.q || "");
    return res.json({ ok: true, q, hits: _searchEvidence(q, 5) });
  } catch {
    return res.status(500).json({ ok: false, error: "evidence_search_failed" });
  }
});

// --- TasteNet-lite admin ---
router.post("/taste/retrain", (_req, res) => {
  try {
    const out = retrainTasteNet(1, 3);
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "taste_retrain_failed" });
  }
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

        // Bandit audience key derived from intent/spec
        const intentFromSpec = spec?.intent || {};
        const audienceKey = String(spec?.audience || intentFromSpec?.audience || "all");

        // Personalize sections slightly based on audience (non-creepy, bounded)
        const sectionsPersonal = segmentSwapSections(sectionsIn, audienceKey);

        // Optional: seed bandit pool with sibling variants when provided
        try {
          const hints = action.args?.variantHints;
          if (hints && typeof hints === "object") {
            for (const id of sectionsIn) {
              const base = String(id).split("@")[0];
              const siblings = Array.isArray(hints[base]) ? hints[base] : [];
              if (siblings.length) seedVariants(base, audienceKey, siblings);
            }
          }
        } catch {}

        // Bandit: pick section variants per audience (safe no-op if none)
        const banditSections = sectionsPersonal.map((id) => pickVariant(id, audienceKey));

        const dark = !!spec?.brand?.dark;
        const title = String(spec?.summary || "Preview");

        const proposed = {
          sections: banditSections,
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

        // ⬇️ NEW: synthesize vector assets, merge into copy (non-destructive)
        try {
          const { copyPatch } = await synthesizeAssets({
            spec: {
              summary: spec?.summary,
              brand: { ...(spec?.brand || {}), primary: spec?.brandColor || spec?.brand?.primary },
              brandColor: spec?.brandColor,
              layout: { sections: prep.sections },
              copy: copyWithDefaults,
            },
          });
          Object.assign(copyWithDefaults, copyPatch);
        } catch {}

        // Keep designer context accessible for later KPI record
        let tokens;
        let toneIn;
        let darkIn;

        // --- DESIGNER AI: tokens + grid + checks ---
        try {
          const bias = tokenBiasFor(String(req.body?.sessionId || "anon"));

          const primaryIn =
            spec?.brandColor ||
            spec?.brand?.primary ||
            bias.primary ||
            "#6d28d9";

          toneIn =
            spec?.brand?.tone ||
            bias.tone ||
            "serious";

          darkIn =
            (spec?.brand?.dark ?? (typeof bias.dark === "boolean" ? bias.dark : false));

          // 1) Tokens & grid (search best first)
          const { best: bestTokens } = searchBestTokens({
            primary: primaryIn,
            dark: darkIn,
            tone: toneIn,
            goal: intentFromSpec.goal || "",
            industry: intentFromSpec.industry || "",
          });
          tokens = bestTokens;
          const grid = buildGrid({ density: toneIn === "minimal" ? "minimal" : "normal" });

          // 2) Evaluate
          let eval1 = evaluateDesign(tokens);

          // 3) One self-fix if a11y fails: darken on-primary or bump base size
          if (!eval1.a11yPass) {
            const saferTone = toneIn === "playful" ? "minimal" : toneIn;
            tokens = tokenMixer({ primary: primaryIn, dark: darkIn, tone: saferTone });
            if (tokens.type?.basePx < 18) {
              tokens = tokenMixer({ primary: primaryIn, dark: darkIn, tone: "minimal" });
            }
            eval1 = evaluateDesign(tokens);
          }

          // attach to brand (composer can read css vars; harmless if ignored)
          prep.brand = {
            ...(prep.brand || {}),
            primary: tokens.palette.primary,
            tokens: tokens.cssVars,
            grid: grid.cssVars,
          };

          // Optional soft gate: if visual score still low, add a gentle signal
          if (eval1.visualScore < 65) {
            try {
              pushSignal(req.body?.sessionId || "anon", {
                ts: Date.now(),
                kind: "design_warn",
                data: { visual: eval1.visualScore },
              });
            } catch {}
          }
        } catch {}

        // attach motion tokens too (pure CSS vars, zero-LLM)
        try {
          const toneForMotion = spec?.brand?.tone || "serious";
          const motion = motionVars(toneForMotion);
          prep.brand = { ...(prep.brand || {}), motion: motion.cssVars };
        } catch {}

        // Perf governor (lite): downgrade if over cap, then signal
        try {
          const pg = checkPerfBudget(prep.sections);
          if (!pg.ok) {
            const before = prep.sections.slice();
            prep.sections = downgradeSections(prep.sections);
            pushSignal(req.body?.sessionId || "anon", {
              ts: Date.now(),
              kind: "perf_downgrade",
              data: { before, after: prep.sections, overBy: pg.overBy },
            });
          }
        } catch {}

        // OG / social meta from tokens + copy
        try {
          const meta = buildSEO({
            title,
            description: copyWithDefaults?.HERO_SUBHEAD || copyWithDefaults?.TAGLINE || "",
            brand: prep.brand,
            url: null,
          });
          prep.brand = { ...(prep.brand || {}), meta }; // harmless if composer ignores it
        } catch {}

        // CiteLock-Pro (local evidence) — annotate copy and keep a proof map
        let proofData = null;
        try {
          const pr = buildProof(copyWithDefaults);
          Object.assign(copyWithDefaults, pr.copyPatch);
          proofData = pr.proof;
        } catch {}

        // CiteLock-lite: neutralize risky claims unless there's a source
        let flags = [];
        try {
          const { copyPatch: factPatch, flags: _flags } = sanitizeFacts(copyWithDefaults);
          Object.assign(copyWithDefaults, factPatch);
          flags = _flags || [];
          if (flags.length) {
            try {
              pushSignal(req.body?.sessionId || "anon", {
                ts: Date.now(),
                kind: "fact_sanitized",
                data: { fields: flags.slice(0, 6) },
              });
            } catch {}
          }
        } catch {}

        // 🟡 Uncertainty Loopback (auto-chip on low proof/readability)
        try {
          const redactedCount = Object.values(proofData || {}).filter(p => p.status === "redacted").length;
          const readabilityLow = false; // flip to true if your readability score falls below threshold
          const needSoften = redactedCount > 0 || readabilityLow;

          if (needSoften) {
            const soft = applyChipLocal(
              { brand: prep.brand, layout: { sections: prep.sections }, copy: copyWithDefaults },
              "More minimal"
            );
            prep.brand = soft.brand;
            prep.sections = soft.layout.sections;
            Object.assign(copyWithDefaults, soft.copy || {});
          }

          // If goal is empty, prefer an email signup CTA
          try {
            if (!intentFromSpec.goal) {
              const softCTA = applyChipLocal(
                { brand: prep.brand, layout: { sections: prep.sections }, copy: copyWithDefaults },
                "Use email signup CTA"
              );
              prep.brand = softCTA.brand;
              prep.sections = softCTA.layout.sections;
              Object.assign(copyWithDefaults, softCTA.copy || {});
            }
          } catch {}
        } catch {}

        // ProofGate-Lite: soft warning + stronger neutralization for critical fields
        try {
          const redactedCount = Object.values(proofData || {}).filter((p) => p.status === "redacted").length;
          const evidencedCount = Object.values(proofData || {}).filter((p) => p.status === "evidenced").length;
          const flaggedCount = (flags || []).length; // from sanitizeFacts

          // 1) emit a soft signal so UI can badge it
          if (redactedCount || flaggedCount) {
            pushSignal(String(req.body?.sessionId || "anon"), {
              ts: Date.now(),
              kind: "proof_warn",
              data: { redactedCount, evidencedCount, flaggedCount },
            });
          }

          // 2) stronger neutralization for headline/subhead/tagline when any redaction happened
          if (redactedCount > 0) {
            const CRIT = ["HEADLINE", "HERO_SUBHEAD", "TAGLINE"];
            for (const k of CRIT) {
              const val = copyWithDefaults[k];
              if (typeof val !== "string") continue;
              let nv = val;

              // strip "(ref: ...)" unless actually evidenced for that field
              if (proofData?.[k]?.status !== "evidenced") {
                nv = nv.replace(/\s*\(ref:\s*[^)]+\)\s*$/i, "");
              }

              // extra softening on superlatives and naked %/x
              nv = nv
                .replace(/\b(#1|No\.?\s?1|top|best|leading|largest)\b/gi, "trusted")
                .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(%|percent)\b/gi, "many")
                .replace(/\b\d+(?:\.\d+)?\s*x\b/gi, "multi-fold");

              copyWithDefaults[k] = nv;
            }
          }

          // 3) expose per-field proof map for UI (non-breaking)
          const fieldCounts = {};
          if (proofData) {
            for (const v of Object.values(proofData)) {
              fieldCounts[v.status] = (fieldCounts[v.status] || 0) + 1;
            }
          }
          prep.brand = {
            ...(prep.brand || {}),
            proof: { fields: proofData || {}, counts: fieldCounts },
          };
        } catch {}

        // Readability guard (non-blocking) — run after ProofGate-Lite
        try {
          const r = checkCopyReadability(copyWithDefaults);
          if (r.issues.length) {
            pushSignal(String(req.body?.sessionId || "anon"), {
              ts: Date.now(),
              kind: "readability_warn",
              data: { score: r.score, issues: r.issues.slice(0, 6) },
            });
          }
        } catch {}

        // Decide whether to strip all <script> tags in composer
        const stripJS = shouldStripJS(prep.sections);

        // short-circuit if same DSL as last compose for session
        const payloadForKey = {
          sections: prep.sections,
          dark,
          title,
          copy: copyWithDefaults,
          brand: prep.brand,
          tier: spec?.brand?.tier || "premium",
          stripJS, // pass through to composer
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

        // holders for performance signals
        let perfEst = null;      // worst-case for gating/logging
        let perfMatrix = null;   // full matrix for Proof Card

        // quick device sanity ping (non-blocking)
        try {
          const pageUrl = data?.url || data?.path || null;
          if (pageUrl) {
            const abs = /^https?:\/\//i.test(pageUrl) ? pageUrl : `${baseUrl(req)}${pageUrl}`;
            const html = await fetchTextWithTimeout(abs, 8000);
            if (html) {
              const sanity = quickLayoutSanity(html);
              if (sanity.issues.length) {
                pushSignal(String(req.body?.sessionId || "anon"), {
                  ts: Date.now(),
                  kind: "layout_warn",
                  data: { score: sanity.score, issues: sanity.issues.slice(0, 6) },
                });
              }
              try {
                const basePerf = quickPerfEst(html);
                perfMatrix = matrixPerfEst(html);
                perfEst = perfMatrix?.worst || basePerf;

                // quick worst-case estimate
                pushSignal(String(req.body?.sessionId || "anon"), {
                  ts: Date.now(),
                  kind: "perf_est",
                  data: { cls_est: perfEst.cls_est, lcp_est_ms: perfEst.lcp_est_ms }
                });
                // full matrix detail
                pushSignal(String(req.body?.sessionId || "anon"), {
                  ts: Date.now(),
                  kind: "perf_matrix",
                  data: perfMatrix
                });
              } catch {}
            }
          }
        } catch {}

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
            await addExample(String(req.body?.sessionId || "anon"), String(spec?.summary || ""), {
              sections: prep.sections,
              copy: copyWithDefaults,
              brand: prep.brand,
            });
          } catch {}
          // Learn from ships (brand DNA)
          try {
            recordDNA(String(req.body?.sessionId || "anon"), {
              brand: { primary: prep.brand?.primary, tone: spec?.brand?.tone, dark: !!spec?.brand?.dark },
              sections: prep.sections,
            });
          } catch {}
        } catch {}

        // Record ship KPI snapshot (best-effort, resilient if tokens are missing)
        try {
          const ev2 = tokens ? evaluateDesign(tokens) : { a11yPass: null, visualScore: null };
          const primaryForBrand =
            (tokens && tokens.palette && tokens.palette.primary) ||
            spec?.brandColor ||
            spec?.brand?.primary ||
            null;

          // NEW: log a neutral "seen" with metrics for TasteNet gating (worst-case perf)
          try {
            recordTokenSeen({
              brand: { primary: primaryForBrand, tone: toneIn, dark: darkIn },
              sessionId: String(req.body?.sessionId || "anon"),
              metrics: { a11y: !!ev2.a11yPass, cls: perfEst?.cls_est, lcp_ms: perfEst?.lcp_est_ms },
            });
          } catch {}

          recordShip({
            ts: Date.now(),
            pageId: keyNow,
            url: data?.url || null,
            sections: prep.sections,
            brand: { primary: primaryForBrand, tone: toneIn, dark: darkIn },
            scores: {
              visual: ev2.visualScore ?? null,
              a11y: ev2.a11yPass ?? null,
              bytes: null,
            },
            sessionId: String(req.body?.sessionId || "anon"),
          });
        } catch {}

        // Persist a tiny Proof Card (best-effort) with counts and proof_ok
        try {
          const proofDir = ".cache/proof";
          fs.mkdirSync(proofDir, { recursive: true });
          const evPC = tokens ? evaluateDesign(tokens) : { a11yPass: null, visualScore: null };
          const counts = {};
          if (proofData) {
            for (const v of Object.values(proofData)) {
              counts[v.status] = (counts[v.status] || 0) + 1;
            }
          }
          const proof_ok = !Object.values(proofData || {}).some((p) => p.status === "redacted");

          fs.writeFileSync(
            `${proofDir}/${keyNow}.json`,
            JSON.stringify(
              {
                pageId: keyNow,
                url: data?.url || null,
                a11y: evPC.a11yPass,
                visual: evPC.visualScore,
                facts: proofData || {},
                fact_counts: counts,
                proof_ok,
                cls_est: perfEst?.cls_est ?? null,
                lcp_est_ms: perfEst?.lcp_est_ms ?? null,
                // NEW: persist full matrix
                perf_matrix: perfMatrix || null
              },
              null,
              2
            )
          );
        } catch {}

        // edits_to_ship: count chip applies since last ship
        try {
          const sid = String(req.body?.sessionId || "anon");
          const edits = editsTakeAndReset(sid);
          recordEditsMetric(edits);
        } catch {}

        // return pageId so client can hit KPIs/Proof directly
        return { kind: "compose", pageId: keyNow, ...data };
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
    const t0 = Date.now(); // full request -> URL timer
    const { prompt = "", sessionId = "anon" } = req.body || {};
    const key = normalizeKey(prompt);

    // [BANDIT] vars for logging outcome
    let labelPath = "rules"; // "rules" | "local" | "cloud"
    let cloudUsed = false;
    const startedAt = Date.now();

    // 0) Playbook first (no-model)
    let fit = pickFromPlaybook(prompt);

    // 1) Cache / quick guess / local model / cloud
    if (!fit) {
      fit = cacheGet(key);
      if (!fit) {
        // quick cheap heuristic still first
        const guess = typeof quickGuessIntent === "function" ? quickGuessIntent(prompt) : null;
        if (guess) {
          fit = guess;
          labelPath = "rules";
        } else {
          // [BANDIT] pick labeler path (local vs cloud)
          labelPath = decideLabelPath();
          if (labelPath === "local") {
            const lab = await localLabels(prompt); // free
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
            }
          }
          if (!fit) {
            // cloud fallback only if within budget
            if (allowCloud({ cents: 0.03, tokens: 1200 })) {
              fit = await filterIntent(prompt);
              cloudUsed = true;
              labelPath = "cloud";
            } else {
              // final safe default
              const dark = /(^|\s)dark(\s|$)/i.test(String(prompt));
              fit = {
                intent: {
                  goal: "waitlist",
                  vibe: "minimal",
                  color_scheme: dark ? "dark" : "light",
                  sections: ["hero-basic", "cta-simple"],
                },
                confidence: 0.55,
                chips: clarifyChips({
                  prompt,
                  spec: { brand: { dark }, layout: { sections: ["hero-basic", "cta-simple"] } },
                }),
              };
              labelPath = "rules";
            }
          }
        }
        cacheSet(key, fit);
      }
    }

    // Apply priors from brand DNA (soft influence)
    const prior = suggestFromDNA(sessionId) || {};
    if (!fit.intent) fit.intent = {};
    if (prior.brand?.tone && !fit.intent.vibe) fit.intent.vibe = prior.brand.tone;
    if (typeof prior.brand?.dark === "boolean" && !fit.intent.color_scheme) {
      fit.intent.color_scheme = prior.brand.dark ? "dark" : "light";
    }
    if (Array.isArray(prior.sections) && prior.sections.length) {
      const cur = new Set(fit.intent.sections || []);
      for (const s of prior.sections) cur.add(s);
      fit.intent.sections = Array.from(cur);
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
    let brandColor = prior?.brand?.primary || fit.brandColor || guessBrand(fit.intent);
    // Slot Synthesis v1 — fill any missing copy keys deterministically
    {
      const filled = fillSlots({ prompt, spec, copy });
      copy = filled.copy;
      // optional: filled.filled contains which keys were added
    }
    const actions = nextActions(spec, { chips });

    // Try to reuse a shipped spec (retrieval) before composing
    try {
      const reuse = await nearest(prompt);
      retrMark(Boolean(reuse));
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
        args: {
          sections: result.sections,
          copy,
          brand: { primary: brandColor },
          variantHints: VARIANT_HINTS,
        },
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

      // Economic flywheel: attribute estimated labeler cost to this URL
      try {
        const pageId = composeData?.result?.pageId;
        if (pageId) {
          const estCents = cloudUsed ? 0.03 : 0;
          const estTokens = cloudUsed ? 1200 : 0;
          recordUrlCost(pageId, estCents, estTokens);
        }
      } catch {}
    }

    // enqueue a shadow evaluation with what we actually shipped
    try {
      const finalSpec = { ...spec, brandColor, copy }; // what you ship
      queueShadowEval({ prompt, spec: finalSpec, sessionId });
    } catch {}

    const payload = {
      ok: true,
      spec: { ...spec, brandColor, copy },
      plan: actions,
      ran: usedAction,
      result,
      url,
      chips,
      signals: summarySignals,
    };

    // [BANDIT] mark success with real timing + path
    try {
      const shipped = Boolean(url);
      outcomeLabelPath(labelPath, {
        startedAt,
        cloudUsed,
        tokens: cloudUsed ? 1200 : 0,
        cents: cloudUsed ? 0.03 : 0,
        shipped,
      });
    } catch {}

    // record full request -> URL time
    try {
      recordTTU(Date.now() - t0);
    } catch {}

    return res.json(payload);
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

    // Apply priors from brand DNA (soft influence)
    const prior = suggestFromDNA(sessionId) || {};
    if (!fit.intent) fit.intent = {};
    if (prior.brand?.tone && !fit.intent.vibe) fit.intent.vibe = prior.brand.tone;
    if (typeof prior.brand?.dark === "boolean" && !fit.intent.color_scheme) {
      fit.intent.color_scheme = prior.brand.dark ? "dark" : "light";
    }
    if (Array.isArray(prior.sections) && prior.sections.length) {
      const cur = new Set(fit.intent.sections || []);
      for (const s of prior.sections) cur.add(s);
      fit.intent.sections = Array.from(cur);
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
          tone:
            intent.vibe === "playful"
              ? "playful"
              : intent.vibe === "minimal"
              ? "minimal"
              : "serious",
          dark: intent.color_scheme === "dark",
        },
        layout: { sections: intent.sections },
        confidence,
      },
    });

    // Deterministic copy/brand (no model)
    let copy = fit.copy || cheapCopy(prompt, intent);
    const brandColor = prior?.brand?.primary || fit.brandColor || guessBrand(intent);
    {
      const filled = fillSlots({ prompt, spec, copy });
      copy = filled.copy;
    }

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
        args: {
          sections: result.sections,
          copy,
          brand: { primary: brandColor },
          variantHints: VARIANT_HINTS,
        },
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
    let copy =
      s.copy ||
      cheapCopy(prompt, {
        vibe: s.brand?.tone || "minimal",
        color_scheme: s.brand?.dark ? "dark" : "light",
        sections: s.layout?.sections || ["hero-basic", "cta-simple"],
      });
    {
      const filled = fillSlots({ prompt, spec: s, copy });
      copy = filled.copy;
    }
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
        args: {
          sections: result.sections,
          copy,
          brand: { primary: brandColor },
          variantHints: VARIANT_HINTS,
        },
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
    try {
      editsInc(String(sessionId));
    } catch {}
    const s = applyChipLocal(spec, chip);
    pushSignal(sessionId, { ts: Date.now(), kind: "chip_apply", data: { chip } });
    try {
      learnFromChip(String(sessionId), String(chip || ""));
    } catch {}
    return res.json({ ok: true, spec: s });
  } catch {
    return res.status(500).json({ ok: false, error: "chip_apply_failed" });
  }
});

// --- seed retrieval with a few good examples (one-shot) ---
router.post("/seed", async (req, res) => {
  try {
    const seeds = [
      { prompt: "dark saas waitlist for founders", sections: ["hero-basic", "cta-simple"] },
      { prompt: "light portfolio landing designer", sections: ["hero-basic", "features-3col", "cta-simple"] },
      { prompt: "ecommerce product launch page", sections: ["hero-basic", "features-3col", "cta-simple"] },
      { prompt: "pricing page for startup", sections: ["hero-basic", "pricing-simple", "cta-simple"] },
      { prompt: "faq page for web app", sections: ["hero-basic", "faq-accordion", "cta-simple"] },
    ];

    for (const s of seeds) {
      const copy = cheapCopy(s.prompt, { vibe: "minimal", color_scheme: "light", sections: s.sections });
      await addExample("seed", s.prompt, { sections: s.sections, copy, brand: { primary: "#6d28d9" } });
    }
    return res.json({ ok: true, added: seeds.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "seed_failed" });
  }
});

// --- lightweight metrics snapshot ---
router.get("/metrics", (req, res) => {
  try {
    const statsPath = pathResolve(".cache/router.stats.json");
    const retrPath = FILE_RETR;
    const ttuPath = FILE_TTU;
    const editsPath = FILE_EDITS_METR;

    const stats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, "utf8")) : {};
    const nRules = stats?.rules?.n || 0;
    const nLocal = stats?.local?.n || 0;
    const nCloud = stats?.cloud?.n || 0;
    const total = Math.max(1, nRules + nLocal + nCloud);

    const cloud_pct = Math.round((nCloud / total) * 100);

    const retr = loadJSON(retrPath, { tries: 0, hits: 0 });
    const hit_rate = retr.tries ? Math.round((retr.hits / retr.tries) * 100) : 0;

    const ttu = loadJSON(ttuPath, { ema_ms: null });
    const ttu_ms = ttu.ema_ms != null ? Math.round(ttu.ema_ms) : null;

    const edits = loadJSON(editsPath, { ema: null });
    const edits_est = edits.ema != null ? Number(edits.ema.toFixed(2)) : null;

    // Retrieval DB size (lines) stays as a quick sanity
    const retrDbPath = pathResolve(".cache/retrieval.jsonl");
    const retrievalLines = fs.existsSync(retrDbPath)
      ? fs.readFileSync(retrDbPath, "utf8").split(/\r?\n/).filter(Boolean).length
      : 0;

    // shadow eval metric
    const shadowPath = pathResolve(".cache/shadow.metrics.json");
    let shadow_agreement_pct = null;
    try {
      if (fs.existsSync(shadowPath)) {
        const sm = JSON.parse(fs.readFileSync(shadowPath, "utf8"));
        const pct = sm.n ? Math.round(((sm.pass || 0) / sm.n) * 100) : null;
        shadow_agreement_pct = pct;
      }
    } catch {}

    // url cost summary
    const costDbPath = pathResolve(".cache/url.costs.json");
    let total_cents = 0,
      total_tokens = 0,
      pages_costed = 0;
    try {
      if (fs.existsSync(costDbPath)) {
        const m = JSON.parse(fs.readFileSync(costDbPath, "utf8"));
        for (const v of Object.values(m)) {
          total_cents += Number(v.cents || 0);
          total_tokens += Number(v.tokens || 0);
          pages_costed += 1;
        }
      }
    } catch {}

    // taste top keys (if trained)
    let taste_top = null;
    try {
      const t = JSON.parse(fs.readFileSync(pathResolve(".cache/taste.priors.json"), "utf8"));
      taste_top = Array.isArray(t?.top) ? t.top.slice(0, 5) : null;
    } catch {}

    return res.json({
      ok: true,
      counts: { rules: nRules, local: nLocal, cloud: nCloud, total },
      cloud_pct,
      time_to_url_ms_est: ttu_ms,
      retrieval_hit_rate_pct: hit_rate,
      edits_to_ship_est: edits_est,
      retrieval_db: retrievalLines,
      shadow_agreement_pct, // <— added
      url_costs: {
        pages: pages_costed,
        cents_total: Number(total_cents.toFixed(4)),
        tokens_total: total_tokens,
      },
      taste_top, // may be null if not trained yet
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "metrics_failed" });
  }
});

// --- KPI hooks ---
router.post("/kpi/convert", (req, res) => {
  try {
    const { pageId = "" } = req.body || {};
    if (!pageId) return res.status(400).json({ ok: false, error: "missing_pageId" });
    markConversion(String(pageId));
    try {
      const last = lastShipFor(String(pageId));
      if (last) recordSectionOutcome(last.sections || [], "all", true);
      try {
        if (last?.brand) {
          recordTokenWin({
            brand: { primary: last.brand.primary, tone: last.brand.tone, dark: last.brand.dark },
            sessionId: String(last.sessionId || "anon"),
          });
        }
      } catch {}
    } catch {}
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "convert_failed" });
  }
});

router.get("/kpi", (_req, res) => {
  try {
    return res.json({ ok: true, ...kpiSummary() });
  } catch {
    return res.status(500).json({ ok: false, error: "kpi_failed" });
  }
});

// --- Proof Card reader ---
router.get("/proof/:pageId", (req, res) => {
  try {
    const p = `.cache/proof/${String(req.params.pageId)}.json`;
    if (!fs.existsSync(p)) return res.status(404).json({ ok: false, error: "not_found" });
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return res.json({ ok: true, proof: j });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "proof_failed" });
  }
});

function pathResolve(p) {
  try {
    return require("path").resolve(p);
  } catch {
    return p;
  }
}

export default router;

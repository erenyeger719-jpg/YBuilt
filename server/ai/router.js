// server/ai/router.js
import express from "express";
// import TS helpers (tsx will handle .ts)
import { buildSpec } from "../intent/brief.ts";
import { nextActions } from "../intent/planner.ts";
import { runWithBudget } from "../intent/budget.ts";

// Choose model by task + tier. Swap here when you add providers.
export function pickModel(task, tier = "balanced") {
  // tiers: "fast" (cheap/quick), "balanced", "best" (highest quality)
  const map = {
    fast: {
      planner: { provider: "openai", model: "gpt-4o-mini" },
      coder: { provider: "openai", model: "gpt-4o-mini" },
      critic: { provider: "openai", model: "gpt-4o-mini" },
    },
    balanced: {
      planner: { provider: "openai", model: "gpt-4o-mini" }, // quick, coherent
      coder: { provider: "openai", model: "gpt-4o" }, // stronger codegen
      critic: { provider: "openai", model: "gpt-4o-mini" }, // cheap pass
    },
    best: {
      // Swap these later if you add Anthropic/Gemini:
      // planner: { provider: "anthropic", model: "claude-3-5-sonnet" },
      // coder:   { provider: "openai", model: "gpt-4.1" },
      // critic:  { provider: "google", model: "gemini-1.5-pro" },
      planner: { provider: "openai", model: "gpt-4o" },
      coder: { provider: "openai", model: "gpt-4o" },
      critic: { provider: "openai", model: "gpt-4o" },
    },
  };
  const tierMap = map[tier] || map.balanced;
  return tierMap[task] || tierMap.coder;
}

const router = express.Router();

// --- helper to pull first JSON block out of an LLM reply ---
function extractJSON(s) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON in response");
  return s.slice(start, end + 1);
}

// POST /api/ai/review
router.post("/review", async (req, res) => {
  try {
    const { code = "", tier = "balanced" } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ ok: false, error: "Missing code" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not set" });
    }

    const system = `
You analyze tiny static web projects (index.html, styles.css, app.js).
Return ONLY JSON with this exact shape, no prose:

{"issues":[
  {
    "type":"accessibility|performance|html|css|js|semantics|seo|content|other",
    "msg":"short human message",
    "fix":"short code-oriented suggestion (may include snippet)",
    "ops":[
      {
        "file":"index.html|styles.css|app.js",
        "find":"STRING or REGEX (if isRegex=true)",
        "replace":"replacement string",
        "isRegex":false
      }
    ]
  }
]}

Rules:
- Prefer precise find/replace ops over vague advice.
- Only target files: index.html, styles.css, app.js.
- To append new content, use: {"file":"...","find":"$$EOF$$","replace":"\\n...content...","isRegex":false}
- If nothing to fix, return {"issues":[]}.
`.trim();

    const user = `CODE BUNDLE:\n${code}\n---\nTIER: ${tier}`;

    // Choose model based on tier using the same picker
    const { provider, model } = pickModel("critic", tier);
    if (provider !== "openai") {
      // For now we only implement OpenAI here.
      return res
        .status(500)
        .json({ ok: false, error: `Provider ${provider} not configured in /ai/review` });
    }

    // Call OpenAI via REST (Node 18+ has global fetch)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ ok: false, error: `OpenAI error: ${txt}` });
    }
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const json = JSON.parse(extractJSON(raw));

    // sanitize
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

    return res.json({ ok: true, review: { issues: cleaned } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "review failed" });
  }
});

/** Build/merge a working spec + suggest chips */
router.post("/brief", async (req, res) => {
  try {
    const { prompt, spec: lastSpec } = req.body || {};
    const out = buildSpec({ prompt, lastSpec });
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "brief_failed" });
  }
});

/** Plan next steps (ask / retrieve / patch) */
router.post("/plan", async (req, res) => {
  try {
    const { spec, signals } = req.body || {};
    const actions = nextActions(spec, signals);
    return res.json({ ok: true, actions });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "plan_failed" });
  }
});

// Helper: local base URL (works in dev/prod)
function localBase() {
  return `http://127.0.0.1:${process.env.PORT || "5050"}`;
}

/**
 * POST /api/ai/act
 * Body: { sessionId?: string, spec: {...}, action: {kind, args, cost_est?, gain_est?} }
 * Runs exactly one action under a tiny budget gate.
 */
router.post("/act", async (req, res) => {
  try {
    const { sessionId = "anon", spec = {}, action = {} } = req.body || {};
    if (!action || !action.kind) {
      return res.status(400).json({ ok: false, error: "missing_action" });
    }

    const out = await runWithBudget(sessionId, action, async (_tier) => {
      // tier is here if you want model switching later
      if (action.kind === "retrieve") {
        const sections = Array.isArray(action.args?.sections)
          ? action.args.sections
          : spec?.layout?.sections || [];
        return { kind: "retrieve", sections };
      }

      if (action.kind === "ask") {
        // reuse brief’s chip generator by calling buildSpec with last spec only
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
        const sections = Array.isArray(action.args?.sections)
          ? action.args.sections
          : spec?.layout?.sections || [];
        if (!sections.length) return { error: "no_sections" };
        const dark = !!spec?.brand?.dark;
        const title = String(spec?.summary || "Preview");

        const r = await fetch(`${localBase()}/api/previews/compose`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sections, dark, title }),
        });
        if (!r.ok) {
          return { error: `compose_http_${r.status}` };
        }
        const data = await r.json();
        return { kind: "compose", ...data };
      }

      return { error: `unknown_action:${action.kind}` };
    });

    return res.json({ ok: true, result: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "act_failed" });
  }
});

/**
 * POST /api/ai/one
 * Body: { prompt: string, sessionId?: string }
 * Flow: prompt -> brief -> plan -> run best action
 * If retrieve succeeds, it auto-composes and returns a URL.
 */
router.post("/one", async (req, res) => {
  try {
    const { prompt = "", sessionId = "anon" } = req.body || {};
    // 1) Build spec + chips
    const { spec } = buildSpec({ prompt });

    // 2) Plan
    const actions = nextActions(spec, {});
    if (!actions.length) {
      return res.json({ ok: true, spec, actions: [], note: "nothing_to_do" });
    }

    // 3) Run the top-ranked action
    const top = actions[0];
    const actResR = await fetch(`${localBase()}/api/ai/act`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, spec, action: top }),
    });
    const actData = await actResR.json();

    let url = null;
    let usedAction = top;

    // If we retrieved sections, compose immediately
    if (actData?.result?.kind === "retrieve" && Array.isArray(actData.result.sections)) {
      const composeAction = {
        kind: "compose",
        cost_est: 3,
        gain_est: 20,
        args: { sections: actData.result.sections },
      };
      const composeR = await fetch(`${localBase()}/api/ai/act`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, spec, action: composeAction }),
      });
      const composeData = await composeR.json();
      url = composeData?.result?.url || composeData?.result?.path || null;
      usedAction = composeAction;
    }

    return res.json({
      ok: true,
      spec,
      plan: actions,
      ran: usedAction,
      result: actData?.result,
      url,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "one_failed" });
  }
});

export default router;

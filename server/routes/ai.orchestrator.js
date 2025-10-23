// server/routes/ai.orchestrator.js
import express from "express";
import fs from "fs";
import path from "path";
import { callModel } from "../ai/models.js";
import { pickModel } from "../ai/router.js";

const router = express.Router();
router.use(express.json({ limit: "1mb" })); // ensure JSON body parsing for all routes

const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
}
function allowedFile(file) {
  return (
    /^[a-zA-Z0-9._/-]+$/.test(file) &&
    [".html", ".htm", ".css", ".js"].some((ext) => file.endsWith(ext))
  );
}
function ensureIndexFallback(files, title = "Page") {
  const names = new Set(files.map((f) => f.path));
  if (!names.has("index.html")) {
    files.unshift({
      path: "index.html",
      content: `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><h1>${title}</h1><script src="app.js"></script></body></html>`,
    });
  }
  if (!names.has("styles.css"))
    files.push({
      path: "styles.css",
      content: `:root{color-scheme:light dark}body{font-family:system-ui;margin:40px;line-height:1.6}`,
    });
  if (!names.has("app.js"))
    files.push({ path: "app.js", content: `console.log("Hello from app.js")` });
  return files;
}

// --- tokens → CSS variables helpers ---
function tokensToCSSVars(tokens = {}) {
  const map = {
    "--color-primary": tokens?.primary,
    "--radius": tokens?.radius,
    "--font-size": tokens?.fontSize,
  };
  const parts = Object.entries(map)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${String(v)}`);
  return parts.length ? `:root{${parts.join(";")}}` : "";
}
function upsertStylesWithTokens(files, tokens) {
  const vars = tokensToCSSVars(tokens);
  if (!vars) return files;

  const i = files.findIndex((f) => f.path === "styles.css");
  if (i >= 0) {
    files[i] = { ...files[i], content: `${vars}\n\n${files[i].content || ""}` };
  } else {
    files.push({
      path: "styles.css",
      content: `${vars}\n\n:root{color-scheme:light dark}\nbody{font-family:system-ui;margin:40px;line-height:1.6}`,
    });
  }
  return files;
}

// --- CTA wiring / section helpers ---
function ensureSectionIds(html) {
  const withIds = String(html || "")
    .replace(/<section([^>]*class="[^"]*\bhero\b[^"]*"[^>]*)>/i, (m, attrs) =>
      /id=/.test(m) ? m : `<section id="hero"${attrs}>`
    )
    .replace(/<section([^>]*class="[^"]*\bfeatures\b[^"]*"[^>]*)>/i, (m, attrs) =>
      /id=/.test(m) ? m : `<section id="features"${attrs}>`
    )
    .replace(/<section([^>]*class="[^"]*\bpricing\b[^"]*"[^>]*)>/i, (m, attrs) =>
      /id=/.test(m) ? m : `<section id="pricing"${attrs}>`
    )
    .replace(/<section([^>]*class="[^"]*\bfaq\b[^"]*"[^>]*)>/i, (m, attrs) =>
      /id=/.test(m) ? m : `<section id="faq"${attrs}>`
    )
    .replace(/<section([^>]*class="[^"]*\btestimonials\b[^"]*"[^>]*)>/i, (m, attrs) =>
      /id=/.test(m) ? m : `<section id="testimonials"${attrs}>`
    )
    .replace(/<section([^>]*class="[^"]*\bcta\b[^"]*"[^>]*)>/i, (m, attrs) =>
      /id=/.test(m) ? m : `<section id="cta"${attrs}>`
    );

  // Heuristic: primary buttons linking to "#" → reroute to #cta
  return withIds.replace(
    /<a([^>]*class="[^"]*\bbtn\b[^"]*"[^>]*)href=["']#["']/gi,
    (_m, attrs) => `<a${attrs}href="#cta"`
  );
}
function appendSmoothScroll(js) {
  const shim =
    "document.addEventListener('click',e=>{const a=e.target.closest('a[href^=\"#\"]');if(!a)return;const id=a.getAttribute('href').slice(1);const el=document.getElementById(id);if(!el)return;e.preventDefault();el.scrollIntoView({behavior:'smooth',block:'start'});});";
  return (js || "") + "\n" + shim + "\n";
}
function postProcessFiles(files) {
  // index.html → ensure section IDs and CTA anchors
  const idx = files.findIndex((f) => f.path === "index.html");
  if (idx >= 0) files[idx].content = ensureSectionIds(files[idx].content);

  // app.js → ensure smooth scroll handler exists
  const jsIdx = files.findIndex((f) => f.path === "app.js");
  if (jsIdx >= 0) {
    files[jsIdx].content = appendSmoothScroll(files[jsIdx].content);
  } else {
    files.push({ path: "app.js", content: appendSmoothScroll("") });
  }
  return files;
}

// --- Blocks filtering helpers ---
function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return null;
  const map = new Map([
    ["hero", "hero"],
    ["features", "features"],
    ["pricing", "pricing"],
    ["faq", "faq"],
    ["testimonials", "testimonials"],
    ["cta", "cta"],
  ]);
  return blocks
    .map((s) => String(s || "").toLowerCase().trim())
    .map((s) => map.get(s) || null)
    .filter(Boolean);
}
function filterPlanSections(plan, blocks) {
  const wanted = normalizeBlocks(blocks);
  if (!wanted || !wanted.length) return plan;
  const set = new Set(wanted);
  const take = (s) => {
    const t = (s.type || s.id || "").toLowerCase();
    return set.has(t);
  };
  return { ...plan, sections: (plan.sections || []).filter(take) };
}

// --- MOCK helpers (bypass OpenAI when MOCK mode is on) ---
function mockPlanFrom(prompt) {
  const title = (prompt || "Demo Page").slice(0, 60);
  return {
    title,
    tokens: { primary: "#4F46E5", radius: "12px", fontSize: "16px" },
    sections: [
      {
        type: "hero",
        html: `<section class="hero"><h1>${title}</h1><p>Ship faster with AI-built pages.</p><a class="btn" href="#">Get started</a></section>`,
      },
      {
        type: "features",
        html: `<section class="features"><h2>Features</h2><ul><li>Clean HTML</li><li>CSS tokens</li><li>Instant deploy</li></ul></section>`,
      },
      {
        type: "cta",
        html: `<section class="cta"><h2>Ready?</h2><a class="btn" href="#">Launch</a></section>`,
      },
    ],
  };
}
function filesFromPlan(plan) {
  const cssVars = tokensToCSSVars(plan?.tokens || {});
  const css = `${cssVars}

:root{color-scheme:light dark}
*{box-sizing:border-box}
body{font-family:system-ui, sans-serif; margin:40px; line-height:1.6}
.hero{padding:24px 0}
.features{padding:24px 0}
.cta{padding:24px 0}
.btn{display:inline-block;padding:10px 14px;border-radius:var(--radius,10px);background:var(--color-primary,#4F46E5);color:#fff;text-decoration:none}
`;

  const body = (plan.sections || []).map((s) => s.html || "").join("\n\n");
  const html = `<!doctype html><meta charset="utf-8"/><title>${plan.title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="styles.css"/>
<body>
${body}
</body>`;

  return [
    { path: "index.html", content: html },
    { path: "styles.css", content: css },
    { path: "plan.json", content: JSON.stringify(plan, null, 2) },
  ];
}

// --- Real model wrappers ---
async function callPlanner(prompt, tier) {
  const { provider, model } = pickModel("planner", tier);
  const system = `You are a web planner. Output JSON only:
{
 "title": "...",
 "sections": [{"id":"hero","purpose":"...","contentHints":["..."]}],
 "tokens": {"primary":"#4f46e5","radius":"10px"}
}`;
  const { content } = await callModel({
    provider,
    model,
    system,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: `Plan a simple landing page for: ${prompt}` }],
    temperature: 0.2,
    max_tokens: 1200,
  });
  return JSON.parse(content);
}

async function callCoder(plan, tier) {
  const { provider, model } = pickModel("coder", tier);
  const system = `You generate THREE web files from a plan/prompt. Output ONLY JSON:
{"files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."},{"path":"app.js","content":"..."}]}
Rules:
- Self-contained HTML/CSS/JS, no external CDNs.
- index.html must link styles.css and app.js.
- Respect tokens if provided: primary color, radius.`;
  const { content } = await callModel({
    provider,
    model,
    system,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: `Build files for this plan:\n${JSON.stringify(plan)}` }],
    temperature: 0.25,
    max_tokens: 2800,
  });

  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch {}
  let files = Array.isArray(parsed.files) ? parsed.files : [];
  files = files
    .filter((f) => f?.path && f?.content)
    .map((f) => ({ path: String(f.path), content: String(f.content) }))
    .filter((f) => allowedFile(f.path));
  return files;
}

// ---------- Routes ----------
router.post("/plan", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const tier = req.body?.tier || "balanced";
    if (!prompt) return res.status(400).json({ error: "prompt required" });

    const plan =
      process.env.MOCK_AI === "1" || tier === "mock" || !process.env.OPENAI_API_KEY
        ? mockPlanFrom(prompt)
        : await callPlanner(prompt, tier);

    return res.json({ ok: true, plan });
  } catch (e) {
    res.status(500).json({ error: e?.message || "plan failed" });
  }
});

router.post("/scaffold", async (req, res) => {
  try {
    const tier = String(req.body?.tier || "mock");
    let plan = req.body?.plan ?? null;
    let prompt = String(req.body?.prompt || "").trim();

    // If plan was sent as a JSON string, parse it (treat "" or bad JSON as null)
    if (typeof plan === "string") {
      try {
        plan = plan.trim() ? JSON.parse(plan) : null;
      } catch {
        plan = null; // treat bad JSON like no plan
      }
    }

    // Guard: need either a prompt or a plan
    if (!prompt && !plan) {
      return res.status(400).json({ error: "bad args: send prompt or plan" });
    }

    const useMock =
      process.env.MOCK_AI === "1" || tier === "mock" || !process.env.OPENAI_API_KEY;

    // If no plan provided, create one (mock or real)
    if (!plan) {
      plan = useMock ? mockPlanFrom(prompt) : await callPlanner(prompt, tier);
    }

    // Optional blocks filter from client
    const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : null;
    if (blocks && blocks.length) {
      plan = filterPlanSections(plan, blocks);
    }

    // Turn plan into files (mock or real)
    let files = useMock ? filesFromPlan(plan) : await callCoder(plan, tier);

    // Safety & tokens wiring
    files = ensureIndexFallback(files, plan?.title || prompt || "Page");
    files = upsertStylesWithTokens(files, plan?.tokens);
    files = postProcessFiles(files); // wire CTAs & smooth-scroll

    // Persist under /previews/forks/<slug>/
    const slug = `${Date.now().toString(36)}-${slugify(plan?.title || prompt || "ai")}`;
    const destDir = path.join(PREVIEWS_DIR, "forks", slug);
    await fs.promises.mkdir(destDir, { recursive: true });

    // Write files
    for (const f of files) {
      const isPlanJson = f.path === "plan.json";
      if (!isPlanJson && !allowedFile(f.path)) continue;
      const abs = path.join(destDir, f.path);
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, f.content, "utf8");
    }

    // Save the plan for later rebuilds (ensure exists even if coder didn't emit it)
    await fs.promises.writeFile(
      path.join(destDir, "plan.json"),
      JSON.stringify(plan, null, 2),
      "utf8"
    );

    return res.json({
      ok: true,
      path: `/previews/forks/${slug}/`,
      slug,
      model: useMock ? { provider: "mock", model: "mock" } : undefined,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "scaffold failed" });
  }
});

router.post("/review", async (req, res) => {
  try {
    const { code, tier = "fast" } = req.body || {};
    if (!code) return res.status(400).json({ error: "code required" });

    const useMock =
      process.env.MOCK_AI === "1" || tier === "mock" || !process.env.OPENAI_API_KEY;

    if (useMock) {
      // Simple static review in mock mode
      return res.json({
        ok: true,
        review: {
          issues: [
            {
              type: "quality",
              msg: "Mock review: looks fine for a demo.",
              fix: "Switch to a real tier for detailed feedback.",
            },
          ],
        },
        model: { provider: "mock", model: "mock" },
      });
    }

    const { provider, model } = pickModel("critic", tier);
    const system = `You are a code critic. Output JSON only:
{"issues":[{"type":"accessibility|seo|performance|quality","msg":"...","fix":"..."}]}`;
    const { content } = await callModel({
      provider,
      model,
      system,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: `Review this code:\n${code}` }],
      temperature: 0.1,
      max_tokens: 800,
    });
    const out = JSON.parse(content);
    return res.json({ ok: true, review: out, model: { provider, model } });
  } catch (e) {
    res.status(500).json({ error: e?.message || "review failed" });
  }
});

export default router;

// server/routes/ai.orchestrator.js
import express from "express";
import fs from "fs";
import path from "path";
import { callModel } from "../ai/models.js";
import { pickModel } from "../ai/router.js";

const router = express.Router();
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

// --- NEW: tokens → CSS variables helpers ---
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

router.post("/plan", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const tier = req.body?.tier || "balanced";
    if (!prompt) return res.status(400).json({ error: "prompt required" });

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
    const plan = JSON.parse(content);
    return res.json({ ok: true, plan, model: { provider, model } });
  } catch (e) {
    res.status(500).json({ error: e?.message || "plan failed" });
  }
});

router.post("/scaffold", express.json({ limit: "4mb" }), async (req, res) => {
  try {
    const { prompt, plan, tier = "balanced" } = req.body || {};
    const usePrompt = String(prompt || "").trim();
    if (!usePrompt && !plan) return res.status(400).json({ error: "prompt or plan required" });

    const { provider, model } = pickModel("coder", tier);
    const system = `You generate THREE web files from a plan/prompt. Output ONLY JSON:
{"files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."},{"path":"app.js","content":"..."}]}
Rules:
- Self-contained HTML/CSS/JS, no external CDNs.
- index.html must link styles.css and app.js.
- Respect tokens if provided: primary color, radius.`;

    const user = plan
      ? `Build files for this plan:\n${JSON.stringify(plan)}`
      : `Build files for this idea:\n${usePrompt}`;

    const { content } = await callModel({
      provider,
      model,
      system,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: user }],
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
      .map((f) => ({ path: String(f.path), content: String(f.content) }));
    files = files.filter((f) => allowedFile(f.path));
    files = ensureIndexFallback(files, plan?.title || usePrompt || "Page");
    // NEW: inject tokens as CSS variables
    files = upsertStylesWithTokens(files, plan?.tokens);

    const slug = `${Date.now().toString(36)}-${slugify(plan?.title || usePrompt || "ai")}`;
    const destDir = path.join(PREVIEWS_DIR, "forks", slug);
    await fs.promises.mkdir(destDir, { recursive: true });

    // NEW: Save the plan for later rebuilds
    if (plan) {
      await fs.promises.writeFile(
        path.join(destDir, "plan.json"),
        JSON.stringify(plan, null, 2),
        "utf8"
      );
    }

    for (const f of files) {
      const abs = path.join(destDir, f.path);
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, f.content, "utf8");
    }
    return res.json({
      ok: true,
      path: `/previews/forks/${slug}/`,
      slug,
      model: { provider, model },
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "scaffold failed" });
  }
});

router.post("/review", express.json({ limit: "1mb" }), async (req, res) => {
  try {
    const { code, tier = "fast" } = req.body || {};
    if (!code) return res.status(400).json({ error: "code required" });
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

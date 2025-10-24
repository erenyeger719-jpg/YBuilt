// server/routes/previews.js
import { Router } from "express";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const requireCjs = createRequire(import.meta.url);
const { safeJoinTeam } = requireCjs("./_teamPaths");

const r = Router();

// resolve cwd for PREVIEWS_DIR
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = process.env.PREVIEWS_DIR
  ? path.resolve(process.env.PREVIEWS_DIR)
  : path.resolve(process.cwd(), "previews");

// templates live under /previews/<templateId>/
const TEMPLATES_DIR = PREVIEWS_DIR;

function safeSlug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

// POST /api/previews/build { templateId }
r.post("/build", async (req, res, next) => {
  try {
    const { templateId } = req.body || {};
    if (!templateId)
      return res.status(400).json({ ok: false, error: "templateId required" });

    const safe = safeSlug(templateId);
    const src = path.join(TEMPLATES_DIR, safe);
    if (!existsSync(src))
      return res
        .status(404)
        .json({ ok: false, error: "template not found" });

    // simple unique id
    const id = `${safe}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    // team-scoped destination
    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const dest = safeJoinTeam(teamId, `/previews/forks/${id}/`);

    // optional Socket.IO progress
    const io = req.app.get("io");
    const emit = (stage, payload = {}) => {
      io?.to(id).emit("build:progress", { id, stage, ...payload });
    };

    emit("queued");
    await copyDir(src, dest);
    emit("ready", { url: `/previews/forks/${id}/` });

    res.json({ ok: true, id, url: `/previews/forks/${id}/` });
  } catch (err) {
    next(err);
  }
});

// GET /api/previews/forks
// Lists team-scoped forks under /previews/forks/
r.get("/forks", async (req, res, next) => {
  try {
    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const base = safeJoinTeam(teamId, "/previews/forks/");
    if (!existsSync(base)) return res.json({ ok: true, items: [] });
    const items = await fs.readdir(base);
    const out = items.map((id) => ({ id, url: `/previews/forks/${id}/` }));
    res.json({ ok: true, items: out });
  } catch (e) {
    next(e);
  }
});

export default r;

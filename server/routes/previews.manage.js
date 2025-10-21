// server/routes/previews.manage.js
import express from "express";
import path from "path";
import fs from "fs";

const router = express.Router();
const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

function safeForkDirFromPublic(href) {
  // Expect /previews/forks/<slug>/...
  const rel = String(href || "").replace(/^https?:\/\/[^/]+/i, "");
  const m =
    rel.match(/^\/?previews\/forks\/([^/]+)\//i) ||
    rel.match(/^\/?previews\/forks\/([^/]+)$/i);
  if (!m) throw new Error("bad path");
  const slug = m[1];
  const abs = path.resolve(path.join(PREVIEWS_DIR, "forks", slug));
  if (!abs.startsWith(path.resolve(PREVIEWS_DIR))) throw new Error("escape");
  return abs;
}

// POST /api/previews/delete { path: "/previews/forks/<slug>/" }
router.post("/delete", async (req, res) => {
  try {
    const href = req.body?.path;
    if (!href) return res.status(400).json({ error: "path required" });
    const dir = safeForkDirFromPublic(href);
    await fs.promises.rm(dir, { recursive: true, force: true });
    return res.json({ ok: true });
  } catch (_e) {
    return res.status(400).json({ error: "invalid or missing path" });
  }
});

export default router;

// server/routes/previews.manage.js
import express from "express";
import path from "path";
import fs from "fs";

const router = express.Router();
const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

/** Expect /previews/forks/<slug>/... and return absolute fork dir */
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

/** Reuse-safe: harden path joining to previews dir */
function safeJoinPreviews(inputPath) {
  const p = String(inputPath || "");
  const rel = p.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
  if (!rel.startsWith("previews/")) throw new Error("bad path");
  const abs = path.resolve(PREVIEWS_DIR, rel.replace(/^previews\//, ""));
  if (!abs.startsWith(PREVIEWS_DIR)) throw new Error("path escape");
  return abs;
}

function allowedFile(file) {
  return (
    /^[a-zA-Z0-9._/-]+$/.test(file) &&
    [".html", ".htm", ".css", ".js"].some((ext) => file.endsWith(ext))
  );
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

// --- READ a file from a fork ---
// GET /api/previews/read?path=/previews/forks/<slug>/&file=index.html
router.get("/read", async (req, res) => {
  try {
    const href = req.query?.path;
    const file = String(req.query?.file || "index.html");
    if (!href || !allowedFile(file)) return res.status(400).json({ error: "bad args" });

    const absDir = safeJoinPreviews(href);
    const absFile = path.resolve(absDir, file);
    if (!absFile.startsWith(absDir)) return res.status(400).json({ error: "path escape" });

    const content = await fs.promises.readFile(absFile, "utf8");
    res.json({ ok: true, content });
  } catch (e) {
    res.status(404).json({ error: "read failed" });
  }
});

// --- WRITE a file into a fork ---
// POST /api/previews/write { path:"/previews/forks/<slug>/", file:"index.html", content:"..." }
router.post("/write", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const href = req.body?.path;
    const file = String(req.body?.file || "index.html");
    const content = String(req.body?.content ?? "");
    if (!href || !allowedFile(file)) return res.status(400).json({ error: "bad args" });

    const absDir = safeJoinPreviews(href);
    const absFile = path.resolve(absDir, file);
    if (!absFile.startsWith(absDir)) return res.status(400).json({ error: "path escape" });

    await fs.promises.writeFile(absFile, content, "utf8");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "write failed" });
  }
});

// --- LIST files inside a fork ---
// GET /api/previews/list?path=/previews/forks/<slug>/
router.get("/list", async (req, res) => {
  try {
    const href = req.query?.path;
    if (!href) return res.status(400).json({ error: "path required" });

    const absDir = safeJoinPreviews(href);

    const MAX_FILES = 200;
    const files = [];
    async function walk(dir, prefix = "", depth = 0) {
      if (files.length >= MAX_FILES || depth > 3) return;
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.posix.join(prefix, e.name);
        if (e.isDirectory()) {
          await walk(full, rel, depth + 1);
        } else if (allowedFile(rel)) {
          files.push(rel);
          if (files.length >= MAX_FILES) break;
        }
      }
    }
    await walk(absDir, "");

    files.sort((a, b) => a.localeCompare(b));
    return res.json({ ok: true, files });
  } catch (e) {
    return res.status(404).json({ error: "list failed" });
  }
});

// --- REMOVE a file inside a fork ---
// POST /api/previews/remove-file { path:"/previews/forks/<slug>/", file:"styles.css" }
router.post("/remove-file", express.json(), async (req, res) => {
  try {
    const href = req.body?.path;
    const file = String(req.body?.file || "");
    if (!href || !allowedFile(file)) return res.status(400).json({ error: "bad args" });

    const absDir = safeJoinPreviews(href);
    const absFile = path.resolve(absDir, file);
    if (!absFile.startsWith(absDir)) return res.status(400).json({ error: "path escape" });

    await fs.promises.unlink(absFile);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "remove failed" });
  }
});

export default router;

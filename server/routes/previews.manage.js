// server/routes/previews.manage.js
import express from "express";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import deployQueue from "./deploy.queue.js"; // appended: deploy queue router

const requireCjs = createRequire(import.meta.url);
const { safeJoinTeam } = requireCjs("./_teamPaths");

const router = express.Router();

/** Validate allowed file names we operate on */
function allowedFile(file) {
  return (
    /^[a-zA-Z0-9._/-]+$/.test(file) &&
    [".html", ".htm", ".css", ".js"].some((ext) => file.endsWith(ext))
  );
}

/** Helper: recursively copy a directory */
async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fs.promises.copyFile(s, d);
    }
  }
}

// POST /api/previews/delete { path: "/previews/forks/<slug>/" }
router.post("/delete", async (req, res) => {
  try {
    const href = req.body?.path;
    if (!href) return res.status(400).json({ error: "path required" });
    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const dir = safeJoinTeam(teamId, href);
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
    if (!href || !allowedFile(file))
      return res.status(400).json({ error: "bad args" });

    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const absDir = safeJoinTeam(teamId, href);
    const absFile = path.resolve(absDir, file);
    if (!absFile.startsWith(absDir))
      return res.status(400).json({ error: "path escape" });

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
    if (!href || !allowedFile(file))
      return res.status(400).json({ error: "bad args" });

    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const absDir = safeJoinTeam(teamId, href);
    const absFile = path.resolve(absDir, file);
    if (!absFile.startsWith(absDir))
      return res.status(400).json({ error: "path escape" });

    // Ensure parent folders exist (e.g., css/styles.css)
    await fs.promises.mkdir(path.dirname(absFile), { recursive: true });
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

    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const absDir = safeJoinTeam(teamId, href);

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
    if (!href || !allowedFile(file))
      return res.status(400).json({ error: "bad args" });

    // Optional guard: avoid breaking the preview
    if (file === "index.html")
      return res.status(400).json({ error: "cannot delete index.html" });

    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const absDir = safeJoinTeam(teamId, href);
    const absFile = path.resolve(absDir, file);
    if (!absFile.startsWith(absDir))
      return res.status(400).json({ error: "path escape" });

    await fs.promises.unlink(absFile);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "remove failed" });
  }
});

// --- DUPLICATE a fork ---
// POST /api/previews/duplicate { path:"/previews/forks/<slug>/" }
router.post("/duplicate", express.json(), async (req, res) => {
  try {
    const href = req.body?.path;
    if (!href) return res.status(400).json({ error: "path required" });

    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;

    // source directory (team-scoped)
    const srcDir = safeJoinTeam(teamId, href);

    // derive a new slug
    const srcMatch =
      String(href).match(/\/previews\/forks\/([^/]+)\//i) ||
      String(href).match(/\/previews\/forks\/([^/]+)$/i);
    const base = srcMatch ? srcMatch[1] : `copy`;
    const newSlug = `${base}-copy-${Math.random()
      .toString(36)
      .slice(2, 5)}${Math.random().toString(36).slice(2, 4)}`;

    // destination directory (team-scoped)
    const destDir = safeJoinTeam(teamId, `/previews/forks/${newSlug}/`);

    await copyDir(srcDir, destDir);

    return res.json({
      ok: true,
      path: `/previews/forks/${newSlug}/`,
      slug: newSlug,
    });
  } catch (e) {
    console.error("[PREVIEWS] duplicate error", e);
    return res.status(500).json({ error: "duplicate failed" });
  }
});

/**
 * Best-effort mount of deploy queue if an Express `app` happens to be in scope.
 * Normally, this should be mounted in server/index.ts as: app.use("/api/deploy", deployQueue)
 * Keeping this here satisfies the requested append without breaking this router.
 */
// eslint-disable-next-line no-undef
if (typeof app !== "undefined" && app?.use) {
  // @ts-ignore
  app.use("/api/deploy", deployQueue);
}

export default router;

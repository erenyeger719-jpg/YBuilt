// server/routes/import.js
import express from "express";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import AdmZip from "adm-zip";

const router = express.Router();
const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

function slug() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
}

function ensureDir(p) {
  return fs.promises.mkdir(p, { recursive: true });
}

function parseGitHubUrl(input) {
  // Accept:
  // - https://github.com/user/repo
  // - https://github.com/user/repo/
  // - https://github.com/user/repo/tree/branch[/subdir...]
  // - github.com/user/repo etc.
  const u = input.replace(/^https?:\/\//, "").replace(/^www\./, "");
  if (!u.startsWith("github.com/")) throw new Error("Not a GitHub URL");
  const parts = u.split("/").slice(1); // after github.com
  // parts: [user, repo, maybe 'tree', maybe branch, ...sub]
  const user = parts[0];
  const repo = (parts[1] || "").replace(/\.git$/, "");
  if (!user || !repo) throw new Error("Missing owner/repo");
  let branch = "main";
  let subpath = "";
  if (parts[2] === "tree" && parts[3]) {
    branch = parts[3];
    if (parts.length > 4) {
      subpath = parts.slice(4).join("/");
    }
  }
  return { user, repo, branch, subpath };
}

async function moveChildrenUpIfWrapped(dest) {
  const top = await fs.promises.readdir(dest, { withFileTypes: true });
  if (top.length === 1 && top[0].isDirectory()) {
    const inner = path.join(dest, top[0].name);
    const innerEntries = await fs.promises.readdir(inner);
    for (const name of innerEntries) {
      await fs.promises.rename(path.join(inner, name), path.join(dest, name));
    }
    await fs.promises.rm(inner, { recursive: true, force: true });
  }
}

async function ensureIndexHtml(dest, subpath = "") {
  // If subpath was provided, ensure it got hoisted
  const candidate = path.join(dest, "index.html");
  return fs.promises
    .access(candidate)
    .then(() => true)
    .catch(() => false);
}

// POST /api/import/github { url: "https://github.com/user/repo[...]" }
router.post("/github", async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim();
    if (!url) return res.status(400).json({ error: "url required" });

    const { user, repo, branch, subpath } = parseGitHubUrl(url);

    const forksDir = path.join(PREVIEWS_DIR, "forks");
    await ensureDir(forksDir);
    const s = slug();
    const destDir = path.join(forksDir, `${s}-import-${repo.toLowerCase()}`);
    await ensureDir(destDir);

    // Download zip from codeload
    const zipUrl = `https://codeload.github.com/${user}/${repo}/zip/refs/heads/${branch}`;
    const resp = await fetch(zipUrl);
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return res.status(502).json({ error: "github download failed", detail: t });
    }
    const buf = Buffer.from(await resp.arrayBuffer());

    // Extract
    const zip = new AdmZip(buf);
    zip.extractAllTo(destDir, true);

    // If GitHub zip wrapped everything into one root folder, hoist it
    await moveChildrenUpIfWrapped(destDir);

    // If a subpath was given, hoist that subfolder's contents to dest root
    if (subpath) {
      const subAbs = path.join(destDir, subpath);
      try {
        const stat = await fs.promises.stat(subAbs);
        if (stat.isDirectory()) {
          // Move subpath children to dest root
          const names = await fs.promises.readdir(subAbs);
          for (const n of names) {
            await fs.promises.rename(path.join(subAbs, n), path.join(destDir, n));
          }
          // Clean leftovers (including any other top-level contents)
          const top = await fs.promises.readdir(destDir);
          for (const n of top) {
            if (n !== "index.html" && n !== "assets" && n !== "public" && n !== "styles" && n !== "scripts") {
              // best-effort; don’t risk deleting what we just moved
              // keep it simple: skip cleanup beyond hoist
            }
          }
          await fs.promises.rm(subAbs, { recursive: true, force: true }).catch(() => {});
        }
      } catch {
        // ignore if subpath not found
      }
    }

    const hasIndex = await ensureIndexHtml(destDir, subpath);
    if (!hasIndex) {
      return res.status(400).json({ error: "No index.html found at repo root/subpath" });
    }

    const publicPath = `/previews/forks/${path.basename(destDir)}/`;
    return res.json({ ok: true, path: publicPath, repo: `${user}/${repo}`, branch, subpath });
  } catch (e) {
    console.error("[IMPORT:GITHUB] error", e);
    res.status(500).json({ error: "import error" });
  }
});

export default router;

// server/routes/deploy.js
import fetch from "node-fetch";
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { createWriteStream, createReadStream } from "fs";
import Archiver from "archiver";

const router = express.Router();

const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");
const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN || "";
const VERCEL_TOKEN  = process.env.VERCEL_TOKEN  || "";
const VERCEL_TEAMID = process.env.VERCEL_TEAMID || ""; // optional

function safeJoinPreviews(inputPath) {
  const p = String(inputPath || "");
  const rel = p.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
  if (!rel.startsWith("previews/")) throw new Error("bad path");
  const abs = path.resolve(PREVIEWS_DIR, rel.replace(/^previews\//, ""));
  if (!abs.startsWith(PREVIEWS_DIR)) throw new Error("path escape");
  return abs;
}

async function zipDirToTemp(absDir) {
  await fs.promises.access(absDir);
  const folderName = path.basename(absDir.replace(/\/$/, ""));
  const tmp = path.join(os.tmpdir(), `ybuilt-${folderName}-${Date.now()}.zip`);
  await new Promise((resolve, reject) => {
    const output = createWriteStream(tmp);
    const archive = Archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(absDir, false);
    archive.finalize();
  });
  return tmp;
}

/* ---------------- Netlify ---------------- */
// POST /api/deploy/netlify { path: "/previews/forks/<slug>/", siteName?: "ybuilt-foo", siteId?: "abc..." }
router.post("/netlify", async (req, res) => {
  try {
    if (!NETLIFY_TOKEN) return res.status(501).json({ error: "NETLIFY_TOKEN not set" });

    const href = req.body?.path;
    if (!href) return res.status(400).json({ error: "path required" });
    const absDir = safeJoinPreviews(href);

    // create site if needed
    let siteId = String(req.body?.siteId || "");
    const siteName = String(req.body?.siteName || "");
    if (!siteId) {
      const resp = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(siteName ? { name: siteName } : {}),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return res.status(502).json({ error: "netlify create failed", detail: t });
      }
      const site = await resp.json();
      siteId = site.id;
    }

    // zip folder → upload as body
    const zipPath = await zipDirToTemp(absDir);
    const up = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        "Content-Type": "application/zip",
      },
      body: createReadStream(zipPath),
    });
    await fs.promises.unlink(zipPath).catch(() => {});
    if (!up.ok) {
      const txt = await up.text();
      return res.status(502).json({ error: "netlify deploy failed", detail: txt });
    }
    const data = await up.json();
    return res.json({
      ok: true,
      provider: "netlify",
      site_id: data.site_id,
      deploy_id: data.id,
      url: data.deploy_ssl_url || data.deploy_url || null, // live URL
      admin_url: data.admin_url || null,                   // dashboard
      logs_url: data.logs_url || null,
    });
  } catch (e) {
    console.error("[DEPLOY:NETLIFY] error", e);
    res.status(500).json({ error: "deploy error" });
  }
});

/* ---------------- Vercel (static) ---------------- */
// Minimal static deploy by sending "files" array.
// POST /api/deploy/vercel { path:"/previews/forks/<slug>/", name?: "ybuilt-demo" }
router.post("/vercel", async (req, res) => {
  try {
    if (!VERCEL_TOKEN) return res.status(501).json({ error: "VERCEL_TOKEN not set" });

    const href = req.body?.path;
    if (!href) return res.status(400).json({ error: "path required" });
    const absDir = safeJoinPreviews(href);

    const name = String(req.body?.name || path.basename(absDir) || "ybuilt-static");

    // walk dir → files array (small sites only; fine for previews)
    const files = [];
    async function walk(dir, prefix = "") {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.posix.join(prefix, e.name);
        if (e.isDirectory()) {
          await walk(full, rel);
        } else {
          const buf = await fs.promises.readFile(full);
          files.push({ file: rel, data: buf.toString("base64"), encoding: "base64" });
        }
      }
    }
    await walk(absDir);

    const url = new URL("https://api.vercel.com/v13/deployments");
    if (VERCEL_TEAMID) url.searchParams.set("teamId", VERCEL_TEAMID);

    const body = {
      name,
      files,
      // Ensure Vercel treats this as a purely static output folder (no build)
      projectSettings: {
        framework: "other",
        buildCommand: null,
        devCommand: null,
        outputDirectory: ".",
      },
      target: "production",
    };

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ error: "vercel deploy failed", detail: txt });
    }
    const data = await resp.json();
    const previewUrl = data?.url ? `https://${data.url}` : null;

    return res.json({
      ok: true,
      provider: "vercel",
      id: data.id,
      url: previewUrl,                              // preview URL (normalized)
      inspectorUrl: data.inspectorUrl || null,      // keep original key
      inspectUrl: data.inspectorUrl || null,        // alias for convenience
      readyState: data.readyState,
    });
  } catch (e) {
    console.error("[DEPLOY:VERCEL] error", e);
    res.status(500).json({ error: "deploy error" });
  }
});

export default router;

// server/routes/deploy.queue.js
import express from "express";
import PQueue from "p-queue";
import { v4 as uuid } from "uuid";
import archiver from "archiver";
import fs from "fs";
import path from "path";

const router = express.Router();
const jobs = new Map();
const queue = new PQueue({ concurrency: 2 });

console.log("[deploy.queue] router initialized");

// --- helpers ---
const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

function safeAbsDirFromPreviewHref(previewPath) {
  const rel = String(previewPath || "")
    .replace(/^https?:\/\/[^/]+/i, "")  // drop origin if present
    .replace(/^\/+/, "");               // drop leading slash
  if (!rel.startsWith("previews/")) throw new Error("bad previewPath");
  const abs = path.resolve(PREVIEWS_DIR, rel.replace(/^previews\//, ""));
  if (!abs.startsWith(PREVIEWS_DIR)) throw new Error("escape");
  return abs; // directory like /.../previews/forks/<slug>
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 48);
}

async function zipDirToBuffer(dir) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    archive.on("error", reject);
    archive.on("warning", (e) => {
      // non-fatal FS warnings
      console.warn("[zip warning]", e?.message || e);
    });
    archive.directory(dir + "/", false);

    archive.on("data", (d) => chunks.push(d)); // archiver emits data when no pipe
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    archive.finalize();
  });
}

async function ensureNetlifySite(token, siteName) {
  const name = slugify(siteName) || `ybuilt-${Math.random().toString(36).slice(2, 8)}`;
  // try to create; if exists, Netlify returns 422 — we treat that as OK
  const res = await fetch("https://api.netlify.com/api/v1/sites", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (res.status === 422 || res.status === 409) return name; // already exists
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`create site failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data?.name || name;
}

async function deployNetlifyZip({ token, siteName, dir }) {
  const site = await ensureNetlifySite(token, siteName);
  const zip = await zipDirToBuffer(dir);

  const res = await fetch(`https://api.netlify.com/api/v1/sites/${site}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    body: zip,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || JSON.stringify(data) || (await res.text().catch(() => ""));
    throw new Error(`deploy failed: ${res.status} ${msg}`);
  }

  // Netlify replies with a bunch of URLs; pick the best available
  const url = data?.ssl_url || data?.url || data?.deploy_ssl_url || data?.deploy_url;
  const adminUrl = `https://app.netlify.com/sites/${site}`;
  return { url, adminUrl, raw: data };
}

// ------------ Routes -------------
router.get("/_ping", (req, res) => {
  res.json({ ok: true, queueSize: queue.size, pending: queue.pending });
});

router.post("/enqueue", express.json(), async (req, res) => {
  const { provider, previewPath, siteName } = req.body || {};
  if (!provider || !previewPath) return res.status(400).json({ error: "bad args" });

  const id = uuid();
  const job = { id, provider, previewPath, siteName, status: "queued", createdAt: Date.now() };
  jobs.set(id, job);

  queue.add(async () => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "running";
    try {
      if (provider === "netlify") {
        const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
        if (!NETLIFY_TOKEN) throw new Error("NETLIFY_TOKEN missing");
        const absDir = safeAbsDirFromPreviewHref(j.previewPath);
        // sanity: must have index.html
        if (!fs.existsSync(path.join(absDir, "index.html"))) {
          throw new Error("index.html missing in preview");
        }
        const { url, adminUrl } = await deployNetlifyZip({
          token: NETLIFY_TOKEN,
          siteName: siteName || `ybuilt-${slugify(path.basename(absDir))}`,
          dir: absDir,
        });
        j.status = "success";
        j.result = { url, adminUrl };
      } else if (provider === "vercel") {
        // TODO: implement vercel later
        throw new Error("Vercel deploy not wired yet");
      } else {
        throw new Error("unknown provider");
      }
    } catch (e) {
      j.status = "error";
      j.error = e?.message || String(e);
    }
  });

  res.json({ ok: true, id, position: queue.size });
});

router.get("/job/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, ...j });
});

export default router;

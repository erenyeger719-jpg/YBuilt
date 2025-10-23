import express from "express";
import PQueue from "p-queue";
import { v4 as uuid } from "uuid";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { PassThrough } from "stream";

const router = express.Router();
const jobs = new Map();
const queue = new PQueue({ concurrency: 2 });

console.log("[deploy.queue] router initialized");

// --- paths ---
const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

// ensure /previews/... maps to a folder under PREVIEWS_DIR
function safeAbsDirFromPreviewHref(previewPath) {
  const rel = String(previewPath || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");
  if (!rel.startsWith("previews/")) throw new Error("bad previewPath");
  const abs = path.resolve(PREVIEWS_DIR, rel.replace(/^previews\//, ""));
  if (!abs.startsWith(PREVIEWS_DIR)) throw new Error("escape");
  return abs;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 48);
}

// ---- zip dir to Buffer (archiver must pipe to a writable stream) ----
async function zipDirToBuffer(dir) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const out = new PassThrough();
    const chunks = [];
    out.on("data", (d) => chunks.push(d));
    out.on("end", () => resolve(Buffer.concat(chunks)));
    out.on("error", reject);
    archive.on("error", reject);
    archive.directory(dir + "/", false);
    archive.pipe(out);
    archive.finalize();
  });
}

// ---- Netlify helpers ----
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  let body = null;
  try { body = await res.json(); } catch {}
  return { res, body };
}

async function getSiteByName(token, name) {
  const { res, body } = await fetchJSON(
    `https://api.netlify.com/api/v1/sites/${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.ok) return body;
  return null;
}

// Find-or-create a site you OWN. If preferred name is taken globally, pick a random one.
async function ensureNetlifySite(token, preferredName) {
  const wanted = slugify(preferredName);
  if (wanted) {
    const mine = await getSiteByName(token, wanted);
    if (mine) return { id: mine.id, name: mine.name };
  }

  // try wanted → if taken, retry with random until success
  let attempt = wanted || `ybuilt-${Math.random().toString(36).slice(2, 8)}`;
  for (let i = 0; i < 3; i++) {
    const { res, body } = await fetchJSON(
      "https://api.netlify.com/api/v1/sites",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: attempt }),
      }
    );

    if (res.ok) {
      return { id: body.id, name: body.name };
    }

    // name taken or similar → pick a fresh random and retry
    if (res.status === 409 || res.status === 422) {
      attempt = `ybuilt-${Math.random().toString(36).slice(2, 8)}`;
      continue;
    }

    // other error → bubble up details
    const msg = body?.message || JSON.stringify(body) || `${res.status} ${res.statusText}`;
    throw new Error(`create site failed: ${res.status} ${msg}`);
  }

  throw new Error("could not create a Netlify site (name collisions)");
}

async function deployNetlifyZip({ token, site, dir }) {
  // zip
  const zip = await zipDirToBuffer(dir);

  // deploy **by site id** to avoid name collisions
  const { res, body } = await fetchJSON(
    `https://api.netlify.com/api/v1/sites/${encodeURIComponent(site.id)}/deploys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/zip",
      },
      body: zip,
    }
  );

  if (!res.ok) {
    const msg = body?.message || JSON.stringify(body) || `${res.status} ${res.statusText}`;
    throw new Error(`deploy failed: ${res.status} ${msg}`);
  }

  const url = body?.ssl_url || body?.url || body?.deploy_ssl_url || body?.deploy_url;
  const adminUrl = `https://app.netlify.com/sites/${site.name}`;
  return { url, adminUrl };
}

// ------------ Routes -------------
router.get("/_ping", (_req, res) => {
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
        if (!fs.existsSync(path.join(absDir, "index.html"))) {
          throw new Error("index.html missing in preview");
        }

        const preferred = siteName || `ybuilt-${slugify(path.basename(absDir))}`;
        const site = await ensureNetlifySite(NETLIFY_TOKEN, preferred);
        const { url, adminUrl } = await deployNetlifyZip({
          token: NETLIFY_TOKEN,
          site,
          dir: absDir,
        });

        j.status = "success";
        j.result = { url, adminUrl };
      } else if (provider === "vercel") {
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

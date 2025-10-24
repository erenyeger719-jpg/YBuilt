// server/routes/deploy.queue.js
import express from "express";
import PQueue from "p-queue";
import { v4 as uuid } from "uuid";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { PassThrough } from "stream";
import { createRequire } from "module";
const requireCjs = createRequire(import.meta.url);
const { safeJoinTeam } = requireCjs("./_teamPaths");

const router = express.Router();
const jobs = new Map();
const queue = new PQueue({ concurrency: 2 });

console.log("[deploy.queue] router initialized");

// --- optional socket bus (stage/log/done) ---
let bus = {
  stage: (_id, _s) => {},
  log: (_id, _m) => {},
  done: (_id, _p) => {},
};
try {
  const m = await import("../socketBus.js");
  const mod = m.default ?? m; // CJS interop
  bus = {
    stage: mod.stage || bus.stage,
    log:   mod.log   || bus.log,
    done:  mod.done  || bus.done,
  };
  console.log("[deploy.queue] socketBus connected");
} catch {
  console.log("[deploy.queue] socketBus not found; emitting disabled");
}

// team-scoped preview absolute path
function absFromPreview(teamId, previewPath) {
  // accepts "/previews/<jobId>/" or "/previews/forks/<slug>/"
  return safeJoinTeam(teamId, previewPath);
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
  try {
    body = await res.json();
  } catch {}
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
    const { res, body } = await fetchJSON("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: attempt }),
    });

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

  const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
  // try to derive a “client room” segment (works for /previews/<jobId>/)
  const m = String(previewPath).match(/^\/previews\/([^/]+)/i);
  const clientRoom = m ? m[1] : null;

  const id = uuid();
  const job = { id, provider, previewPath, siteName, teamId, clientRoom, status: "queued", createdAt: Date.now() };
  jobs.set(id, job);

  const emit = (fn, payload, line) => {
    if (fn === "log") {
      bus.log(id, line);
      if (clientRoom) bus.log(clientRoom, line);
    } else if (fn === "stage") {
      bus.stage(id, payload);
      if (clientRoom) bus.stage(clientRoom, payload);
    } else if (fn === "done") {
      bus.done(id, payload);
      if (clientRoom) bus.done(clientRoom, payload);
    }
  };

  emit("stage", "queued");
  emit("log", null, `Queued deploy → ${provider} for ${previewPath}`);

  queue.add(async () => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "running";
    emit("stage", "running");
    emit("log", null, "Starting deploy…");

    try {
      if (provider === "netlify") {
        const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
        if (!NETLIFY_TOKEN) throw new Error("NETLIFY_TOKEN missing");

        const absDir = absFromPreview(j.teamId, j.previewPath);
        if (!fs.existsSync(path.join(absDir, "index.html"))) {
          throw new Error("index.html missing in preview");
        }

        emit("stage", "packaging");
        emit("log", null, "Zipping site…");

        const preferred = siteName || `ybuilt-${slugify(path.basename(absDir))}`;
        emit("stage", "provisioning");
        emit("log", null, `Ensuring Netlify site "${preferred}"…`);
        const site = await ensureNetlifySite(NETLIFY_TOKEN, preferred);

        emit("stage", "uploading");
        emit("log", null, "Uploading deploy to Netlify…");
        const { url, adminUrl } = await deployNetlifyZip({
          token: NETLIFY_TOKEN,
          site,
          dir: absDir,
        });

        j.status = "success";
        j.result = { url, adminUrl };
        emit("done", { status: "ok", url, adminUrl });
        emit("log", null, `Deployed: ${url}`);
      } else if (provider === "vercel") {
        emit("stage", "error");
        throw new Error("Vercel deploy not wired yet");
      } else {
        emit("stage", "error");
        throw new Error("unknown provider");
      }
    } catch (e) {
      j.status = "error";
      j.error = e?.message || String(e);
      emit("log", null, `Error: ${j.error}`);
      emit("done", { status: "error", error: j.error });
    }
  });

  res.json({ ok: true, id, position: queue.size });
});

router.get("/job/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, ...j });
});

// ---- quick test emitter ----
router.post("/testlog", express.json(), async (req, res) => {
  const jobId = req.body?.jobId || `${Date.now().toString(36)}`;
  bus.stage(jobId, "queued");
  bus.log(jobId, "Test emitter started…");
  let i = 0;
  const timer = setInterval(() => {
    i++;
    bus.log(jobId, `tick ${i}`);
    if (i === 3) bus.stage(jobId, "building");
    if (i >= 8) {
      clearInterval(timer);
      bus.done(jobId, { status: "ok", url: `/previews/forks/demo-${jobId}/` });
    }
  }, 500);
  res.json({ ok: true, jobId });
});

export default router;

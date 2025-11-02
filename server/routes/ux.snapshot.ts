// server/routes/ux.snapshot.ts
import { Router } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const router = Router();

function nowIso() { return new Date().toISOString(); }
function safeId(s: string) { return String(s || "anon").replace(/[^a-z0-9_\-.:]/gi, "-").slice(0, 120); }
function rand(n = 6) { return crypto.randomBytes(n).toString("hex"); }

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function saveDataURL(dir: string, label: string, data: string): string | null {
  if (!data || typeof data !== "string") return null;
  // Accept raw base64 or data URL
  let b64 = data;
  let ext = "jpg";
  const m = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/i.exec(data);
  if (m) {
    ext = m[2] === "png" ? "png" : "jpg";
    b64 = m[3];
  }
  try {
    const buf = Buffer.from(b64, "base64");
    const name = `${Date.now()}-${label}-${rand(3)}.${ext}`;
    const fp = path.join(dir, name);
    fs.writeFileSync(fp, buf);
    return fp;
  } catch {
    return null;
  }
}

// POST /api/ux/snapshot
// body: { pageId, endpoint?, perf?: { cls_est, lcp_est_ms }, ux?: { score, issues?[] }, a11yPass?: bool, shots?: { phone?, tablet?, desktop? } }
// shots fields can be data URLs or raw base64 (jpeg/png). Size limit is enforced by body parser.
router.post("/snapshot", (req, res) => {
  try {
    const b = req.body || {};
    const pageId = safeId(b.pageId || req.headers["x-page-id"] || "anon");
    if (!pageId) return res.status(400).json({ ok: false, error: "missing_pageId" });

    const perf = {
      cls_est: typeof b?.perf?.cls_est === "number" ? b.perf.cls_est : null,
      lcp_est_ms: typeof b?.perf?.lcp_est_ms === "number" ? b.perf.lcp_est_ms : null,
    };
    const ux = {
      score: typeof b?.ux?.score === "number" ? b.ux.score : null,
      issues: Array.isArray(b?.ux?.issues) ? b.ux.issues.slice(0, 20) : [],
    };
    const a11yPass = typeof b?.a11yPass === "boolean" ? b.a11yPass : null;
    const endpoint = String(b.endpoint || "");

    const baseDir = path.join(".logs", "proof", pageId);
    ensureDir(baseDir);

    const shots = b.shots || {};
    const saved: Record<string, string | null> = {
      phone: saveDataURL(baseDir, "phone", shots.phone || "") ,
      tablet: saveDataURL(baseDir, "tablet", shots.tablet || ""),
      desktop: saveDataURL(baseDir, "desktop", shots.desktop || ""),
    };

    const row = {
      ts: nowIso(),
      pageId,
      endpoint,
      perf,
      ux,
      a11yPass,
      shots: Object.fromEntries(
        Object.entries(saved).map(([k, v]) => [k, v && v.startsWith(".") ? v : v])
      ),
    };
    ensureDir(path.join(".logs", "sup"));
    fs.appendFileSync(path.join(".logs", "sup", "proof.jsonl"), JSON.stringify(row) + "\n");

    return res.json({ ok: true, saved });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

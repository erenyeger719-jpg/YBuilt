import express from "express";
import path from "path";
import fs from "fs";
import Archiver from "archiver";

const router = express.Router();

// SAME logic as index.ts: where previews live
const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

// hard guard: only let us touch stuff under PREVIEWS_DIR
function safeJoinPreviews(inputPath) {
  // input: "/previews/forks/abc123-demo-landing/"
  // or     "/previews/hello-world/"
  const p = inputPath || "";
  // normalize from URL to relative dir under PREVIEWS_DIR
  const rel = p.replace(/^https?:\/\/[^/]+/i, "") // strip origin if pasted
               .replace(/^\/+/, "");              // drop leading slash
  if (!rel.startsWith("previews/")) throw new Error("bad path");
  const abs = path.resolve(PREVIEWS_DIR, rel.replace(/^previews\//, ""));
  if (!abs.startsWith(PREVIEWS_DIR)) throw new Error("path escape");
  return abs;
}

router.post("/export", async (req, res) => {
  try {
    const href = String(req.body?.path || req.body?.href || "");
    if (!href) return res.status(400).json({ error: "path required" });

    const absDir = safeJoinPreviews(href);

    const stat = await fs.promises.stat(absDir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return res.status(404).json({ error: "preview not found" });
    }

    // filename: ybuilt-<folder>-<ts>.zip
    const folderName = path.basename(absDir.replace(/\/$/, ""));
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `ybuilt-${folderName}-${ts}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = Archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      try { res.end(); } catch {}
      console.error("[EXPORT] zip error", err);
    });
    archive.pipe(res);
    archive.directory(absDir, false);
    await archive.finalize();
  } catch (e) {
    console.error("[EXPORT] failed", e);
    res.status(500).json({ error: "export failed" });
  }
});

export default router;

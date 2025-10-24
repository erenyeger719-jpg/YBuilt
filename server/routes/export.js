// server/routes/export.js
import express from "express";
import path from "path";
import fs from "fs";
import Archiver from "archiver";
import { createRequire } from "module";

const requireCjs = createRequire(import.meta.url);
const { safeJoinTeam } = requireCjs("./_teamPaths");

const router = express.Router();

// POST /api/previews/export { path: "/previews/forks/<slug>/" }
router.post("/export", async (req, res) => {
  try {
    const href = String(req.body?.path || req.body?.href || "");
    if (!href) return res.status(400).json({ error: "path required" });

    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const absDir = safeJoinTeam(teamId, href);

    const stat = await fs.promises.stat(absDir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return res.status(404).json({ error: "preview not found" });
    }

    // filename: ybuilt-<folder>-<ts>.zip
    const folderName = path.basename(absDir.replace(/\/$/, ""));
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `ybuilt-${folderName}-${ts}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    const archive = Archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      try {
        res.end();
      } catch {}
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

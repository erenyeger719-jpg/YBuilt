import { Router } from "express";
import fs from "fs/promises";
import path from "path";

const router = Router();
const PREVIEWS_ROOT = path.resolve(process.env.PREVIEWS_DIR || "public/previews");

// GET /api/workspace/:jobId/files → return index.html for the editor
router.get("/workspace/:jobId/files", async (req, res) => {
  const jobDir = path.join(PREVIEWS_ROOT, req.params.jobId);
  const indexPath = path.join(jobDir, "index.html");
  try {
    const content = await fs.readFile(indexPath, "utf8");
    res.json({
      files: [{ path: "index.html", content, language: "html" }],
      manifest: { name: "Generated Site", description: "", entryPoint: "index.html" }
    });
  } catch {
    res.status(404).json({ error: "Workspace files not found" });
  }
});

// GET /api/workspace/:jobId/theme → default theme so the page doesn't 404
router.get("/workspace/:jobId/theme", (_req, res) => {
  res.json({
    colors: {
      background: "#ffffff",
      text: "#111111",
      primaryBackground: "#000000",
      primaryText: "#ffffff",
      accentBackground: "#4f46e5",
      accentText: "#ffffff",
      destructiveBackground: "#ef4444",
      destructiveText: "#ffffff",
      border: "#e5e7eb",
      cardBackground: "#ffffff",
      cardText: "#111111",
    },
    fonts: { sans: "Inter, system-ui, sans-serif", serif: "Georgia, serif", mono: "Menlo, monospace" },
    borderRadius: "0.75rem",
  });
});

// PUT /api/workspace/:jobId/files/:filePath → save edits from PageToolSheet
router.put("/workspace/:jobId/files/:filePath(*)", async (req, res) => {
  const safe = (p: string) => p.replace(/(^\/+|\.\.)/g, "");
  const rel = safe(req.params.filePath || "index.html");
  const abs = path.join(PREVIEWS_ROOT, req.params.jobId, rel);
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, req.body?.content ?? "", "utf8");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to save file", details: e?.message });
  }
});

export default router;

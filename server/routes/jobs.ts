import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const router = Router();
const PREVIEWS_ROOT = path.resolve(process.env.PREVIEWS_DIR || "public/previews");

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

// POST /api/generate  → creates a minimal site immediately
router.post("/generate", async (req, res) => {
  try {
    const jobId = randomUUID();
    const jobDir = path.join(PREVIEWS_ROOT, jobId);
    await ensureDir(jobDir);

    const prompt = (req.body?.prompt ?? "").toString();

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>YBuilt – ${jobId.slice(0,8)}</title>
  <link rel="stylesheet" href="./styles.css"/>
</head>
<body>
  <main>
    <h1>${prompt ? "Your project" : "Hello"}</h1>
    <p>${prompt || "This site was just generated."}</p>
  </main>
</body>
</html>`;

    const css = `:root{--background:0 0% 100%;--foreground:0 0% 10%}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;padding:2rem;background:hsl(var(--background));color:hsl(var(--foreground));font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto}
h1{font-size:clamp(28px,4vw,42px);margin:0 0 12px}
p{opacity:.8}`;

    await fs.writeFile(path.join(jobDir, "index.html"), html, "utf8");
    await fs.writeFile(path.join(jobDir, "styles.css"), css, "utf8");
    await fs.writeFile(
      path.join(jobDir, "manifest.json"),
      JSON.stringify(
        { name: "YBuilt Project", description: prompt || "Generated project", entryPoint: "index.html" },
        null, 2
      ),
      "utf8"
    );

    res.status(201).json({ jobId });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create job", details: err?.message });
  }
});

// GET /api/jobs/:jobId → simple status
router.get("/jobs/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  try {
    await fs.access(path.join(PREVIEWS_ROOT, jobId, "index.html"));
    res.json({ id: jobId, status: "ready" });
  } catch {
    res.status(404).json({ error: "Job not found" });
  }
});

// POST /api/jobs/:jobId/build → no-op build (preview already created)
router.post("/jobs/:jobId/build", async (req, res) => {
  const jobId = req.params.jobId;
  res.status(202).json({ status: "build_started", previewUrl: `/previews/${jobId}/index.html` });
});

export default router;

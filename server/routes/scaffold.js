import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

// safety: only kebab/letters/numbers
function validName(s = "") { return /^[a-z0-9-]+$/i.test(s); }

const ROOT = path.resolve(".");
const ROUTES_DIR = path.join(ROOT, "server", "routes");
const CLIENT_API_DIR = path.join(ROOT, "client", "src", "lib", "api");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

router.post("/api", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!validName(name)) return res.status(400).json({ error: "bad name" });

    ensureDir(ROUTES_DIR);
    const file = path.join(ROUTES_DIR, `${name}.js`);
    if (fs.existsSync(file)) return res.status(409).json({ error: "route exists", file });

    const contents = `import express from "express";
const router = express.Router();

// GET /api/${name}
router.get("/", async (req, res) => {
  res.json({ ok: true, route: "/api/${name}" });
});

// POST /api/${name}
router.post("/", async (req, res) => {
  res.json({ ok: true, received: req.body || null });
});

export default router;
`;
    fs.writeFileSync(file, contents, "utf8");

    return res.json({
      ok: true,
      file,
      mount: {
        importLine: `const { default: ${name}Router } = await import('./routes/${name}.js');`,
        useLine:    `if (${name}Router) app.use('/api/${name}', express.json(), ${name}Router);`,
      },
      note: "Add the two mount lines to server/index.ts near other routers.",
    });
  } catch (e) {
    return res.status(500).json({ error: "scaffold failed" });
  }
});

router.post("/client", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!validName(name)) return res.status(400).json({ error: "bad name" });

    const base = `/api/${name}`;
    ensureDir(CLIENT_API_DIR);
    const file = path.join(CLIENT_API_DIR, `${name}.ts`);
    if (fs.existsSync(file)) return res.status(409).json({ error: "client hook exists", file });

    const contents = `export async function get${pascal(name)}() {
  const r = await fetch('${base}');
  if (!r.ok) throw new Error('GET ${base} ' + r.status);
  return r.json();
}

export async function post${pascal(name)}(body: any) {
  const r = await fetch('${base}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('POST ${base} ' + r.status);
  return r.json();
}

function ${"pascal"}(s: string) { // local helper for generated file
  return s.split(/[-_\\s]+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('');
}
`;
    fs.writeFileSync(file, contents, "utf8");
    return res.json({ ok: true, file });
  } catch (e) {
    return res.status(500).json({ error: "client hook scaffold failed" });
  }
});

export default router;

// tiny local helper for the server file
function pascal(s){ return s.split(/[-_\\s]+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(''); }

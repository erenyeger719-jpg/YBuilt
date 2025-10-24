// server/routes/comments.js
const fs = require("fs");
const path = require("path");

function safeDir(previewPath) {
  const rel = String(previewPath || "").replace(/^\/+/, "").replace(/\.\./g, "");
  return path.join(process.cwd(), rel);
}
function ensureFile(fp) {
  try { fs.mkdirSync(path.dirname(fp), { recursive: true }); } catch {}
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify({ comments: [] }, null, 2));
}
function load(absDir) {
  const f = path.join(absDir, ".comments.json");
  ensureFile(f);
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return { comments: [] }; }
}
function save(absDir, data) {
  const f = path.join(absDir, ".comments.json");
  ensureFile(f);
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

exports.list = (req, res) => {
  try {
    const pp = req.query?.path;
    if (!pp) return res.json({ ok: true, comments: [] }); // be lenient
    const db = load(safeDir(pp));
    const file = req.query?.file;
    const items = file ? (db.comments || []).filter(c => c.file === file) : (db.comments || []);
    res.json({ ok: true, comments: items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "list failed" });
  }
};

exports.add = (req, res) => {
  try {
    const { path: pp, file, text, startLine, endLine, meta } = req.body || {};
    if (!pp || !file || !text) return res.status(400).json({ ok: false, error: "bad args" });
    const db = load(safeDir(pp));
    const c = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      file, text,
      startLine: Number.isFinite(startLine) ? startLine : undefined,
      endLine: Number.isFinite(endLine) ? endLine : undefined,
      meta: meta || {},
      status: "open",
      createdAt: Date.now(),
    };
    db.comments = [c, ...(db.comments || [])];
    save(safeDir(pp), db);
    res.json({ ok: true, comment: c });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "add failed" });
  }
};

exports.resolve = (req, res) => {
  try {
    const { path: pp, id } = req.body || {};
    if (!pp || !id) return res.status(400).json({ ok: false, error: "bad args" });
    const db = load(safeDir(pp));
    db.comments = (db.comments || []).map(c => c.id === id ? { ...c, status: "resolved" } : c);
    save(safeDir(pp), db);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "resolve failed" });
  }
};

exports.remove = (req, res) => {
  try {
    const { path: pp, id } = req.body || {};
    if (!pp || !id) return res.status(400).json({ ok: false, error: "bad args" });
    const db = load(safeDir(pp));
    db.comments = (db.comments || []).filter(c => c.id !== id);
    save(safeDir(pp), db);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "remove failed" });
  }
};

// ESM/CJS interop safety
module.exports.default = module.exports;

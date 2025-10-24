const fs = require("fs");
const path = require("path");

function safePath(previewPath) {
  const rel = String(previewPath || "").replace(/^\/+/, "").replace(/\.\./g, "");
  return path.join(process.cwd(), rel); // previews live under repo root
}
function commentsFile(absPreviewDir) {
  return path.join(absPreviewDir, ".comments.json");
}
function readComments(absPreviewDir) {
  try {
    const p = commentsFile(absPreviewDir);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf8") || "[]");
  } catch { return []; }
}
function writeComments(absPreviewDir, list) {
  fs.writeFileSync(commentsFile(absPreviewDir), JSON.stringify(list, null, 2));
}

exports.list = (req, res) => {
  try {
    const abs = safePath(req.query.path);
    const items = readComments(abs);
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "list failed" });
  }
};

exports.add = (req, res) => {
  try {
    const { path: previewPath, file, startLine, endLine, text, author } = req.body || {};
    const abs = safePath(previewPath);
    const items = readComments(abs);
    const it = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      file, startLine, endLine,
      text: String(text || "").slice(0, 2000),
      author: author || { name: "Anon" },
      createdAt: Date.now(),
      resolved: false,
    };
    items.unshift(it);
    writeComments(abs, items);
    res.json({ ok: true, item: it });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "add failed" });
  }
};

exports.resolve = (req, res) => {
  try {
    const { path: previewPath, id, resolved } = req.body || {};
    const abs = safePath(previewPath);
    const items = readComments(abs);
    const idx = items.findIndex(x => x.id === id);
    if (idx >= 0) items[idx].resolved = !!resolved;
    writeComments(abs, items);
    res.json({ ok: true, item: items[idx] || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "resolve failed" });
  }
};

import fs from "fs";
import path from "path";

const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || "previews");

function safeCommentsFile(previewPath) {
  if (typeof previewPath !== "string") throw new Error("path required");
  const rel = previewPath.replace(/^\/+/, "");               // strip leading /
  if (!rel.startsWith("previews/")) throw new Error("bad path");
  const absDir = path.resolve(PREVIEWS_DIR, rel.replace(/^previews\//, ""));
  if (!absDir.startsWith(PREVIEWS_DIR)) throw new Error("escape blocked");
  return path.join(absDir, ".comments.json");
}

function readStore(fp) {
  try {
    const raw = fs.existsSync(fp) ? fs.readFileSync(fp, "utf8") : "";
    const json = raw ? JSON.parse(raw) : { items: [] };
    if (!Array.isArray(json.items)) json.items = [];
    return json;
  } catch {
    return { items: [] };
  }
}

function writeStore(fp, data) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify({ items: data.items || [] }, null, 2), "utf8");
}

export async function list(req, res) {
  try {
    const previewPath = String(req.query.path || "");
    const fp = safeCommentsFile(previewPath);
    const store = readStore(fp);
    res.json({ ok: true, items: store.items });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

export async function add(req, res) {
  try {
    const { path: previewPath, file, text, startLine, endLine, author } = req.body || {};
    const fp = safeCommentsFile(String(previewPath || ""));
    const store = readStore(fp);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const item = {
      id,
      file: String(file || "index.html"),
      text: String(text || ""),
      startLine: typeof startLine === "number" ? startLine : undefined,
      endLine: typeof endLine === "number" ? endLine : undefined,
      author: author && author.name ? { name: String(author.name) } : { name: "Anon" },
      createdAt: Date.now(),
      resolved: false,
    };
    store.items.unshift(item);
    writeStore(fp, store);
    res.json({ ok: true, item });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

export async function resolve(req, res) {
  try {
    const { path: previewPath, id, resolved } = req.body || {};
    const fp = safeCommentsFile(String(previewPath || ""));
    const store = readStore(fp);
    const idx = store.items.findIndex((x) => x.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "not found" });
    store.items[idx] = { ...store.items[idx], resolved: !!resolved };
    writeStore(fp, store);
    res.json({ ok: true, item: store.items[idx] });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

export default { list, add, resolve };

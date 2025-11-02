// server/code/brain.ts
import fs from "fs";
import path from "path";

const ROOT = process.env.WORKSPACE_ROOT || process.cwd();
const EXCLUDE_DIRS = new Set(["node_modules", ".git", ".cache", "dist", "build", ".next", "out"]);
const MAX_FILE_BYTES = 1_000_000; // 1MB guard
const UNDO_FILE = path.join(ROOT, ".cache", "code-undo.jsonl");

function isSafePath(p: string) {
  const abs = path.resolve(ROOT, p);
  return abs.startsWith(path.resolve(ROOT)) && !/(\.\.|\/\/)/.test(p);
}
function isLikelyText(fp: string) {
  const ext = path.extname(fp).toLowerCase();
  return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss", ".md", ".html", ".json", ".yml", ".yaml", ".test.ts", ".test.js"].some(e => fp.toLowerCase().endsWith(e) || path.extname(fp).toLowerCase() === e);
}

export type TreeNode = { name: string; path: string; type: "file"|"dir"; children?: TreeNode[]; size?: number };

export function listTree(rel = "."): TreeNode {
  const base = path.resolve(ROOT, rel);
  const name = path.basename(base);
  const node: TreeNode = { name, path: path.relative(ROOT, base) || ".", type: "dir", children: [] };
  const items = fs.readdirSync(base, { withFileTypes: true });
  for (const d of items) {
    if (EXCLUDE_DIRS.has(d.name)) continue;
    const child = path.join(base, d.name);
    if (d.isDirectory()) {
      node.children!.push(listTree(path.relative(ROOT, child)));
    } else {
      if (!isLikelyText(child)) continue;
      const st = fs.statSync(child);
      node.children!.push({ name: d.name, path: path.relative(ROOT, child), type: "file", size: st.size });
    }
  }
  node.children!.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  return node;
}

export function readText(relPath: string): { path: string; content: string } {
  if (!isSafePath(relPath)) throw new Error("unsafe_path");
  const abs = path.join(ROOT, relPath);
  const st = fs.statSync(abs);
  if (st.size > MAX_FILE_BYTES) throw new Error("too_large");
  if (!isLikelyText(abs)) throw new Error("unsupported");
  return { path: relPath, content: fs.readFileSync(abs, "utf8") };
}

type ProposeIn = { path: string; instruction: string; selection?: { start: number; end: number } };
type ProposeOut = { newContent: string; summary: string[] };

export function proposeEdit(input: ProposeIn): ProposeOut {
  const { path: relPath, instruction } = input;
  const { content } = readText(relPath);
  const text = content;
  const summary: string[] = [];
  let out = text;

  const instr = instruction.trim().toLowerCase();

  // 1) Rename: "rename X to Y"
  const rename = instr.match(/rename\s+([a-zA-Z0-9_$]+)\s+to\s+([a-zA-Z0-9_$]+)/);
  if (rename) {
    const [, from, to] = rename;
    const re = new RegExp(`\\b${from}\\b`, "g");
    const before = out;
    out = out.replace(re, to);
    if (out !== before) summary.push(`renamed ${from} → ${to}`);
  }

  // 2) Axios → fetch
  if (instr.includes("replace axios") || instr.includes("axios to fetch")) {
    const before = out;
    out = out
      .replace(/import\s+axios[^;]*;?\n?/g, "")
      .replace(/axios\.get\(([^)]+)\)/g, "fetch($1).then(r=>r.json())")
      .replace(/axios\.post\(([^,]+),\s*([^)]+)\)/g, "fetch($1,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify($2)}).then(r=>r.json())");
    if (out !== before) summary.push("replaced axios with fetch where trivial");
  }

  // 3) Sticky header (desktop-only)
  if (instr.includes("sticky") && instr.includes("header")) {
    if (/\.css$|\.scss$/.test(relPath)) {
      if (!out.includes(".site-header")) {
        out += `\n.site-header { position: sticky; top: 0; z-index: 50; }\n`;
        summary.push("added .site-header sticky rule");
      }
      out += `\n@media (max-width: 767px){ .site-header{ position: static; } }\n`;
      summary.push("desktop-only sticky (mobile static)");
    }
  }

  // 4) Soften claims (marketing text)
  if (instr.includes("soften") || instr.includes("soft claim") || instr.includes("reduce superlatives")) {
    const map: [RegExp, string][] = [
      [/\b(best|#1|number\s*one)\b/gi, "leading"],
      [/\bguaranteed\b/gi, "designed"],
      [/\bfastest\b/gi, "faster"],
      [/\bunlimited\b/gi, "generous"],
    ];
    let changed = 0;
    for (const [re, repl] of map) {
      const before = out;
      out = out.replace(re, repl);
      if (out !== before) changed++;
    }
    if (changed) summary.push(`softened ${changed} superlative${changed > 1 ? "s" : ""}`);
  }

  if (summary.length === 0) summary.push("no-op (instruction not recognized for this file)");
  return { newContent: out, summary };
}

export function applyWrite(relPath: string, newContent: string, dryRun = false): { ok: true } {
  if (!isSafePath(relPath)) throw new Error("unsafe_path");
  const abs = path.join(ROOT, relPath);
  const before = fs.readFileSync(abs, "utf8");
  if (dryRun) return { ok: true };
  fs.mkdirSync(path.dirname(UNDO_FILE), { recursive: true });

  const tmp = abs + ".tmp-" + Date.now();
  fs.writeFileSync(tmp, newContent, "utf8");
  fs.renameSync(tmp, abs);

  const row = JSON.stringify({ ts: Date.now(), path: relPath, before, after: newContent }) + "\n";
  fs.appendFileSync(UNDO_FILE, row, "utf8");
  return { ok: true };
}

/** -----------------------------------------------------------
 * Explain (heuristic, deterministic, zero-LLM)
 * ---------------------------------------------------------- */
function langOf(p: string) {
  const ext = path.extname(p).toLowerCase();
  if (p.endsWith(".tsx") || p.endsWith(".jsx")) return "react";
  if (ext === ".ts" || ext === ".js" || ext === ".mjs" || ext === ".cjs") return "js";
  if (ext === ".css" || ext === ".scss") return "css";
  if (ext === ".html") return "html";
  if (ext === ".md") return "md";
  if (ext === ".json" || ext === ".yml" || ext === ".yaml") return "data";
  return "text";
}

export function explainAt(relPath: string, line?: number, selection?: { start: number; end: number }) {
  const { content } = readText(relPath);
  const lang = langOf(relPath);
  const lines = content.split("\n");
  const L = lines.length;

  const windowed = (() => {
    if (selection && Number.isFinite(selection.start) && Number.isFinite(selection.end)) {
      const s = Math.max(0, Math.min(L - 1, selection.start));
      const e = Math.max(s, Math.min(L - 1, selection.end));
      return lines.slice(s, e + 1);
    }
    if (line && Number.isFinite(line)) {
      const idx = Math.max(0, Math.min(L - 1, line - 1));
      const from = Math.max(0, idx - 3);
      const to = Math.min(L - 1, idx + 3);
      return lines.slice(from, to + 1);
    }
    return lines.slice(0, Math.min(200, L));
  })().join("\n");

  const bullets: string[] = [];

  if (lang === "react" || /<\w+/.test(windowed)) {
    bullets.push("This looks like a React component or JSX markup.");
    if (/use(State|Effect|Memo|Callback|Ref)\(/.test(windowed)) bullets.push("It uses React hooks for state/effects.");
    if (/export\s+default\s+function|const\s+\w+\s*=\s*\(/.test(windowed)) bullets.push("Defines a component/function that is exported.");
  }
  if (lang === "js") {
    if (/import\s+.*from\s+['"].+['"]/.test(windowed)) bullets.push("Imports modules at the top.");
    if (/async\s+function|\bawait\b/.test(windowed)) bullets.push("Contains async/await flow.");
    if (/fetch\(/.test(windowed)) bullets.push("Makes network requests with fetch().");
  }
  if (lang === "css") {
    const selCount = (windowed.match(/{/g) || []).length;
    bullets.push(`CSS rules (~${selCount} in focus).`);
    if (/position:\s*sticky/.test(windowed)) bullets.push("Implements a sticky element (likely header).");
    if (/@media\s*\(max-width:/.test(windowed)) bullets.push("Has responsive behavior via media queries.");
  }
  if (lang === "html") {
    if (/<header|<nav|<main|<footer/.test(windowed)) bullets.push("Semantic layout elements are present.");
    if (/data-file=/.test(windowed)) bullets.push("Preview elements are annotated with data-file/data-line for source jumps.");
  }
  if (/describe\(|it\(|test\(/.test(windowed)) bullets.push("Contains tests (Jest/Vitest style).");
  if (/axios\./.test(windowed)) bullets.push("Uses axios; you can auto-convert trivial calls to fetch via the Propose flow.");

  if (bullets.length === 0) bullets.push("Plain text/code snippet; nothing unusual detected.");

  const summary = bullets.join(" ");
  const focusLines: [number, string][] = windowed
    .split("\n")
    .map((s, i) => [i + 1, s] as [number, string]);

  return { summary, lines: focusLines };
}

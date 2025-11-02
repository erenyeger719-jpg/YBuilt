// server/routes/code.ts
import express, { Router } from "express";
import type { Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { listTree, readText, proposeEdit, applyWrite, explainAt } from "../code/brain.ts";

const router = Router();
router.use(express.json()); // simple, ESM-safe

function bad(res: Response, msg: string, code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}

// --- health ping (guard visibility) ---
router.get("/health", (_req, res) => {
  res.json({ ok: true, guard: shouldHardGate() });
});

/* ----------------------- Contracts Hard Gate (server-side) -----------------------
   Goal: Belt-and-suspenders gate for code edits/migrations/tests.
   Behavior:
   - If CODE_HARD_GUARD !== '0' (default ON), any write passes these heuristics:
     1) Size budgets (per-file): max 1.5 MB, max +400 KB delta.
     2) JS/TS: forbid eval/new Function, unsafe innerHTML assignment.
     3) HTML/JSX: flag <img> without alt (accessibility).
   - Returns { ok:false, reasons:[...] } but keeps HTTP 200 so the client can show reasons.
---------------------------------------------------------------------------------- */
function shouldHardGate() {
  return process.env.CODE_HARD_GUARD !== "0";
}

type GateResult = { ok: true } | { ok: false; reasons: string[] };

function gateFileChange(filePath: string, before: string, after: string): GateResult {
  if (!shouldHardGate()) return { ok: true };

  const reasons: string[] = [];
  const ext = path.extname(filePath).toLowerCase();
  const isText = /\.(tsx?|jsx?|css|html?|mdx?|json|ya?ml|txt)$/i.test(ext);
  if (!isText) return { ok: true };

  const afterBytes = Buffer.byteLength(after, "utf8");
  const beforeBytes = Buffer.byteLength(before || "", "utf8");
  const delta = afterBytes - beforeBytes;

  // 1) Size budgets
  const MAX_FILE_BYTES = 1_500_000; // ~1.5 MB
  const MAX_DELTA_BYTES = 400_000; // +400 KB
  if (afterBytes > MAX_FILE_BYTES) {
    reasons.push(`file too large: ${afterBytes} bytes (limit ${MAX_FILE_BYTES})`);
  }
  if (delta > MAX_DELTA_BYTES) {
    reasons.push(`delta too large: +${delta} bytes (limit +${MAX_DELTA_BYTES})`);
  }

  const lower = after.toLowerCase();

  // 2) JS safety
  if (/\.(m?js|c?ts|tsx|jsx)$/i.test(ext)) {
    if (/\beval\s*\(/.test(after)) reasons.push("forbidden: eval()");
    if (/\bnew\s+Function\s*\(/.test(after)) reasons.push("forbidden: new Function()");
    // naive innerHTML assignment detection
    if (/\.\s*innerhtml\s*=/.test(lower)) reasons.push("forbidden: direct innerHTML assignment");
  }

  // 3) HTML/JSX alt text
  if (/\.(tsx|jsx|html?)$/i.test(ext)) {
    // crude: <img ...> without alt= (ignore cases where alt="")
    const imgTags = after.match(/<img\b[^>]*>/gi) || [];
    for (const tag of imgTags) {
      if (!/\balt\s*=/.test(tag)) {
        reasons.push("accessibility: <img> missing alt attribute");
        break;
      }
    }
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

// ---------- existing endpoints ----------
router.get("/tree", (req, res) => {
  try {
    const root = String(req.query.root || ".");
    const tree = listTree(root);
    res.json({ ok: true, tree });
  } catch (e: any) {
    bad(res, e?.message || "tree_error");
  }
});

router.get("/read", (req, res) => {
  try {
    const p = String(req.query.path || "");
    if (!p) return bad(res, "missing path");
    const r = readText(p);
    res.json({ ok: true, ...r });
  } catch (e: any) {
    bad(res, e?.message || "read_error");
  }
});

router.post("/propose", (req, res) => {
  try {
    const { path: p, instruction, selection } = req.body || {};
    if (!p || !instruction) return bad(res, "missing path/instruction");
    const out = proposeEdit({ path: p, instruction, selection });
    res.json({ ok: true, ...out });
  } catch (e: any) {
    bad(res, e?.message || "propose_error");
  }
});

router.post("/apply", (req, res) => {
  try {
    const { path: p, newContent, dryRun } = req.body || {};
    if (!p || typeof newContent !== "string") return bad(res, "missing path/newContent");

    // --- server hard-gate (safe for new files) ---
    let before = "";
    try {
      const r0 = readText(p);
      before = (r0.content as string) || "";
    } catch {
      before = ""; // new file case
    }
    const gate = gateFileChange(p, before, String(newContent));
    if (!gate.ok) {
      return res.json({ ok: false, error: "contracts_failed", reasons: gate.reasons });
    }

    const out = applyWrite(p, String(newContent), Boolean(dryRun));
    res.json({ ok: true, ...out });
  } catch (e: any) {
    bad(res, e?.message || "apply_error");
  }
});

router.post("/explain", (req, res) => {
  try {
    const { path: p, line, selection } = req.body || {};
    if (!p) return bad(res, "missing path");
    const out = explainAt(p, Number.isFinite(Number(line)) ? Number(line) : undefined, selection);
    res.json({ ok: true, ...out });
  } catch (e: any) {
    bad(res, e?.message || "explain_error");
  }
});

// ---------- NEW: ultra-light A/B scaffold for code edits ----------
const AB_FILE = path.join(process.cwd(), ".cache", "code-ab.jsonl");
function appendAB(row: any) {
  fs.mkdirSync(path.dirname(AB_FILE), { recursive: true });
  try {
    if (fs.existsSync(AB_FILE)) {
      const s = fs.statSync(AB_FILE);
      if (s.size > 8 * 1024 * 1024) {
        // ~8MB
        const stamp = new Date().toISOString().slice(0, 10);
        const rotated = AB_FILE.replace(/\.jsonl$/i, `.${stamp}.jsonl`);
        try {
          fs.renameSync(AB_FILE, rotated);
        } catch {}
      }
    }
  } catch {}
  fs.appendFileSync(AB_FILE, JSON.stringify(row) + "\n", "utf8");
}

router.post("/ab/start", (req, res) => {
  try {
    const { path: p, aContent, bContent, note } = req.body || {};
    if (!p || typeof aContent !== "string" || typeof bContent !== "string") {
      return bad(res, "missing path/aContent/bContent");
    }
    const id =
      // @ts-ignore
      (crypto as any).randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
    appendAB({
      type: "start",
      id,
      path: p,
      aLen: aContent.length,
      bLen: bContent.length,
      note: note || null,
      ts: Date.now(),
    });
    res.json({ ok: true, id });
  } catch (e: any) {
    bad(res, e?.message || "ab_start_error");
  }
});

router.post("/ab/mark", (req, res) => {
  try {
    const { id, arm, event } = req.body || {};
    if (!id || !["A", "B"].includes(arm) || !["seen", "convert"].includes(event)) {
      return bad(res, "missing/invalid id|arm|event");
    }
    appendAB({ type: "mark", id, arm, event, ts: Date.now() });
    res.json({ ok: true });
  } catch (e: any) {
    bad(res, e?.message || "ab_mark_error");
  }
});

router.get("/ab/stats", (req, res) => {
  try {
    const id = String(req.query.id || "");
    if (!id) return bad(res, "missing id");
    if (!fs.existsSync(AB_FILE))
      return res.json({
        ok: true,
        id,
        A: { seen: 0, convert: 0, cr: 0 },
        B: { seen: 0, convert: 0, cr: 0 },
      });
    const lines = fs.readFileSync(AB_FILE, "utf8").trim().split("\n").filter(Boolean);
    let aSeen = 0,
      aConv = 0,
      bSeen = 0,
      bConv = 0;
    for (const ln of lines) {
      try {
        const row = JSON.parse(ln);
        if (row.id !== id || row.type !== "mark") continue;
        if (row.arm === "A" && row.event === "seen") aSeen++;
        if (row.arm === "A" && row.event === "convert") aConv++;
        if (row.arm === "B" && row.event === "seen") bSeen++;
        if (row.arm === "B" && row.event === "convert") bConv++;
      } catch {}
    }
    const A = { seen: aSeen, convert: aConv, cr: aSeen ? aConv / aSeen : 0 };
    const B = { seen: bSeen, convert: bConv, cr: bSeen ? bConv / bSeen : 0 };
    res.json({ ok: true, id, A, B });
  } catch (e: any) {
    bad(res, e?.message || "ab_stats_error");
  }
});

// ---------- NEW: Test-aware edits (Vitest/Jest scaffolder) ----------
function toPosix(p: string) {
  return p.replace(/\\/g, "/");
}
function defaultTestPathFor(sourcePath: string) {
  const ext = path.extname(sourcePath).toLowerCase();
  const base = path.basename(sourcePath, ext);
  const dir = path.dirname(sourcePath);
  const testDir = path.join(dir, "__tests__");
  const isReact = ext === ".tsx" || ext === ".jsx";
  const testExt = isReact ? ".test.tsx" : ".test.ts";
  return path.join(testDir, `${base}${testExt}`);
}
function relativeImport(fromFile: string, toFile: string) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile).replace(/\\/g, "/");
  // strip extension for TS resolution
  rel = rel.replace(/\.(tsx|ts|jsx|js)$/i, "");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}
function makeReactTest(importPath: string, defaultNameGuess = "Component") {
  return `/* @vitest-environment jsdom */
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import ${defaultNameGuess} from "${importPath}";

describe("${defaultNameGuess}", () => {
  it("renders without crashing", () => {
    render(<${defaultNameGuess} />);
  });
});
`;
}
function scanExportedFns(src: string): string[] {
  const names = new Set<string>();
  const re1 = /export\s+function\s+([A-Za-z0-9_]+)/g;
  const re2 = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*\(/g;
  const re3 = /export\s*{\s*([A-Za-z0-9_,\s]+)\s*}/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(src))) names.add(m[1]);
  while ((m = re2.exec(src))) names.add(m[1]);
  while ((m = re3.exec(src))) {
    m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((n) => names.add(n));
  }
  return Array.from(names);
}
function makeLibTest(importPath: string, fns: string[]) {
  const imports = fns.length ? `{ ${fns.join(", ")} }` : "* as mod";
  const subject = fns.length ? fns[0] : "mod";
  const isFn = fns.length ? `typeof ${subject} === "function"` : `typeof ${subject} === "object"`;
  return `import { describe, it, expect } from "vitest";
import ${imports} from "${importPath}";

describe("${importPath.split("/").pop()}", () => {
  it("loads the module", () => {
    expect(${isFn}).toBe(true);
  });
});
`;
}

router.post("/tests/propose", (req, res) => {
  try {
    const { sourcePath, targetPath, framework } = req.body || {};
    if (!sourcePath) return bad(res, "missing sourcePath");

    // read source
    const r = readText(String(sourcePath));
    const src = r.content || "";
    const ext = path.extname(sourcePath).toLowerCase();
    const isReact = /from\s+['"]react['"]/.test(src) || ext === ".tsx" || ext === ".jsx";
    const testPath = targetPath || defaultTestPathFor(String(sourcePath));
    const importPath = relativeImport(testPath, sourcePath);

    // crude guess for default export name
    let defaultName = "Component";
    const m = /export\s+default\s+function\s+([A-Za-z0-9_]+)/.exec(src);
    if (m && m[1]) defaultName = m[1];

    const newContent = isReact
      ? makeReactTest(importPath, defaultName)
      : makeLibTest(importPath, scanExportedFns(src));

    const summary = [
      `create ${toPosix(testPath)}`,
      isReact ? "react component render test (jsdom)" : "module smoke test",
      framework ? `framework=${framework}` : "framework=vitest (default)",
    ];

    return res.json({ ok: true, testPath, newContent, summary });
  } catch (e: any) {
    return bad(res, e?.message || "tests_propose_error");
  }
});

router.post("/tests/apply", (req, res) => {
  try {
    const { testPath, newContent, dryRun } = req.body || {};
    if (!testPath || typeof newContent !== "string") return bad(res, "missing testPath/newContent");

    // --- server hard-gate for the new test file (safe for new files) ---
    let before = "";
    try {
      const r0 = readText(String(testPath));
      before = (r0.content as string) || "";
    } catch {
      before = "";
    }
    const gate = gateFileChange(String(testPath), before, String(newContent));
    if (!gate.ok) {
      return res.json({ ok: false, error: "contracts_failed", reasons: gate.reasons });
    }

    fs.mkdirSync(path.dirname(String(testPath)), { recursive: true });
    const out = applyWrite(String(testPath), String(newContent), Boolean(dryRun));
    return res.json({ ok: true, ...out });
  } catch (e: any) {
    return bad(res, e?.message || "tests_apply_error");
  }
});

// --- NEW: repo-wide migrate (preview/apply)
type MigrateParams = {
  dirPrefix?: string;
  find: string;
  replace: string;
  regex?: boolean;
  caseSensitive?: boolean;
  maxFiles?: number;
  dryRun?: boolean;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildReg(find: string, regex = false, caseSensitive = false) {
  const src = regex ? find : escapeRegExp(find);
  const flags = caseSensitive ? "g" : "gi";
  return new RegExp(src, flags);
}
function isTexty(p: string) {
  return /\.(tsx?|jsx?|css|html?|mdx?|md|json|ya?ml|txt)$/i.test(p);
}
function flattenTree(node: any, out: string[] = []) {
  if (!node) return out;
  if (node.type === "file") out.push(node.path);
  node.children?.forEach((c: any) => flattenTree(c, out));
  return out;
}

router.post("/migrate/preview", (req, res) => {
  try {
    const {
      dirPrefix = "",
      find,
      regex = false,
      caseSensitive = false,
      maxFiles = 1000,
    } = (req.body || {}) as MigrateParams;
    if (!find?.length) return bad(res, "missing find");

    const tree = listTree(".");
    const paths = flattenTree(tree);
    const re = buildReg(find, regex, caseSensitive);

    let total = 0,
      changed = 0;
    const items: { path: string; hits: number }[] = [];

    for (const p of paths) {
      if (!isTexty(p)) continue;
      if (dirPrefix && !p.replace(/\\/g, "/").startsWith(dirPrefix.replace(/\\/g, "/"))) continue;
      const r = readText(p);
      const txt = r.content || "";
      const hits = (txt.match(re) || []).length;
      total++;
      if (hits > 0) {
        changed++;
        items.push({ path: p, hits });
      }
      if (items.length >= maxFiles) break;
    }
    res.json({ ok: true, total, changed, items });
  } catch (e: any) {
    bad(res, e?.message || "migrate_preview_error");
  }
});

router.post("/migrate/apply", (req, res) => {
  try {
    const {
      dirPrefix = "",
      find,
      replace = "",
      regex = false,
      caseSensitive = false,
      maxFiles = 1000,
      dryRun = false,
    } = (req.body || {}) as MigrateParams;
    if (!find?.length) return bad(res, "missing find");

    const tree = listTree(".");
    const paths = flattenTree(tree);
    const re = buildReg(find, regex, caseSensitive);

    // First pass: compute candidates + gates (atomic all-or-nothing if any blocked)
    type Candidate = { path: string; before: string; next: string; bytesDelta: number };
    const candidates: Candidate[] = [];
    const blocked: { path: string; reasons: string[] }[] = [];

    for (const p of paths) {
      if (!isTexty(p)) continue;
      if (dirPrefix && !p.replace(/\\/g, "/").startsWith(dirPrefix.replace(/\\/g, "/"))) continue;

      const r = readText(p);
      const txt = r.content || "";
      if (!re.test(txt)) continue;
      re.lastIndex = 0;

      const next = txt.replace(re, replace);
      const cand: Candidate = {
        path: p,
        before: txt,
        next,
        bytesDelta: Buffer.byteLength(next, "utf8") - Buffer.byteLength(txt, "utf8"),
      };

      // Gate each candidate
      const gate = gateFileChange(p, txt, next);
      if (!gate.ok) blocked.push({ path: p, reasons: gate.reasons });
      candidates.push(cand);
      if (candidates.length >= maxFiles) break;
    }

    if (blocked.length) {
      // No writes; report clearly (HTTP 200; ok:false so UI shows reasons)
      return res.json({
        ok: false,
        error: "contracts_failed",
        blocked,
        touched: 0,
        results: candidates.map((c) => ({ path: c.path, bytesDelta: c.bytesDelta })),
      });
    }

    // Second pass: apply (or dry-run)
    let touched = 0;
    const results: { path: string; bytesDelta: number }[] = [];
    for (const c of candidates) {
      const out = applyWrite(c.path, c.next, Boolean(dryRun));
      touched += dryRun ? 0 : 1;
      results.push({ path: c.path, bytesDelta: c.bytesDelta });
    }

    res.json({ ok: true, touched, results, dryRun: Boolean(dryRun) });
  } catch (e: any) {
    bad(res, e?.message || "migrate_apply_error");
  }
});

export default router;

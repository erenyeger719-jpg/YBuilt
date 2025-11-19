// server/routes/collab.ask-file.ts
//
// Backend for "Ask AI about this file" (collab-aware).
//
// v1 goals:
// - Every request is scoped by workspaceId + projectId.
// - Collab auth is enforced when a scope is present.
// - Reads a real file from disk (relative path).
// - Returns a stub "answer" + selection metadata.
//
// Route (mounted at /api/collab):
//   POST /api/collab/ask-file
//     body: {
//       workspaceId: string;
//       projectId: string;
//       filePath: string;           // relative, e.g. "server/routes/chat.ts"
//       question: string;
//       selection?: { lineStart?: number; lineEnd?: number };
//     }
//
//   Response (200):
//     {
//       ok: true,
//       answer: string,
//       meta: {
//         workspaceId,
//         projectId,
//         filePath,
//         selection: { lineStart, lineEnd },
//         snippetPreview: string
//       }
//     }

import { Router } from "express";
import { requireCollabAccess } from "../collab/auth.ts";
import fs from "fs";
import path from "path";

const router = Router();

/**
 * Build the collab scope from either query or body.
 * Same pattern as logs/comments/chat.
 */
function collabScopeFromRequest(req: any) {
  const q = req.query || {};
  const b = req.body || {};

  const rawWorkspace =
    q.workspaceId ?? b.workspaceId ?? b.workspaceID ?? null;
  const rawProject =
    q.projectId ?? b.projectId ?? b.projectID ?? null;

  const workspaceId =
    rawWorkspace !== undefined && rawWorkspace !== null
      ? String(rawWorkspace)
      : null;

  const projectId =
    rawProject !== undefined && rawProject !== null
      ? String(rawProject)
      : null;

  return { workspaceId, projectId };
}

// Apply collab auth to this route.
// - No scope → no enforcement.
// - Scope present + no user → 403 from requireCollabAccess.
// - Scope present + user → allowed.
router.use(requireCollabAccess(collabScopeFromRequest));

function safeRelativePath(p: string): boolean {
  if (!p) return false;
  if (path.isAbsolute(p)) return false;
  if (p.includes("..")) return false;
  return /^[a-zA-Z0-9/_\-.]+$/.test(p);
}

function readFileSafe(relativePath: string): string | null {
  if (!safeRelativePath(relativePath)) return null;

  const baseDir = process.cwd();
  const full = path.join(baseDir, relativePath);

  try {
    return fs.readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

router.post("/ask-file", (req: any, res) => {
  const { workspaceId, projectId } = collabScopeFromRequest(req);
  const { filePath, question, selection } = req.body || {};

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({
      ok: false,
      error: "invalid_file_path",
    });
  }

  if (!question || typeof question !== "string") {
    return res.status(400).json({
      ok: false,
      error: "invalid_question",
    });
  }

  const fileContent = readFileSafe(filePath);
  if (fileContent == null) {
    return res.status(404).json({
      ok: false,
      error: "file_not_found",
    });
  }

  const lines = fileContent.split(/\r?\n/);
  let lineStart: number | null = null;
  let lineEnd: number | null = null;

  if (selection && typeof selection === "object") {
    const rawStart = Number((selection as any).lineStart);
    const rawEnd = Number((selection as any).lineEnd);

    if (!Number.isNaN(rawStart) && rawStart >= 1) {
      lineStart = Math.min(rawStart, lines.length);
    }
    if (!Number.isNaN(rawEnd) && rawEnd >= 1) {
      lineEnd = Math.min(rawEnd, lines.length);
    }

    if (lineStart !== null && lineEnd !== null && lineEnd < lineStart) {
      const tmp = lineStart;
      lineStart = lineEnd;
      lineEnd = tmp;
    }
  }

  if (lineStart === null || lineEnd === null) {
    lineStart = 1;
    lineEnd = Math.max(1, lines.length);
  }

  const snippet = lines.slice(lineStart - 1, lineEnd).join("\n");
  const snippetPreview =
    snippet.length > 4000 ? snippet.slice(0, 4000) : snippet;

  // v1: stub answer. Later we can call SUP /api/ai with this snippet.
  const answer = [
    "Ask-file backend stub.",
    `File: ${filePath}`,
    `Lines: ${lineStart}-${lineEnd}`,
    "",
    `Question: ${question}`,
  ].join("\n");

  return res.json({
    ok: true,
    answer,
    meta: {
      workspaceId,
      projectId,
      filePath,
      selection: { lineStart, lineEnd },
      snippetPreview,
    },
  });
});

export default router;

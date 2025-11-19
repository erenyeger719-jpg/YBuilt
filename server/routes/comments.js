// server/routes/comments.js
//
// Collaboration-aware comments API.
//
// Goals for v1:
// - Every meaningful read/write is scoped by workspaceId + projectId.
// - Collab auth is enforced when a scope is present.
// - Simple in-memory store for now (can be swapped for DB later).
//
// Routes:
//   GET    /api/comments
//          ?workspaceId=...&projectId=...&filePath=...
//   POST   /api/comments
//          { workspaceId, projectId, filePath?, body, parentId?, lineStart?, lineEnd? }
//   POST   /api/comments/:id/resolve
//          { workspaceId, projectId }
//   DELETE /api/comments/:id
//          { workspaceId, projectId }
//
// All successful responses use { ok: true, ... }.

import { Router } from "express";
import { requireCollabAccess } from "../collab/auth.ts";

const router = Router();

/**
 * Comment shape (in-memory only)
 * id: string
 * workspaceId: string
 * projectId: string
 * filePath?: string
 * body: string
 * parentId?: string
 * lineStart?: number
 * lineEnd?: number
 * resolved: boolean
 * createdAt: string (ISO)
 * updatedAt: string (ISO)
 */
const commentsByKey = new Map();

/**
 * Build the collab scope from either query or body.
 * This keeps behaviour consistent with logs:
 * - If both workspaceId and projectId are null → collab middleware is a no-op.
 * - If either is present → we require a logged-in principal.
 */
function collabScopeFromRequest(req) {
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

// Apply collab auth to all comment routes.
// - No scope → no enforcement (for now).
// - Scope present + no user → 403 from requireCollabAccess.
// - Scope present + user → allowed.
router.use(requireCollabAccess(collabScopeFromRequest));

function makeKey(workspaceId, projectId, filePath) {
  return `${workspaceId}::${projectId}::${filePath || ""}`;
}

function getBucket(workspaceId, projectId, filePath) {
  const key = makeKey(workspaceId, projectId, filePath);
  if (!commentsByKey.has(key)) commentsByKey.set(key, []);
  return commentsByKey.get(key);
}

function nowIso() {
  return new Date().toISOString();
}

function rid() {
  return `c_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// GET /api/comments?workspaceId=...&projectId=...&filePath=...
router.get("/", (req, res) => {
  const { workspaceId, projectId } = collabScopeFromRequest(req);
  const filePath = req.query.filePath
    ? String(req.query.filePath)
    : "";

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  const bucket = getBucket(workspaceId, projectId, filePath);
  return res.json({ ok: true, items: bucket });
});

// POST /api/comments
router.post("/", (req, res) => {
  const {
    workspaceId,
    projectId,
    filePath = "",
    body,
    parentId = null,
    lineStart = null,
    lineEnd = null,
  } = req.body || {};

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  if (!body || typeof body !== "string") {
    return res.status(400).json({
      ok: false,
      error: "invalid_body",
    });
  }

  const bucket = getBucket(workspaceId, projectId, filePath);
  const ts = nowIso();
  const comment = {
    id: rid(),
    workspaceId: String(workspaceId),
    projectId: String(projectId),
    filePath: filePath ? String(filePath) : "",
    body,
    parentId: parentId ? String(parentId) : null,
    lineStart:
      lineStart === null || lineStart === undefined
        ? null
        : Number(lineStart),
    lineEnd:
      lineEnd === null || lineEnd === undefined
        ? null
        : Number(lineEnd),
    resolved: false,
    createdAt: ts,
    updatedAt: ts,
  };

  bucket.push(comment);

  return res.status(201).json({ ok: true, item: comment });
});

// POST /api/comments/:id/resolve
router.post("/:id/resolve", (req, res) => {
  const { workspaceId, projectId } = collabScopeFromRequest(req);
  const id = String(req.params.id || "");

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  const allBucketsKeys = Array.from(commentsByKey.keys());
  let updated = null;

  for (const key of allBucketsKeys) {
    const bucket = commentsByKey.get(key);
    if (!Array.isArray(bucket)) continue;

    for (const comment of bucket) {
      if (
        comment.id === id &&
        comment.workspaceId === workspaceId &&
        comment.projectId === projectId
      ) {
        comment.resolved = true;
        comment.updatedAt = nowIso();
        updated = comment;
        break;
      }
    }

    if (updated) break;
  }

  if (!updated) {
    return res.status(404).json({
      ok: false,
      error: "not_found",
    });
  }

  return res.json({ ok: true, item: updated });
});

// DELETE /api/comments/:id
router.delete("/:id", (req, res) => {
  const { workspaceId, projectId } = collabScopeFromRequest(req);
  const id = String(req.params.id || "");

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  const allBucketsKeys = Array.from(commentsByKey.keys());
  let removed = false;

  for (const key of allBucketsKeys) {
    const bucket = commentsByKey.get(key);
    if (!Array.isArray(bucket)) continue;

    const before = bucket.length;
    const after = bucket.filter(
      (c) =>
        !(
          c.id === id &&
          c.workspaceId === workspaceId &&
          c.projectId === projectId
        )
    );

    if (after.length !== before) {
      commentsByKey.set(key, after);
      removed = true;
      break;
    }
  }

  if (!removed) {
    return res.status(404).json({
      ok: false,
      error: "not_found",
    });
  }

  return res.json({ ok: true });
});

export default router;

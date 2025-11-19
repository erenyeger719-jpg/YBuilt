// server/routes/chat.ts
//
// Collaboration-aware chat API.
//
// Goals for v1:
// - Every meaningful read/write is scoped by workspaceId + projectId.
// - Collab auth is enforced when a scope is present.
// - Simple in-memory store for now (can be swapped for DB later).
//
// Routes (mounted at /api/chat):
//   GET    /api/chat/messages
//          ?workspaceId=...&projectId=...&threadId=...
//   POST   /api/chat/messages
//          { workspaceId, projectId, threadId?, text }
//   DELETE /api/chat/messages/:id
//          { workspaceId, projectId }
//
// All successful responses use { ok: true, ... }.

import { Router } from "express";
import { requireCollabAccess } from "../collab/auth.ts";

const router = Router();

/**
 * Chat message shape (in-memory only)
 * id: string
 * workspaceId: string
 * projectId: string
 * threadId: string
 * text: string
 * authorId: string | null
 * createdAt: string (ISO)
 */
const messagesByKey = new Map<string, any[]>();

/**
 * Build the collab scope from either query or body.
 * This keeps behaviour consistent with logs/comments:
 * - If both workspaceId and projectId are null → collab middleware is a no-op.
 * - If either is present → we require a logged-in principal.
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

// Apply collab auth to all chat routes.
// - No scope → no enforcement.
// - Scope present + no user → 403 from requireCollabAccess.
// - Scope present + user → allowed.
router.use(requireCollabAccess(collabScopeFromRequest));

function makeKey(workspaceId: string, projectId: string, threadId?: string) {
  return `${workspaceId}::${projectId}::${threadId || "main"}`;
}

function getBucket(workspaceId: string, projectId: string, threadId?: string) {
  const key = makeKey(workspaceId, projectId, threadId);
  if (!messagesByKey.has(key)) messagesByKey.set(key, []);
  return messagesByKey.get(key)!;
}

function nowIso() {
  return new Date().toISOString();
}

function rid() {
  return `m_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// GET /api/chat/messages?workspaceId=...&projectId=...&threadId=...
router.get("/messages", (req, res) => {
  const { workspaceId, projectId } = collabScopeFromRequest(req);
  const threadId = req.query.threadId
    ? String(req.query.threadId)
    : "main";

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  const bucket = getBucket(workspaceId, projectId, threadId);
  return res.json({ ok: true, items: bucket });
});

// POST /api/chat/messages
router.post("/messages", (req: any, res) => {
  const {
    workspaceId,
    projectId,
    threadId = "main",
    text,
  } = req.body || {};

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      ok: false,
      error: "invalid_text",
    });
  }

  const bucket = getBucket(String(workspaceId), String(projectId), threadId);
  const ts = nowIso();
  const authorId =
    (req.user && (req.user.id || req.user.userId)) || null;

  const msg = {
    id: rid(),
    workspaceId: String(workspaceId),
    projectId: String(projectId),
    threadId: threadId ? String(threadId) : "main",
    text,
    authorId,
    createdAt: ts,
  };

  bucket.push(msg);

  return res.status(201).json({ ok: true, item: msg });
});

// DELETE /api/chat/messages/:id
router.delete("/messages/:id", (req, res) => {
  const { workspaceId, projectId } = collabScopeFromRequest(req);
  const id = String(req.params.id || "");

  if (!workspaceId || !projectId) {
    return res.status(400).json({
      ok: false,
      error: "missing_scope",
      reason: "workspaceId_and_projectId_required",
    });
  }

  const keys = Array.from(messagesByKey.keys());
  let removed = false;

  for (const key of keys) {
    const bucket = messagesByKey.get(key);
    if (!Array.isArray(bucket)) continue;

    const before = bucket.length;
    const after = bucket.filter(
      (m) =>
        !(
          m.id === id &&
          m.workspaceId === workspaceId &&
          m.projectId === projectId
        )
    );

    if (after.length !== before) {
      messagesByKey.set(key, after);
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

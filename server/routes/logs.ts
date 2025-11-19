// server/routes/logs.ts
//
// Logs API for the platform backend.
// v1: simple recent/by-id log fetchers, now wrapped with collab-aware auth.
//
// Notes:
// - Collab scoping is OPTIONAL for now.
//   If the client does not send workspaceId/projectId, the collab middleware
//   is effectively a no-op (see requireCollabAccess in server/collab/auth.ts).

import { Router } from "express";
import { recentLogs, findByRequestId } from "../logs.js";
import { requireCollabAccess } from "../collab/auth.ts";

const router = Router();

// Derive optional collab scope from query params.
// If these are missing, requireCollabAccess will NOT enforce anything yet.
const collabScopeFromQuery = (req: any) => {
  const q = req.query || {};

  const workspaceId =
    typeof q.workspaceId !== "undefined" && q.workspaceId !== null
      ? String(q.workspaceId)
      : null;

  const projectId =
    typeof q.projectId !== "undefined" && q.projectId !== null
      ? String(q.projectId)
      : null;

  return { workspaceId, projectId };
};

// GET /api/logs/recent?limit=100[&workspaceId=...&projectId=...]
router.get(
  "/recent",
  requireCollabAccess(collabScopeFromQuery),
  (req, res) => {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 1),
      500
    );
    return res.json({ ok: true, items: recentLogs(limit) });
  }
);

// GET /api/logs/by-id/:id[?workspaceId=...&projectId=...]
router.get(
  "/by-id/:id",
  requireCollabAccess(collabScopeFromQuery),
  (req, res) => {
    const id = String(req.params.id || "");
    return res.json({ ok: true, item: findByRequestId(id) });
  }
);

export default router;

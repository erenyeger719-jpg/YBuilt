// server/tenancy/workspace.access.ts
//
// Centralized helpers for figuring out which workspace a request belongs to.
// v1 is intentionally simple: it trusts the x-workspace-id header and/or
// an explicit workspaceId param. Later we can plug in real membership/roles.

import type { Request } from "express";

export type WorkspaceAccessOk = {
  ok: true;
  workspaceId: string;
  reason?: undefined;
};

export type WorkspaceAccessFailReason =
  | "missing_workspace_id"
  | "workspace_mismatch";

export type WorkspaceAccessFail = {
  ok: false;
  workspaceId: null;
  reason: WorkspaceAccessFailReason;
};

export type WorkspaceAccess = WorkspaceAccessOk | WorkspaceAccessFail;

/**
 * Read the workspace id from headers.
 *
 * Normalizes to a trimmed string or null.
 * We keep this tiny and pure so it can be reused in tests later.
 */
export function getWorkspaceIdFromHeaders(req: Request): string | null {
  const fromHeader =
    (req.headers["x-workspace-id"] as string | undefined) ||
    (req.headers["x-workspace"] as string | undefined);

  if (!fromHeader) return null;

  const trimmed = fromHeader.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Decide which workspace this request is allowed to act on.
 *
 * - If expectedWorkspaceId is provided, we require it to match the header (when present).
 * - If expectedWorkspaceId is missing but header is present, we trust the header.
 * - If we end up with no workspace id at all, we fail with missing_workspace_id.
 *
 * v1: no DB lookup, no roles. Just consistent, centralized logic.
 */
export function ensureWorkspaceAccess(
  req: Request,
  expectedWorkspaceId?: string | null
): WorkspaceAccess {
  const headerWs = getWorkspaceIdFromHeaders(req);
  const expected = (expectedWorkspaceId || "").trim() || null;

  // If both exist and disagree → hard fail.
  if (expected && headerWs && expected !== headerWs) {
    return {
      ok: false,
      workspaceId: null,
      reason: "workspace_mismatch",
    };
  }

  // Prefer explicit expected id, then header.
  const resolved = expected || headerWs;

  if (!resolved) {
    return {
      ok: false,
      workspaceId: null,
      reason: "missing_workspace_id",
    };
  }

  return {
    ok: true,
    workspaceId: resolved,
  };
}

/**
 * Convenience helper for routes that *only* rely on headers and do not
 * take an explicit workspace id in params/body.
 */
export function requireWorkspaceFromHeaders(req: Request): WorkspaceAccess {
  const headerWs = getWorkspaceIdFromHeaders(req);

  if (!headerWs) {
    return {
      ok: false,
      workspaceId: null,
      reason: "missing_workspace_id",
    };
  }

  return {
    ok: true,
    workspaceId: headerWs,
  };
}

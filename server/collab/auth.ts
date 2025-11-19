// server/collab/auth.ts
//
// Centralized helpers for collaboration auth/scoping.
//
// v1 goals:
// - Provide a single place to derive a "principal" for collab (user/team/admin).
// - Provide basic workspace/project access checks.
// - Offer an Express middleware helper we can reuse in chat/comments/logs/etc.
//
// IMPORTANT (for now):
// - These checks are intentionally conservative and mostly "auth'd user only".
// - Once we wire this into real routes and see the team/workspace models,
//   we can harden membership rules WITHOUT editing every router again.

import type { Request, Response, NextFunction } from "express";

export type CollabPrincipal = {
  userId: string | null;
  teamId: string | null;
  isAdmin: boolean;
};

/**
 * Try to infer the current collab principal from common patterns:
 * - req.user         (Passport / custom auth)
 * - req.session.user (session-based)
 * - req.auth.user    (JWT-style wrappers)
 */
export function getCollabPrincipal(req: Request): CollabPrincipal {
  const anyReq = req as any;

  const user =
    anyReq.user ||
    anyReq.session?.user ||
    anyReq.auth?.user ||
    null;

  // We don't know your exact user shape, so we look at common fields.
  const rawUserId =
    (user &&
      (user.id ||
        user.userId ||
        user._id ||
        user.email ||
        user.handle)) ||
    null;

  const rawTeamId =
    (user &&
      (user.teamId ||
        user.team_id ||
        user.orgId ||
        user.org_id ||
        user.organizationId)) ||
    null;

  const isAdmin = Boolean(
    user &&
      (user.isAdmin ||
        user.admin ||
        user.role === "admin" ||
        user.role === "owner")
  );

  return {
    userId: rawUserId ? String(rawUserId) : null,
    teamId: rawTeamId ? String(rawTeamId) : null,
    isAdmin,
  };
}

/**
 * Basic workspace access check.
 *
 * v1 behaviour:
 * - If there is NO authenticated user → deny.
 * - If there IS a user → allow.
 *
 * This keeps current behaviour effectively the same as "logged-in = ok".
 * Once we integrate real workspace membership, we tighten this.
 */
export function canAccessWorkspace(
  principal: CollabPrincipal,
  _workspaceId: string | null | undefined
): boolean {
  if (!principal.userId) return false;
  // TODO: enforce real workspace membership (team/workspace lookup) in a later pass.
  return true;
}

/**
 * Basic project access check.
 *
 * v1 behaviour:
 * - Same as workspace: any authenticated user is allowed.
 * - This is intentionally permissive until we wire real project ownership.
 */
export function canAccessProject(
  principal: CollabPrincipal,
  _workspaceId: string | null | undefined,
  _projectId: string | null | undefined
): boolean {
  if (!principal.userId) return false;
  // TODO: once we know your project/workspace schema, enforce proper checks here.
  return true;
}

/**
 * Express middleware factory for collab-protected routes.
 *
 * Usage pattern (example, later):
 *
 *   import { requireCollabAccess } from "../collab/auth.ts";
 *
 *   router.get(
 *     "/comments",
 *     requireCollabAccess((req) => ({
 *       workspaceId: String(req.query.workspaceId || ""),
 *       projectId: String(req.query.projectId || ""),
 *     })),
 *     handler
 *   );
 */
export function requireCollabAccess(
  getScope: (req: Request) => {
    workspaceId?: string | null;
    projectId?: string | null;
  }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { workspaceId, projectId } = getScope(req);

    // If the route doesn't give us any explicit scope yet,
    // we don't enforce collab checks. This keeps existing behaviour
    // unchanged until the frontend starts sending workspace/project IDs.
    const hasWorkspace =
      workspaceId !== undefined &&
      workspaceId !== null &&
      String(workspaceId).trim() !== "";
    const hasProject =
      projectId !== undefined &&
      projectId !== null &&
      String(projectId).trim() !== "";

    if (!hasWorkspace && !hasProject) {
      return next();
    }

    const principal = getCollabPrincipal(req);

    const allowed = hasProject
      ? canAccessProject(
          principal,
          hasWorkspace ? String(workspaceId) : null,
          hasProject ? String(projectId) : null
        )
      : canAccessWorkspace(
          principal,
          hasWorkspace ? String(workspaceId) : null
        );

    if (!allowed) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
        reason: "collab_scope_denied",
      });
    }

    return next();
  };
}

// tests/collab.auth.spec.ts
//
// Basic unit tests for server/collab/auth.ts
// - getCollabPrincipal
// - canAccessWorkspace / canAccessProject
// - requireCollabAccess (no-scope, deny, allow)

import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  getCollabPrincipal,
  canAccessWorkspace,
  canAccessProject,
  requireCollabAccess,
} from "../server/collab/auth.ts";

function makeReq(partial: Partial<Request>): Request {
  return partial as Request;
}

function makeRes() {
  const res: Partial<Response> = {};
  const statusMock = vi.fn().mockReturnValue(res);
  const jsonMock = vi.fn().mockReturnValue(res);

  (res as any).status = statusMock;
  (res as any).json = jsonMock;

  return {
    res: res as Response,
    statusMock,
    jsonMock,
  };
}

describe("collab auth – getCollabPrincipal", () => {
  it("extracts userId and teamId from common shapes", () => {
    const req = makeReq({
      // Simulate req.user from typical auth middlewares
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: {
        id: "user-123",
        teamId: "team-456",
        isAdmin: true,
      } as any,
    });

    const principal = getCollabPrincipal(req);

    expect(principal.userId).toBe("user-123");
    expect(principal.teamId).toBe("team-456");
    expect(principal.isAdmin).toBe(true);
  });

  it("falls back to email / handle when id-like fields are missing", () => {
    const req = makeReq({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: {
        email: "someone@example.com",
        organizationId: "org-999",
      } as any,
    });

    const principal = getCollabPrincipal(req);

    expect(principal.userId).toBe("someone@example.com");
    expect(principal.teamId).toBe("org-999");
  });

  it("returns null ids when no user is present", () => {
    const req = makeReq({} as Request);
    const principal = getCollabPrincipal(req);

    expect(principal.userId).toBeNull();
    expect(principal.teamId).toBeNull();
    expect(principal.isAdmin).toBe(false);
  });
});

describe("collab auth – canAccessWorkspace / canAccessProject", () => {
  it("denies access when userId is null", () => {
    const principal = { userId: null, teamId: null, isAdmin: false };
    expect(canAccessWorkspace(principal, "ws-1")).toBe(false);
    expect(canAccessProject(principal, "ws-1", "proj-1")).toBe(false);
  });

  it("allows access when userId is present (v1 permissive behaviour)", () => {
    const principal = { userId: "u-1", teamId: null, isAdmin: false };
    expect(canAccessWorkspace(principal, "ws-1")).toBe(true);
    expect(canAccessProject(principal, "ws-1", "proj-1")).toBe(true);
  });
});

describe("collab auth – requireCollabAccess", () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a no-op when getScope returns no workspaceId/projectId", () => {
    const req = makeReq({
      // user intentionally omitted; should not matter when no scope
    });

    const { res, statusMock, jsonMock } = makeRes();

    const mw = requireCollabAccess(() => ({
      workspaceId: null,
      projectId: null,
    }));

    mw(req, res, next);

    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when scope is provided but principal has no userId", () => {
    const req = makeReq({
      // No user/session/auth on purpose
    });

    const { res, statusMock, jsonMock } = makeRes();

    const mw = requireCollabAccess(() => ({
      workspaceId: "ws-123",
      projectId: null,
    }));

    mw(req, res, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledTimes(1);

    const payload = jsonMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      ok: false,
      error: "forbidden",
      reason: "collab_scope_denied",
    });

    // next should NOT be called on deny
    expect(next).not.toHaveBeenCalled();
  });

  it("allows when scope is provided and principal has a userId", () => {
    const req = makeReq({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: { id: "u-123" } as any,
    });

    const { res, statusMock, jsonMock } = makeRes();

    const mw = requireCollabAccess(() => ({
      workspaceId: "ws-123",
      projectId: "proj-456",
    }));

    mw(req, res, next);

    // should not respond directly
    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
    // should proceed to the next handler
    expect(next).toHaveBeenCalledTimes(1);
  });
});

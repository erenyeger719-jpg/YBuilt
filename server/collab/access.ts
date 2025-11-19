// server/collab/access.ts

export type CollabRoomContext = {
  rawRoom: string;
  workspaceId?: string;
  projectId?: string;
  teamId?: string;
};

export type CollabAccessDecision = {
  allowed: boolean;
  reason?: string;
  ctx: CollabRoomContext;
};

function parseRoom(rawRoom: string): CollabRoomContext {
  const ctx: CollabRoomContext = { rawRoom };
  if (!rawRoom) return ctx;

  const parts = rawRoom
    .split(":")
    .map((p) => p.trim())
    .filter(Boolean);

  // Very simple conventions:
  // workspace:<workspaceId>
  // workspace:<workspaceId>:project:<projectId>
  // team:<teamId>:workspace:<workspaceId>:project:<projectId>
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].toLowerCase();
    const val = parts[i + 1];
    if (!val) continue;

    if (key === "workspace" || key === "ws") {
      ctx.workspaceId = ctx.workspaceId || val;
    }
    if (key === "project" || key === "pj") {
      ctx.projectId = ctx.projectId || val;
    }
    if (key === "team" || key === "tm") {
      ctx.teamId = ctx.teamId || val;
    }
  }

  return ctx;
}

type AuthContext = {
  userId?: string;
  teamId?: string;
  workspaceId?: string;
  projectId?: string;
};

function getAuthContext(socket: any): AuthContext {
  const out: AuthContext = {};
  try {
    const hs = socket?.handshake || {};
    const auth = (hs.auth || {}) as any;
    const user = (auth.user || auth.session?.user || {}) as any;

    const teamId =
      auth.teamId ||
      auth.team_id ||
      user.teamId ||
      user.team_id ||
      undefined;

    const workspaceId =
      auth.workspaceId ||
      auth.workspace_id ||
      user.workspaceId ||
      user.workspace_id ||
      undefined;

    const projectId =
      auth.projectId ||
      auth.project_id ||
      auth.fileId ||
      auth.file_id ||
      undefined;

    const userId =
      auth.userId ||
      auth.user_id ||
      user.id ||
      user.userId ||
      user.user_id ||
      undefined;

    out.teamId = teamId;
    out.workspaceId = workspaceId;
    out.projectId = projectId;
    out.userId = userId;
  } catch {
    // treat as anonymous
  }
  return out;
}

export function checkCollabAccess(
  socket: any,
  room: string,
): CollabAccessDecision {
  const ctx = parseRoom(room);
  const auth = getAuthContext(socket);

  // Default stance: allow, but tighten when we know enough.
  let allowed = true;
  let reason: string | undefined;

  // If room encodes a workspace and auth has a workspace, they must match.
  if (ctx.workspaceId && auth.workspaceId && ctx.workspaceId !== auth.workspaceId) {
    allowed = false;
    reason = "workspace_mismatch";
  }

  // If room encodes a team and auth has a team, they must match.
  if (allowed && ctx.teamId && auth.teamId && ctx.teamId !== auth.teamId) {
    allowed = false;
    reason = "team_mismatch";
  }

  // If we have no userId at all, still allow (guest), but mark why.
  if (!auth.userId && !reason) {
    reason = "no_user";
  }

  const mergedCtx: CollabRoomContext = {
    rawRoom: ctx.rawRoom,
    workspaceId: ctx.workspaceId || auth.workspaceId,
    projectId: ctx.projectId || auth.projectId,
    teamId: ctx.teamId || auth.teamId,
  };

  return {
    allowed,
    reason,
    ctx: mergedCtx,
  };
}

// client/src/lib/session.ts

export type SessionUser = {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: any;
} | null;

export type SessionTeam = {
  id?: string;
  name?: string;
  [key: string]: any;
} | null;

export type Session = {
  user: SessionUser;
  currentTeam: SessionTeam;
  teams: SessionTeam[];
};

type RawSessionResponse = {
  ok?: boolean;
  user?: SessionUser;
  currentTeam?: SessionTeam;
  teams?: SessionTeam[];
  error?: string;
};

/**
 * Core helper: normalize a backend session payload into our Session shape.
 */
function normalizeSession(data: RawSessionResponse | undefined | null): Session {
  return {
    user: data?.user ?? null,
    currentTeam: data?.currentTeam ?? null,
    teams: (data?.teams as SessionTeam[]) || [],
  };
}

/**
 * Fetches the current session.
 * Never throws to the UI; falls back to an anonymous session if anything goes wrong.
 */
export async function getSession(): Promise<Session> {
  try {
    const r = await fetch("/api/session", { credentials: "include" });

    const contentType = r.headers.get("content-type") || "";
    const raw =
      contentType.includes("application/json") ? await r.json() : {};

    const data = (raw || {}) as RawSessionResponse;

    // Soft path: endpoint not implemented
    if (r.status === 404 || data.error === "not_found") {
      console.warn("[session] /api/session not found, using anonymous session");
      return { user: null, currentTeam: null, teams: [] };
    }

    if (!r.ok || data.ok === false) {
      throw new Error(data.error || "session failed");
    }

    return normalizeSession(data);
  } catch (err) {
    console.error(
      "[session] getSession failed, falling back to anonymous",
      err
    );
    return { user: null, currentTeam: null, teams: [] };
  }
}

/**
 * Switch active team.
 * If the route isn't there yet, logs and returns the current session.
 */
export async function switchTeam(teamId: string | null): Promise<Session> {
  if (!teamId) {
    console.warn(
      "[session] switchTeam called without teamId; returning current session"
    );
    return getSession();
  }

  try {
    const r = await fetch("/api/session/switch-team", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });

    const contentType = r.headers.get("content-type") || "";
    const raw =
      contentType.includes("application/json") ? await r.json() : {};

    const data = (raw || {}) as RawSessionResponse;

    if (r.status === 404 || data.error === "not_found") {
      console.warn(
        "[session] /api/session/switch-team not found, returning existing session"
      );
      return getSession();
    }

    if (!r.ok || data.ok === false) {
      console.error("[session] switchTeam failed", data);
      return getSession();
    }

    return normalizeSession(data);
  } catch (err) {
    console.error("[session] switchTeam error, returning existing session", err);
    return getSession();
  }
}

/**
 * Optional: sign out. We keep it no-throw so imports are always safe.
 */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/session/signout", {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("[session] signOut error", err);
  } finally {
    // Simple fallback: reload to clear any cached state
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  }
}

/**
 * Optional: sign in. This can be wired to your real auth later.
 */
export async function signIn(provider?: string): Promise<void> {
  try {
    const target = provider ? `/auth/${provider}` : "/auth/signin";
    window.location.assign(target);
  } catch (err) {
    console.error("[session] signIn error", err);
  }
}

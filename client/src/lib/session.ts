// client/src/lib/session.ts

export type SessionUser = any;
export type SessionTeam = any;

export type Session = {
  user: SessionUser | null;
  currentTeam: SessionTeam | null;
  teams: SessionTeam[];
};

type RawSessionResponse = {
  ok?: boolean;
  user?: SessionUser | null;
  currentTeam?: SessionTeam | null;
  teams?: SessionTeam[];
  error?: string;
};

export async function getSession(): Promise<Session> {
  try {
    const r = await fetch("/api/session", { credentials: "include" });

    const contentType = r.headers.get("content-type") || "";
    const raw =
      contentType.includes("application/json") ? await r.json() : {};

    const data = (raw || {}) as RawSessionResponse;

    // Graceful path: session endpoint not implemented / not found yet
    if (r.status === 404 || data.error === "not_found") {
      console.warn("[session] /api/session not found, using anonymous session");
      return { user: null, currentTeam: null, teams: [] };
    }

    // Other hard failures
    if (!r.ok || data.ok === false) {
      throw new Error(data.error || "session failed");
    }

    return {
      user: data.user ?? null,
      currentTeam: data.currentTeam ?? null,
      teams: data.teams ?? [],
    };
  } catch (err) {
    // Last resort: never blow up the whole UI because of header session
    console.error("[session] getSession failed, falling back to anonymous", err);
    return { user: null, currentTeam: null, teams: [] };
  }
}

// server/collab/audit.ts
import fs from "fs";
import path from "path";

const COLLAB_AUDIT_FILE = path.join(process.cwd(), ".cache", "collab.audit.jsonl");

export type CollabEventKind =
  | "join"
  | "leave"
  | "presence"
  | "comment"
  | "cursor"
  | "mention";

export type CollabEvent = {
  kind: CollabEventKind;
  room: string;
  peerId: string;
  userName?: string;
  file?: string;
  workspaceId?: string;
  projectId?: string;
  reason?: string;
  // Keep payload small if possible; we’ll try to summarize it.
  payload?: any;
  ts?: number;
};

function summarizePayload(payload: any) {
  if (!payload || typeof payload !== "object") return undefined;

  const out: any = {};
  for (const key of ["id", "type", "kind", "action", "file", "path"]) {
    if (payload[key] != null) out[key] = payload[key];
  }
  return Object.keys(out).length ? out : undefined;
}

export function logCollabEvent(event: CollabEvent) {
  try {
    fs.mkdirSync(path.dirname(COLLAB_AUDIT_FILE), { recursive: true });

    const summarized: CollabEvent = {
      ...event,
      ts: event.ts ?? Date.now(),
      payload: summarizePayload(event.payload ?? event.payload),
    };

    const line = JSON.stringify(summarized);
    fs.appendFile(COLLAB_AUDIT_FILE, line + "\n", () => {
      // fire-and-forget; never block collab traffic on logging
    });
  } catch {
    // Never crash because audit logging failed.
  }
}

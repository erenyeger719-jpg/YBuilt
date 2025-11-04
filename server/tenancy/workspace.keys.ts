// server/tenancy/workspace.keys.ts

/**
 * Canonical representation of a workspace-scoped key.
 *
 * - workspaceId: the tenant / workspace identifier (string-ish)
 * - key: the logical key we want to store under (e.g. "url:https://...").
 */
export interface WorkspaceKeyParts {
  workspaceId: string;
  key: string;
}

/**
 * Normalize a workspaceId into a safe, non-empty string.
 * If missing/blank, we fall back to "anon".
 */
export function normalizeWorkspaceId(
  workspaceId: string | null | undefined
): string {
  const trimmed = (workspaceId ?? "").trim();
  return trimmed || "anon";
}

/**
 * Build a workspace-scoped key string.
 *
 * Format (simple and deterministic):
 *   <workspaceId>::<key>
 *
 * Examples:
 *   makeWorkspaceKey("ws_123", "url:https://example.com")
 *   => "ws_123::url:https://example.com"
 */
export function makeWorkspaceKey(
  workspaceId: string | null | undefined,
  key: string
): string {
  const ws = normalizeWorkspaceId(workspaceId);
  // We assume `key` itself does not contain our separator "::" in a way
  // that matters; if it does, parseWorkspaceKey will still round-trip
  // correctly by only splitting on the first occurrence.
  return `${ws}::${key}`;
}

/**
 * Inverse of makeWorkspaceKey.
 *
 * - If the separator is present, splits into { workspaceId, key }.
 * - If missing (old data), treats the entire string as `key` with workspaceId="anon".
 */
export function parseWorkspaceKey(fullKey: string): WorkspaceKeyParts {
  const sep = "::";
  const idx = fullKey.indexOf(sep);

  if (idx === -1) {
    // Old / non-scoped keys – treat as anon workspace.
    return {
      workspaceId: "anon",
      key: fullKey,
    };
  }

  const workspaceId = fullKey.slice(0, idx) || "anon";
  const key = fullKey.slice(idx + sep.length);

  return {
    workspaceId,
    key,
  };
}

/**
 * Convenience helper: change just the workspaceId on an existing
 * workspace-scoped key string.
 */
export function retargetWorkspaceKey(
  fullKey: string,
  newWorkspaceId: string | null | undefined
): string {
  const { key } = parseWorkspaceKey(fullKey);
  return makeWorkspaceKey(newWorkspaceId, key);
}

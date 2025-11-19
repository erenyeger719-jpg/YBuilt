// server/tenancy/workspace.audit.ts

export type WorkspaceAuditIssueKind =
  | "empty_key"
  | "missing_workspace_prefix";

export interface WorkspaceAuditIssue {
  key: string;
  kind: WorkspaceAuditIssueKind;
}

export interface WorkspaceAuditSummary {
  totalKeys: number;
  okKeys: number;
  issues: WorkspaceAuditIssue[];
}

/**
 * Tiny helper: what does a "scoped" key look like?
 * For now we treat any key starting with "ws::" as workspace-scoped.
 *
 * Examples:
 *   ws::anon::pg_123
 *   ws::acme::kpi/url_costs
 */
export function isWorkspaceScopedKey(rawKey: string): boolean {
  const key = String(rawKey || "").trim();
  return key.startsWith("ws::");
}

/**
 * Check a single key and return an issue if something is off.
 */
export function auditWorkspaceKey(key: string): WorkspaceAuditIssue | null {
  const trimmed = String(key || "").trim();

  if (!trimmed) {
    return { key, kind: "empty_key" };
  }

  if (!isWorkspaceScopedKey(trimmed)) {
    return { key, kind: "missing_workspace_prefix" };
  }

  return null;
}

/**
 * Run an audit over a flat key→value map, such as:
 *   - metrics url-cost map
 *   - cache maps
 *
 * This does NOT touch the filesystem; you feed the object in.
 */
export function auditWorkspaceKeyMap(
  obj: Record<string, unknown>
): WorkspaceAuditSummary {
  const keys = Object.keys(obj || {});
  const issues: WorkspaceAuditIssue[] = [];

  for (const key of keys) {
    const issue = auditWorkspaceKey(key);
    if (issue) issues.push(issue);
  }

  const totalKeys = keys.length;
  const badKeys = issues.length;
  const okKeys = totalKeys - badKeys;

  return { totalKeys, okKeys, issues };
}

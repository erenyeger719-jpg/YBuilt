// tests/workspace.audit.spec.ts
import { describe, it, expect } from "vitest";
import {
  isWorkspaceScopedKey,
  auditWorkspaceKey,
  auditWorkspaceKeyMap,
} from "../server/tenancy/workspace.audit";

describe("tenancy/workspace.audit – workspace key isolation", () => {
  it("treats keys starting with 'ws::' as scoped", () => {
    expect(isWorkspaceScopedKey("ws::anon::pg_123")).toBe(true);
    expect(isWorkspaceScopedKey("ws::acme::metrics/url_costs")).toBe(true);

    // obvious bad ones
    expect(isWorkspaceScopedKey("pg_123")).toBe(false);
    expect(isWorkspaceScopedKey("metrics/url_costs")).toBe(false);
    expect(isWorkspaceScopedKey("")).toBe(false);
  });

  it("flags empty or whitespace-only keys", () => {
    const issue1 = auditWorkspaceKey("");
    const issue2 = auditWorkspaceKey("   ");

    expect(issue1).not.toBeNull();
    expect(issue1?.kind).toBe("empty_key");

    expect(issue2).not.toBeNull();
    expect(issue2?.kind).toBe("empty_key");
  });

  it("flags non-scoped keys as missing workspace prefix", () => {
    const issue = auditWorkspaceKey("pg_123");

    expect(issue).not.toBeNull();
    expect(issue?.kind).toBe("missing_workspace_prefix");
    expect(issue?.key).toBe("pg_123");
  });

  it("summarizes a mixed key map correctly", () => {
    const sample = {
      "ws::anon::pg_1": { cents: 1 },
      "ws::acme::pg_2": { cents: 2 },
      "pg_3": { cents: 3 },
      "metrics/url_costs": { cents: 4 },
    };

    const summary = auditWorkspaceKeyMap(sample);

    expect(summary.totalKeys).toBe(4);
    expect(summary.okKeys).toBe(2);
    expect(summary.issues.length).toBe(2);

    const kinds = summary.issues.map((i) => i.kind).sort();
    expect(kinds).toEqual(["missing_workspace_prefix", "missing_workspace_prefix"]);
  });
});

// tests/workspace.keys.spec.ts
import { describe, it, expect } from "vitest";

import {
  normalizeWorkspaceId,
  makeWorkspaceKey,
  parseWorkspaceKey,
  retargetWorkspaceKey,
} from "../server/tenancy/workspace.keys";

describe("tenancy/workspace.keys – workspace-scoped key helpers", () => {
  it("normalizes workspace ids, falling back to 'anon' when missing", () => {
    expect(normalizeWorkspaceId("ws_123")).toBe("ws_123");
    expect(normalizeWorkspaceId("  ws_abc  ")).toBe("ws_abc");
    expect(normalizeWorkspaceId("")).toBe("anon");
    expect(normalizeWorkspaceId("   ")).toBe("anon");
    expect(normalizeWorkspaceId(null)).toBe("anon");
    expect(normalizeWorkspaceId(undefined)).toBe("anon");
  });

  it("builds workspace-scoped keys with the 'ws::key' format", () => {
    const key = makeWorkspaceKey("ws_123", "url:https://example.com");

    expect(key).toBe("ws_123::url:https://example.com");
  });

  it("parses workspace-scoped keys back into parts", () => {
    const full = "ws_123::url:https://example.com";
    const parts = parseWorkspaceKey(full);

    expect(parts.workspaceId).toBe("ws_123");
    expect(parts.key).toBe("url:https://example.com");
  });

  it("treats keys without a separator as anon workspace", () => {
    const full = "legacy_key_without_workspace";
    const parts = parseWorkspaceKey(full);

    expect(parts.workspaceId).toBe("anon");
    expect(parts.key).toBe("legacy_key_without_workspace");
  });

  it("can retarget a key to a different workspace", () => {
    const original = makeWorkspaceKey("ws_old", "url:https://example.com");
    const retargeted = retargetWorkspaceKey(original, "ws_new");

    expect(retargeted).toBe("ws_new::url:https://example.com");

    const parts = parseWorkspaceKey(retargeted);
    expect(parts.workspaceId).toBe("ws_new");
    expect(parts.key).toBe("url:https://example.com");
  });
});

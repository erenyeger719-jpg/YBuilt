// tests/autopilot.sup.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supClient so we don't actually hit any network
vi.mock("../client/src/lib/supClient.ts", () => {
  return {
    supPost: vi.fn().mockResolvedValue({ ok: true }),
  };
});

import { supPost } from "../client/src/lib/supClient.ts";
import { sendAutopilotIntent } from "../client/src/lib/autopilot-sup.ts";

describe("Autopilot SUP bridge – sendAutopilotIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the intent payload into supPost", async () => {
    const intent: any = {
      kind: "compose",
      summary: "Compose for dark waitlist page",
      payload: { goal: "waitlist", theme: "dark" },
    };

    await sendAutopilotIntent(intent);

    expect(supPost).toHaveBeenCalledTimes(1);
    const call = (supPost as any).mock.calls[0];

    // first arg = some path/route string (we don't care about exact value here)
    expect(typeof call[0]).toBe("string");

    // second arg should be exactly the intent we passed
    expect(call[1]).toEqual(intent);
  });

  it("does not throw even if supPost rejects (fails closed, UX-safe)", async () => {
    (supPost as any).mockRejectedValueOnce(new Error("network down"));

    const intent: any = {
      kind: "status",
      summary: "Status check",
      payload: { from: "test" },
    };

    // key guarantee: caller never sees a throw
    await expect(sendAutopilotIntent(intent)).resolves.toBeUndefined();

    expect(supPost).toHaveBeenCalledTimes(1);
  });
});

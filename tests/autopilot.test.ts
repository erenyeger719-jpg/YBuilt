// client/src/lib/autopilot.test.ts
import { describe, it, expect, vi } from "vitest";
import { Autopilot } from "./autopilot";

function makePilot(applyDesignPackMock: (arg: any) => void) {
  const pilot = new Autopilot({
    say: () => {},
    askConfirm: async () => true,
    log: () => {},
    actions: {
      // All the other actions can be simple no-ops for this test
      setPrompt: () => {},
      composeInstant: async () => {},
      applyChip: async () => {},
      setZeroJs: async () => {},
      runArmyTop: async () => {},
      blendTopWinner: async () => {},
      startBasicAB: () => {},
      toggleAB: () => {},
      setABAuto: () => {},
      viewArm: () => {},
      setAutopilot: () => {},
      undo: () => {},
      reportStatus: async () => "",
      setGoalAndApply: async () => {},
      setDataSkin: async () => {},
      toggleComments: () => {},
      applyDesignPack: applyDesignPackMock,
    },
  } as any);

  return pilot as any; // loosen types for the test
}

describe("Autopilot → Design Store bridge", () => {
  it("calls applyDesignPack with slot 'hero' for a hero design-store command", async () => {
    const applyDesignPackMock = vi.fn();
    const pilot = makePilot(applyDesignPackMock);

    await pilot.handle("use a minimal hero from the design store");

    expect(applyDesignPackMock).toHaveBeenCalledTimes(1);
    const arg = applyDesignPackMock.mock.calls[0][0];

    expect(arg.slot).toBe("hero");
    expect(String(arg.styleHint || "")).toContain("minimal");
  });

  it("calls applyDesignPack with slot 'pricing' for a pricing design-store command", async () => {
    const applyDesignPackMock = vi.fn();
    const pilot = makePilot(applyDesignPackMock);

    await pilot.handle("add a pricing section from the design store");

    expect(applyDesignPackMock).toHaveBeenCalledTimes(1);
    const arg = applyDesignPackMock.mock.calls[0][0];

    expect(arg.slot).toBe("pricing");
  });
});

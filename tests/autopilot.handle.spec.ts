// tests/autopilot.handle.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SUP bridge so we don't actually hit any network
vi.mock("../client/src/lib/autopilot-sup.ts", () => ({
  sendAutopilotIntent: vi.fn(),
}));

import { Autopilot, type AutopilotOpts } from "../client/src/lib/autopilot.ts";
import { sendAutopilotIntent } from "../client/src/lib/autopilot-sup.ts";

function makeActions(): AutopilotOpts["actions"] {
  return {
    setPrompt: vi.fn(),
    composeInstant: vi.fn(),
    applyChip: vi.fn(),
    setZeroJs: vi.fn(),
    runArmyTop: vi.fn(),
    blendTopWinner: vi.fn(),
    startBasicAB: vi.fn(),
    toggleAB: vi.fn(),
    setABAuto: vi.fn(),
    viewArm: vi.fn(),
    setAutopilot: vi.fn(),
    undo: vi.fn(),
    reportStatus: vi.fn().mockReturnValue("ok"),
    setGoalAndApply: vi.fn(),
    setDataSkin: vi.fn(),
    toggleComments: vi.fn(),
  };
}

describe("Autopilot.handle – voice → actions graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("turns Autopilot OFF when user asks", async () => {
    const actions = makeActions();
    const pilot = new Autopilot({
      actions,
      say: vi.fn(),
      log: vi.fn(),
    });

    await pilot.handle("turn autopilot off");

    expect(actions.setAutopilot).toHaveBeenCalledTimes(1);
    expect(actions.setAutopilot).toHaveBeenCalledWith(false);

    expect(sendAutopilotIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "other",
        summary: expect.stringMatching(/turned off/i),
        payload: expect.objectContaining({ on: false }),
      })
    );
  });

  it("handles 'make ...' by setting prompt and composing", async () => {
    const actions = makeActions();
    const pilot = new Autopilot({
      actions,
      say: vi.fn(),
      log: vi.fn(),
    });

    const text =
      "Make a dark waitlist page for indie founders with a hero and email capture.";

    await pilot.handle(text);

    expect(actions.setPrompt).toHaveBeenCalledTimes(1);
    const promptArg = (actions.setPrompt as any).mock.calls[0][0] as string;

    // should carry the core idea through
    expect(promptArg.toLowerCase()).toContain("dark waitlist");
    expect(actions.composeInstant).toHaveBeenCalledTimes(1);

    expect(sendAutopilotIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "compose",
        summary: expect.stringMatching(/compose/i),
      })
    );
  });

  it("sets A/B auto-stop confidence from 'confidence 95'", async () => {
    const actions = makeActions();
    const pilot = new Autopilot({
      actions,
      say: vi.fn(),
      log: vi.fn(),
    });

    await pilot.handle("set confidence 95");

    expect(actions.setABAuto).toHaveBeenCalledTimes(1);
    const cfg = (actions.setABAuto as any).mock.calls[0][0];

    // confidence should be ~0.95
    expect(cfg.confidence).toBeCloseTo(0.95, 3);

    expect(sendAutopilotIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "ab_config",
        summary: expect.stringMatching(/confidence/i),
      })
    );
  });

  it("toggles zero-JS ON from 'zero js on'", async () => {
    const actions = makeActions();
    const pilot = new Autopilot({
      actions,
      say: vi.fn(),
      log: vi.fn(),
    });

    await pilot.handle("zero js on");

    expect(actions.setZeroJs).toHaveBeenCalledTimes(1);
    expect(actions.setZeroJs).toHaveBeenCalledWith(true);

    expect(sendAutopilotIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "other",
        summary: expect.stringMatching(/zero-js/i),
        payload: expect.objectContaining({ on: true }),
      })
    );
  });

  it("calls undo when user says 'undo'", async () => {
    const actions = makeActions();
    const pilot = new Autopilot({
      actions,
      say: vi.fn(),
      log: vi.fn(),
    });

    await pilot.handle("undo my last change");

    expect(actions.undo).toHaveBeenCalledTimes(1);
    expect(sendAutopilotIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "undo",
        summary: expect.stringMatching(/undo/i),
      })
    );
  });
});

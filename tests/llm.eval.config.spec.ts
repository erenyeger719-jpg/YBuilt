// tests/llm.eval.config.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getEvalConfig,
  setEvalConfig,
  primaryModel,
  challengerModel,
  shouldRunChallenger,
} from "../server/llm/eval.config";

describe("llm/eval.config – Granite evaluation gate", () => {
  beforeEach(() => {
    // reset to a known baseline before each test
    setEvalConfig({
      primary: "main",
      challenger: null,
      mode: "off",
      sampleRate: 0,
    });
  });

  it("defaults to primary-only with no challenger", () => {
    const cfg = getEvalConfig();

    expect(cfg.primary).toBe("main");
    expect(cfg.challenger).toBeNull();
    expect(cfg.mode).toBe("off");
    expect(cfg.sampleRate).toBe(0);

    expect(primaryModel()).toBe("main");
    expect(challengerModel()).toBeNull();
    expect(shouldRunChallenger(0.1)).toBe(false);
  });

  it("can be configured for full shadow Granite", () => {
    setEvalConfig({
      challenger: "granite",
      mode: "shadow",
      sampleRate: 1,
    });

    expect(primaryModel()).toBe("main");
    expect(challengerModel()).toBe("granite");

    // in shadow mode, challenger always runs
    expect(shouldRunChallenger(0.1)).toBe(true);
    expect(shouldRunChallenger(0.9)).toBe(true);
  });

  it("supports partial sampling for challenger", () => {
    setEvalConfig({
      challenger: "granite",
      mode: "partial",
      sampleRate: 0.3,
    });

    expect(challengerModel()).toBe("granite");

    // deterministic: sample < 0.3 => true, >= 0.3 => false
    expect(shouldRunChallenger(0.1)).toBe(true);
    expect(shouldRunChallenger(0.29)).toBe(true);
    expect(shouldRunChallenger(0.3)).toBe(false);
    expect(shouldRunChallenger(0.9)).toBe(false);
  });
});

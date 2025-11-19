// tests/shadow.rl.job.spec.ts
import { describe, it, expect } from "vitest";
import {
  runShadowRlJob,
  type RlPolicySnapshot,
} from "../server/intent/shadow.rl.job";
import {
  type ShadowEvent,
} from "../server/intent/shadow.rl";

describe("intent/shadow RL – nightly job core", () => {
  it("creates an initial snapshot when none exists", () => {
    const events: ShadowEvent[] = [
      {
        providerId: "granite",
        route: "/act",
        converted: true,
        edits: 0,
        supViolations: 0,
      },
      {
        providerId: "ollama",
        route: "/act",
        converted: false,
        edits: 2,
        supViolations: 1,
      },
    ];

    const fixedNow = 1700000000000; // deterministic timestamp
    const { snapshot } = runShadowRlJob(events, null, 0.2, fixedNow);

    expect(snapshot.version).toBe(1);
    expect(snapshot.updatedAtTs).toBe(fixedNow);
    expect(snapshot.lastSummary.total).toBe(2);

    // We don't assert exact numeric priors here, but we expect
    // entries for both providers.
    expect(Object.keys(snapshot.priors).sort()).toEqual(
      ["granite", "ollama"].sort()
    );
  });

  it("increments version and nudges priors from previous snapshot", () => {
    const prevSnapshot: RlPolicySnapshot = {
      version: 3,
      updatedAtTs: 1600000000000,
      priors: {
        granite: 1.0,
        ollama: -0.5,
      },
      lastSummary: {
        total: 0,
        providers: [],
      },
    };

    const events: ShadowEvent[] = [
      {
        providerId: "granite",
        route: "/act",
        converted: true,
        edits: 0,
        supViolations: 0,
      }, // reward ~1
      {
        providerId: "ollama",
        route: "/act",
        converted: false,
        edits: 4,
        supViolations: 1,
      }, // reward 1 - 0.4 - 0.5 = 0.1? No: converted=false -> 0 -0.4 -0.5 = -0.9
    ];

    const { snapshot } = runShadowRlJob(events, prevSnapshot, 0.1, 1800000000000);

    // Version should bump by 1
    expect(snapshot.version).toBe(4);
    expect(snapshot.updatedAtTs).toBe(1800000000000);

    // Priors should be nudged from previous values.
    // We don't depend on exact math here, just direction.
    const newGranite = snapshot.priors.granite;
    const newOllama = snapshot.priors.ollama;

    expect(newGranite).toBeGreaterThan(1.0);
    expect(newOllama).toBeLessThan(-0.5);
  });
});

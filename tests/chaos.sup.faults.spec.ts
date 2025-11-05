import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";

// LLM + intent + metrics modules used by SUP
import * as registry from "../server/llm/registry.ts";
import { filterIntent } from "../server/intent/filter.ts";
import { recordShip, snapshotUrlCosts } from "../server/metrics/outcome.ts";

describe("chaos / SUP faults", () => {
  //
  // 1) LLM / provider failure should NOT crash filterIntent
  //
  describe("LLM / provider failure", () => {
    it("filterIntent does not crash when the provider throws", async () => {
      // Make chatJSON throw like the provider is down
      const spy = vi
        .spyOn(registry, "chatJSON")
        .mockRejectedValue(new Error("provider down"));

      let error: any = null;

      try {
        // This is the same helper /one uses under the hood
        await filterIntent("landing page for a saas");
      } catch (e) {
        error = e;
      }

      // Restore original behavior
      spy.mockRestore();

      // If this is not null, your SUP stack is crashing on provider failure
      expect(error).toBeNull();
    });
  });

  //
  // 2) .cache write failures should NOT crash metrics/outcome
  //
  describe(".cache write failures", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Pretend disk/.cache is broken
      writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
        throw new Error("disk is full");
      });
    });

    afterEach(() => {
      writeSpy.mockRestore();
    });

    it("metrics/outcome swallows write failures", () => {
      // These both try to write into .cache under normal use
      expect(() => {
        recordShip("pg_chaos");
        snapshotUrlCosts();
      }).not.toThrow();
    });
  });
});

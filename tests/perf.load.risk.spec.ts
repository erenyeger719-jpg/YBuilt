import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Perf/load: risk endpoint stays healthy under repetition", () => {
  it("handles repeated /risk calls with different prompts without 500s", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const prompts = [
      "Neutral marketing copy for a SaaS landing page.",
      "Slightly claimy copy with 50% off and #1 in the world wording.",
      "Clearly abusive spam style text!!! CLICK NOW!!!",
      "Harmless FAQ content about pricing and features.",
    ];

    const N = 20;

    for (let i = 0; i < N; i++) {
      const prompt = prompts[i % prompts.length];

      const r = await a.get(
        `/api/ai/risk?prompt=${encodeURIComponent(prompt)}`,
      );

      // Endpoint must not 500, even under repetition.
      expect(r.status).not.toBe(500);

      // Basic shape + invariants
      expect(r.body).toBeTruthy();
      expect(r.body.ok).toBe(true);
      expect(r.body.prompt).toBe(prompt);
      expect(typeof r.body.risky).toBe("boolean");
    }
  });
});

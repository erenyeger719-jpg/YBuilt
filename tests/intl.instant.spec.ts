import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Multilingual: /instant and /one stay healthy for non-Latin scripts", () => {
  it("handles a few non-English prompts without 500s", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const prompts = [
      "これは日本語のテストです",        // Japanese
      "هذا اختبار باللغة العربية",       // Arabic
      "यह हिंदी में एक परीक्षण है",      // Hindi
    ];

    for (const prompt of prompts) {
      // /instant should respond successfully
      const rInstant = await a.post("/api/ai/instant").send({ prompt });
      expect(rInstant.status).toBe(200);
      expect(rInstant.body?.result?.pageId).toBeDefined();

      // /one should also respond successfully
      const rOne = await a.post("/api/ai/one").send({ prompt });
      expect(rOne.status).toBe(200);
      expect(rOne.body?.result?.pageId).toBeDefined();
    }
  });
});

import { describe, it, expect } from "vitest";
import { addExample, nearest } from "../server/intent/retrieval";

describe("retrieval", () => {
  it("addExample then nearest returns a hit", async () => {
    const prompt = "ecommerce launch page with dark mode";
    await addExample("seed", prompt, { sections:["hero-basic","cta-simple"], copy:{ HEADLINE:"Hi" }, brand:{} } as any);
    const hit = await nearest(prompt);
    expect(hit).toBeTruthy();
    expect(hit.sections?.length).toBeGreaterThan(0);
  });
});

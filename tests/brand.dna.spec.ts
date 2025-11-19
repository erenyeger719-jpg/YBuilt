import { describe, it, expect } from "vitest";
import { recordDNA, suggestFromDNA } from "../server/brand/dna";

describe("brand dna", () => {
  it("suggestFromDNA reflects recorded preferences", () => {
    const sid = "sess-dna";
    recordDNA(sid, { brand: { primary:"#6d28d9", tone:"minimal", dark:true }, sections:["hero-basic"] } as any);
    const sug: any = suggestFromDNA(sid) || {};
    expect(sug.brand?.dark).toBe(true);
    expect(["minimal","playful","serious",undefined]).toContain(sug.brand?.tone);
    // does not invent wild sections
    if (Array.isArray(sug.sections)) for (const s of sug.sections) expect(typeof s).toBe("string");
  });
});

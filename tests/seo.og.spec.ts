import { describe, it, expect } from "vitest";
import { buildSEO } from "../server/seo/og";

describe("seo/og", () => {
  it("emits meta and safe copyPatch", () => {
    const meta: any = buildSEO({ title:"Preview", description:"", brand:{}, url:null } as any);
    expect(meta).toHaveProperty("meta");
    if (meta.copyPatch) {
      for (const [k,v] of Object.entries(meta.copyPatch)) {
        expect(typeof v === "string" || v === null).toBe(true);
      }
    }
  });
});

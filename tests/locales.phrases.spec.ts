import { describe, it, expect } from "vitest";
import { normalizeLocale } from "../server/intent/locales";
import { localizeCopy } from "../server/intent/phrases";

describe("locales & phrases", () => {
  it("normalize maps variants consistently", () => {
    expect(normalizeLocale("en-IN")).toMatch(/^en/);
    expect(normalizeLocale("hi")).toMatch(/^(hi|en)/);
  });
  it("localizeCopy is idempotent on same locale", () => {
    const base = { HEADLINE: "Hello", HERO_SUBHEAD: "Welcome" } as any;
    const a = localizeCopy(base, "en");
    const b = localizeCopy(a, "en");
    expect(b).toEqual(a);
  });
});

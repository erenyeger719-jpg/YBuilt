// tests/locale.layout.policy.spec.ts
import { describe, it, expect } from "vitest";
import {
  inferScriptFromLocale,
  getLocaleLayoutPolicy,
} from "../server/qa/locale.layout.policy";

describe("qa/locale.layout.policy – script + layout rules per locale", () => {
  it("infers script from simple locale codes", () => {
    expect(inferScriptFromLocale("en")).toBe("latin");
    expect(inferScriptFromLocale("fr")).toBe("latin");
    expect(inferScriptFromLocale("ja")).toBe("cjk");
    expect(inferScriptFromLocale("zh")).toBe("cjk");
    expect(inferScriptFromLocale("ar")).toBe("rtl");
    expect(inferScriptFromLocale("he")).toBe("rtl");
  });

  it("handles region tags like en-US and ja-JP", () => {
    expect(inferScriptFromLocale("en-US")).toBe("latin");
    expect(inferScriptFromLocale("en_GB")).toBe("latin");
    expect(inferScriptFromLocale("ja-JP")).toBe("cjk");
    expect(inferScriptFromLocale("zh-CN")).toBe("cjk");
    expect(inferScriptFromLocale("ar-SA")).toBe("rtl");
  });

  it("falls back to latin when locale is missing or empty", () => {
    expect(inferScriptFromLocale("")).toBe("latin");
    expect(inferScriptFromLocale(null)).toBe("latin");
    expect(inferScriptFromLocale(undefined)).toBe("latin");
  });

  it("returns sane layout policies per script", () => {
    const latin = getLocaleLayoutPolicy("en-US");
    expect(latin.script).toBe("latin");
    expect(latin.maxLineLengthCh).toBeGreaterThan(60);
    expect(latin.allowHyphenation).toBe(true);
    expect(latin.punctuationSpacing).toBe("latin");

    const cjk = getLocaleLayoutPolicy("ja-JP");
    expect(cjk.script).toBe("cjk");
    expect(cjk.maxLineLengthCh).toBeLessThan(latin.maxLineLengthCh);
    expect(cjk.allowHyphenation).toBe(false);
    expect(cjk.punctuationSpacing).toBe("cjk");

    const rtl = getLocaleLayoutPolicy("ar-SA");
    expect(rtl.script).toBe("rtl");
    expect(rtl.maxLineLengthCh).toBeGreaterThan(40);
    expect(rtl.allowHyphenation).toBe(false);
    expect(rtl.punctuationSpacing).toBe("rtl");
  });
});

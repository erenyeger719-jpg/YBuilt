import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs"; import os from "os"; import path from "path";

const cwd0 = process.cwd();
let tmp = "";
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yb-priors-")); process.chdir(tmp); });
afterAll(() => { process.chdir(cwd0); fs.rmSync(tmp, { recursive: true, force: true }); });

import { tokenBiasFor, recordTokenSeen, recordTokenWin } from "../server/design/outcome.priors";

describe("outcome.priors", () => {
  it("returns a brand bias triple even on cold start", () => {
    const b = tokenBiasFor("sess-a");
    expect(b).toMatchObject({}); // shape check
    expect(typeof b.primary === "string" || b.primary == null).toBe(true);
    expect(["minimal","playful","serious",undefined].includes(b.tone)).toBe(true);
    expect(typeof b.dark === "boolean" || b.dark == null).toBe(true);
  });

  it("records seen + win without throwing and creates cache", () => {
    recordTokenSeen({
      brand: { primary: "#6d28d9", tone: "serious", dark: false },
      sessionId: "sess-a",
      metrics: { a11y: true, cls: 0.02, lcp_ms: 1800 }
    } as any);
    recordTokenWin({
      brand: { primary: "#6d28d9", tone: "serious", dark: false },
      sessionId: "sess-a"
    } as any);
    const p = path.resolve(".cache/token.priors.json");
    expect(fs.existsSync(p)).toBe(true);
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(j).toBeTypeOf("object");
  });
});

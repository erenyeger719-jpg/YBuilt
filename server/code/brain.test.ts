// server/code/brain.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// adjust these imports to match your actual exports in brain.ts
import {
  applyWrite,
  gateFileChange,
  proposeEdit,
  explainAt,
} from "./brain";

const TMP_DIR = "tmp-test-code";

beforeAll(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

//
// T0.1 – applyWrite: existing file, new file, dry-run
//
describe("T0.1 – applyWrite", () => {
  it("writes to an existing file", async () => {
    const relPath = path.join(TMP_DIR, "existing.txt");
    await fs.writeFile(relPath, "old", "utf8");

    const res = await applyWrite(relPath, "new", false);

    expect(res.ok).toBe(true);
    const final = await fs.readFile(relPath, "utf8");
    expect(final).toBe("new");
  });

  it("creates a new file when it does not exist", async () => {
    const relPath = path.join(TMP_DIR, "new-file.txt");
    await fs.rm(relPath, { force: true });

    const res = await applyWrite(relPath, "hello", false);

    expect(res.ok).toBe(true);
    const final = await fs.readFile(relPath, "utf8");
    expect(final).toBe("hello");
  });

  it("does not write in dry-run mode", async () => {
    const relPath = path.join(TMP_DIR, "dry.txt");
    await fs.writeFile(relPath, "original", "utf8");

    const res = await applyWrite(relPath, "changed", true);

    expect(res.ok).toBe(true);
    const final = await fs.readFile(relPath, "utf8");
    expect(final).toBe("original");
  });
});

//
// T0.2 – gateFileChange: contracts guard
//
describe("T0.2 – gateFileChange", () => {
  it("blocks too large file", () => {
    const before = "small";
    const after = "x".repeat(2_000_000);

    const res = gateFileChange("src/big.js", before, after);
    expect(res.ok).toBe(false);
    expect((res.reasons ?? []).length).toBeGreaterThan(0);
  });

  it("blocks huge delta", () => {
    const before = "x";
    const after = "x".repeat(200_000);

    const res = gateFileChange("src/delta.js", before, after);
    expect(res.ok).toBe(false);
    expect((res.reasons ?? []).length).toBeGreaterThan(0);
  });

  it("blocks eval()", () => {
    const before = "const x = 1;";
    const after = before + '\n eval("alert(1)")';

    const res = gateFileChange("src/eval.js", before, after);
    expect(res.ok).toBe(false);
    expect((res.reasons ?? []).length).toBeGreaterThan(0);
  });

  it("blocks new Function()", () => {
    const before = "const x = 1;";
    const after =
      before + '\n const f = new Function("x", "return x");';

    const res = gateFileChange("src/fn.js", before, after);
    expect(res.ok).toBe(false);
    expect((res.reasons ?? []).length).toBeGreaterThan(0);
  });

  it("blocks <img> without alt for TSX/HTML", () => {
    const before = "<div></div>";
    const after = '<div><img src="foo.png"></div>';

    const res = gateFileChange("src/page.tsx", before, after);
    expect(res.ok).toBe(false);
    expect((res.reasons ?? []).length).toBeGreaterThan(0);
  });

  it("allows a normal small change", () => {
    const before = "const x = 1;";
    const after = "const x = 2;";

    const res = gateFileChange("src/safe.js", before, after);
    expect(res.ok).toBe(true);
  });
});

//
// T0.3 – proposeEdit: rename / axios→fetch / sticky header / soften / no-op
//
describe("T0.3 – proposeEdit", () => {
  it("renames hero to heroText", async () => {
    const content = `
      const hero = "Welcome";
      function render() {
        return <h1>{hero}</h1>;
      }
    `;
    const { newContent, summary } = await proposeEdit({
      path: "src/Home.tsx",
      content,
      instruction: "rename hero to heroText",
    });

    expect(newContent).toContain("heroText");
    expect(newContent).not.toContain('hero"');
    expect(summary.join(" ").toLowerCase()).toContain("rename");
  });

  it("converts axios to fetch", async () => {
    const content = `
      import axios from "axios";
      export async function loadData() {
        const res = await axios.get("/api/data");
        return res.data;
      }
    `;
    const { newContent, summary } = await proposeEdit({
      path: "src/api.ts",
      content,
      instruction: "replace axios with fetch",
    });

    expect(newContent.toLowerCase()).toContain("fetch(");
    expect(newContent.toLowerCase()).not.toContain("axios");
    expect(summary.join(" ").toLowerCase()).toContain("axios");
  });

  it("adds sticky header CSS only for desktop", async () => {
    const content = `
      .site-header {
        background: white;
      }
    `;
    const { newContent, summary } = await proposeEdit({
      path: "src/styles.css",
      content,
      instruction: "make header sticky only on desktop",
    });

    expect(newContent).toContain(".site-header");
    expect(newContent.toLowerCase()).toContain("position: sticky");
    expect(newContent.toLowerCase()).toContain("@media");
    expect(summary.join(" ").toLowerCase()).toContain("sticky");
  });

  it("softens marketing claims", async () => {
    const content = `
      // We are the best and #1 with guaranteed 50% lift.
      const copy = "We are the best and #1 with guaranteed 50% lift.";
    `;
    const { newContent, summary } = await proposeEdit({
      path: "src/marketing.ts",
      content,
      instruction: "soften superlatives and risky claims",
    });

    expect(newContent).not.toContain("best and #1");
    expect(newContent).not.toContain("guaranteed 50% lift");
    expect(summary.join(" ").toLowerCase()).toContain("soften");
  });

  it("no-ops on unknown instruction", async () => {
    const content = `const x = 1;`;
    const { newContent, summary } = await proposeEdit({
      path: "src/unknown.ts",
      content,
      instruction: "do something wild and unsupported",
    });

    expect(newContent).toBe(content);
    expect(summary.join(" ").toLowerCase()).toContain("no changes");
  });
});

//
// T0.4 – explainAt: basic sanity
//
describe("T0.4 – explainAt", () => {
  it("explains a React snippet", () => {
    const content = `
      import React from "react";
      export function App() {
        return <div>Hello</div>;
      }
    `;
    const res = explainAt({
      path: "src/App.tsx",
      content,
      line: 3,
    });

    expect(res.summary.toLowerCase()).toMatch(/react|jsx|component/);
    expect(res.lines.length).toBeGreaterThan(0);
  });

  it("explains a test file", () => {
    const content = `
      import { describe, it, expect } from "vitest";

      describe("math", () => {
        it("adds", () => {
          expect(1 + 1).toBe(2);
        });
      });
    `;
    const res = explainAt({
      path: "src/math.test.ts",
      content,
      line: 4,
    });

    expect(res.summary.toLowerCase()).toMatch(/test|jest|vitest/);
    expect(res.lines.length).toBeGreaterThan(0);
  });
});

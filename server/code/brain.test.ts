// server/code/brain.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// adjust these imports to match your actual exports in brain.ts
import {
  applyWrite,
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
// T0.3 – proposeEdit: rename / axios→fetch / sticky header / soften / no-op
//
describe("T0.3 – proposeEdit", () => {
  it("renames hero to heroText", async () => {
    const relPath = path.join(TMP_DIR, "Home.tsx");
    const content = `
      const hero = "Welcome";
      function render() {
        return <h1>{hero}</h1>;
      }
    `;

    await fs.writeFile(relPath, content, "utf8");

    const { newContent, summary } = await proposeEdit({
      path: relPath,
      content,
      instruction: "rename hero to heroText",
    });

    expect(newContent.toLowerCase()).toContain("herotext");
    expect(newContent).not.toContain('hero"');
    expect(summary.join(" ").toLowerCase()).toContain("rename");
  });

  it("converts axios to fetch", async () => {
    const relPath = path.join(TMP_DIR, "api.ts");
    const content = `
      import axios from "axios";
      export async function loadData() {
        const res = await axios.get("/api/data");
        return res.data;
      }
    `;

    await fs.writeFile(relPath, content, "utf8");

    const { newContent, summary } = await proposeEdit({
      path: relPath,
      content,
      instruction: "replace axios with fetch",
    });

    expect(newContent.toLowerCase()).toContain("fetch(");
    expect(newContent.toLowerCase()).not.toContain("axios");
    expect(summary.join(" ").toLowerCase()).toContain("axios");
  });

  it("adds sticky header CSS only for desktop", async () => {
    const relPath = path.join(TMP_DIR, "styles.css");
    const content = `
      .site-header {
        background: white;
      }
    `;

    await fs.writeFile(relPath, content, "utf8");

    const { newContent, summary } = await proposeEdit({
      path: relPath,
      content,
      instruction: "make header sticky only on desktop",
    });

    expect(newContent).toContain(".site-header");
    expect(newContent.toLowerCase()).toContain("@media");
    expect(newContent.toLowerCase()).toContain("position: static");
    expect(summary.join(" ").toLowerCase()).toContain("sticky");
  });

  it("softens marketing claims", async () => {
    const relPath = path.join(TMP_DIR, "marketing.ts");
    const content = `
      // We are the best and #1 with guaranteed 50% lift.
      const copy = "We are the best and #1 with guaranteed 50% lift.";
    `;

    await fs.writeFile(relPath, content, "utf8");

    const { newContent, summary } = await proposeEdit({
      path: relPath,
      content,
      instruction: "soften superlatives and risky claims",
    });

    expect(newContent).not.toContain("best and #1");
    expect(newContent).not.toContain("guaranteed 50% lift");
    expect(summary.join(" ").toLowerCase()).toContain("soften");
  });

  it("no-ops on unknown instruction", async () => {
    const relPath = path.join(TMP_DIR, "unknown.ts");
    const content = `const x = 1;`;

    await fs.writeFile(relPath, content, "utf8");

    const { newContent, summary } = await proposeEdit({
      path: relPath,
      content,
      instruction: "do something wild and unsupported",
    });

    expect(newContent).toBe(content);
    const summaryText = summary.join(" ").toLowerCase();
    expect(summaryText).toContain("no-op");
  });
});

//
// T0.4 – explainAt: basic sanity
//
describe("T0.4 – explainAt", () => {
  it("explains a React snippet", async () => {
    const relPath = path.join(TMP_DIR, "App.tsx");
    const content = `
      import React from "react";
      export function App() {
        return <div>Hello</div>;
      }
    `;

    await fs.writeFile(relPath, content, "utf8");

    const res = explainAt(relPath, content, 3);

    expect(res.summary.toLowerCase()).toMatch(/react|jsx|component/);
    expect(res.lines.length).toBeGreaterThan(0);
  });

  it("explains a test file", async () => {
    const relPath = path.join(TMP_DIR, "math.test.ts");
    const content = `
      import { describe, it, expect } from "vitest";

      describe("math", () => {
        it("adds", () => {
          expect(1 + 1).toBe(2);
        });
      });
    `;

    await fs.writeFile(relPath, content, "utf8");

    const res = explainAt(relPath, content, 4);

    expect(res.summary.toLowerCase()).toMatch(/test|jest|vitest/);
    expect(res.lines.length).toBeGreaterThan(0);
  });
});

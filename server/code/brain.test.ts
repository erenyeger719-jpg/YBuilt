// server/code/brain.test.ts
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { promises as fs } from "fs";
import path from "path";

// adjust these imports to match your actual exports in brain.ts
import {
  applyWrite,
  proposeEdit,
  explainAt,
  inferStyleProfileFromSource,
  applyStyleProfileToNewContent,
  addCommentForPath,
  listCommentsForPath,
  deleteCommentById,
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

    const res = explainAt(relPath, 3);

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

    const res = explainAt(relPath, 4);

    expect(res.summary.toLowerCase()).toMatch(/test|jest|vitest/);
    expect(res.lines.length).toBeGreaterThan(0);
  });
});

//
// T4 – selection-aware edits
//
describe("T4 – selection-aware edits", () => {
  it("only edits the selected lines when renaming", async () => {
    const relPath = path.join(TMP_DIR, "selection.ts");

    const lines = [
      'const hero = "top";',
      "const other = hero;",
      'const hero = "bottom";',
      "const footer = hero;",
    ];
    const content = lines.join("\n");
    await fs.writeFile(relPath, content, "utf8");

    const { newContent, summary } = await proposeEdit({
      path: relPath,
      instruction: "rename hero to heroText",
      selection: { start: 2, end: 3 }, // zero-based: affect last two lines only
    });

    const newLines = newContent.split("\n");

    // First two lines should still use `hero`
    expect(newLines[0]).toBe('const hero = "top";');
    expect(newLines[1]).toBe("const other = hero;");

    // Last two lines should have the renamed symbol (case-insensitive)
    expect(newLines[2].toLowerCase()).toContain("herotext");
    expect(newLines[3].toLowerCase()).toContain("herotext");

    const summaryText = summary.join(" ").toLowerCase();
    expect(summaryText).toContain("rename");
  });
});

//
// T8 – style profile: infer + apply
//
describe("T8 – style profile", () => {
  it("keeps single quotes and removes semicolons when source prefers that style", () => {
    const source = `
      const msg = 'hello'
      function fn() {
        return 'ok'
      }
    `;

    const profile = inferStyleProfileFromSource(source);

    expect(profile.quotes).toBe("single");
    // could be "never" or "mixed" depending on heuristics,
    // but it should not force semicolons.
    expect(["never", "mixed"]).toContain(profile.semicolons);

    const newContent = `
      const msg = "hello";
      function fn() {
        return "ok";
      }
    `;

    const styled = applyStyleProfileToNewContent(profile, newContent);

    // quotes normalized to single
    expect(styled).not.toContain('"hello"');
    expect(styled).toContain("'hello'");

    // no obvious trailing semicolons if source didn't use them
    expect(styled).not.toMatch(/;\s*$/m);
  });

  it("prefers double quotes when source uses them", () => {
    const source = `
      const msg = "hello";
      function fn() {
        return "ok";
      }
    `;

    const profile = inferStyleProfileFromSource(source);

    expect(profile.quotes).toBe("double");
    // semicolons may be "always" or "mixed" depending on ratios
    expect(["always", "mixed"]).toContain(profile.semicolons);

    const newContent = `
      const msg = 'hello'
      function fn() {
        return 'ok'
      }
    `;

    const styled = applyStyleProfileToNewContent(profile, newContent);

    // quotes normalized to double; we don't assert on semicolons here
    expect(styled).not.toContain("'hello'");
    expect(styled).toContain('"hello"');
    expect(styled).toMatch(/return "ok"/);
  });
});

//
// T9 – comments: add, list, delete
//
describe("T9 – comments", () => {
  const COMMENTS_PATH = path.join(".cache", "code-comments.jsonl");

  beforeEach(async () => {
    // clean comment store before each test
    await fs.rm(COMMENTS_PATH, { force: true });
  });

  it("adds and lists comments for a file", () => {
    const rec = addCommentForPath({
      path: "tmp-test-code/foo.ts",
      line: 5,
      text: "check this line",
    });

    expect(rec.id).toMatch(/^c_/);
    expect(rec.path).toBe("tmp-test-code/foo.ts");
    expect(rec.line).toBe(5);
    expect(rec.text).toBe("check this line");

    const list = listCommentsForPath("tmp-test-code/foo.ts");
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(rec.id);
    expect(list[0].line).toBe(5);
    expect(list[0].text).toBe("check this line");
  });

  it("deletes comments by id", () => {
    const rec1 = addCommentForPath({
      path: "tmp-test-code/foo.ts",
      line: 5,
      text: "one",
    });
    const rec2 = addCommentForPath({
      path: "tmp-test-code/foo.ts",
      line: 6,
      text: "two",
    });

    const res = deleteCommentById(rec1.id);
    expect(res.ok).toBe(true);

    const listAfter = listCommentsForPath("tmp-test-code/foo.ts");
    expect(listAfter.length).toBe(1);
    expect(listAfter[0].id).toBe(rec2.id);

    const res2 = deleteCommentById("does-not-exist");
    expect(res2.ok).toBe(false);
  });
});

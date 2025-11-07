// server/routes/code.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { promises as fs } from "fs";
import path from "path";

// adjust this import to match how you export the router in server/routes/code.ts
// e.g. export default router; or export const codeRouter = router;
import codeRouter from "./code"; // or { codeRouter } from "./code";

const app = express();
app.use(express.json());
app.use("/api/code", codeRouter);

const TMP_DIR = "tmp-test-code";

beforeAll(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

//
// T0.1 – /code/apply and /code/tests/apply new-file safe writes
//
describe("T0.1 – routes: apply + tests/apply", () => {
  it("applies to an existing file without crashing", async () => {
    const relPath = path.join(TMP_DIR, "route-existing.txt");
    await fs.writeFile(relPath, "old", "utf8");

    const res = await request(app)
      .post("/api/code/apply")
      .send({ path: relPath, newContent: "route content", dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const final = await fs.readFile(relPath, "utf8");
    expect(final).toBe("route content");
  });

  it("creates a new file when /code/apply targets a missing path", async () => {
    const relPath = path.join(TMP_DIR, "route-new.txt");
    await fs.rm(relPath, { force: true });

    const res = await request(app)
      .post("/api/code/apply")
      .send({ path: relPath, newContent: "hello from route", dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const final = await fs.readFile(relPath, "utf8");
    expect(final).toBe("hello from route");
  });

  it("creates a new test file via /code/tests/apply", async () => {
    const testPath = path.join(TMP_DIR, "sample.test.ts");
    await fs.rm(testPath, { force: true });

    const res = await request(app)
      .post("/api/code/tests/apply")
      .send({ testPath, newContent: "test('x', () => {});", dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const final = await fs.readFile(testPath, "utf8");
    expect(final).toContain("test(");
  });
});

//
// T0.2 – routes: contracts guard via /code/apply
//
describe("T0.2 – routes: contracts guard", () => {
  it("blocks eval() via /code/apply", async () => {
    const relPath = path.join(TMP_DIR, "contracts-eval.js");
    await fs.rm(relPath, { force: true });

    const res = await request(app)
      .post("/api/code/apply")
      .send({ path: relPath, newContent: 'eval("alert(1)")', dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    const msg = (res.body.reasons || []).join(" ").toLowerCase();
    expect(msg).toContain("eval");
  });

  it("blocks <img> without alt via /code/apply", async () => {
    const relPath = path.join(TMP_DIR, "no-alt.html");
    await fs.rm(relPath, { force: true });

    const html = `<div><img src="foo.png"></div>`;

    const res = await request(app)
      .post("/api/code/apply")
      .send({ path: relPath, newContent: html, dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    const msg = (res.body.reasons || []).join(" ").toLowerCase();
    expect(msg).toContain("accessibility");
    expect(msg).toContain("img");
    expect(msg).toContain("alt");
  });
});

//
// T0.5 – /code/tree and /code/read basics
//
describe("T0.5 – tree + read routes", () => {
  it("/code/tree returns a tree structure", async () => {
    const res = await request(app).get("/api/code/tree");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.tree).toBeDefined();
    expect(res.body.tree.type).toBe("dir");
  });

  it("/code/read returns content for an existing file", async () => {
    // pick a file that you know exists in your repo
    const pathToRead = "server/code/brain.ts";

    const res = await request(app)
      .get("/api/code/read")
      .query({ path: pathToRead });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.content).toBe("string");
    expect(res.body.content.length).toBeGreaterThan(0);
  });

  it("/code/read fails for missing file", async () => {
    const res = await request(app)
      .get("/api/code/read")
      .query({ path: "does/not/exist.ts" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBeDefined();
  });

  it("/code/read rejects unsafe path", async () => {
    const res = await request(app)
      .get("/api/code/read")
      .query({ path: "../../etc/passwd" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});

import request from "supertest";
import express from "express";
import aiRouter from "../server/ai/router.ts";

async function run(name: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  try { await fn(); console.log(`✔ ${name} (${Date.now()-t0}ms)`); }
  catch (e:any) { console.error(`✖ ${name}:`, e?.message || e); process.exitCode = 1; }
}

function appWithEnv(env: Record<string,string>) {
  Object.assign(process.env, env);
  const app = express();
  app.set("trust proxy", true);
  app.use("/api/ai", aiRouter);
  return request(app);
}

(async () => {
  // 1) Fetch timeout / registry down
  // monkey-patch global fetch to simulate timeouts for this scope
  const savedFetch = globalThis.fetch!;
  (globalThis as any).fetch = (async (..._args:any[]) => {
    throw new Error("ECONNRESET: chaos fetch failure");
  }) as any;

  await run("cloud ladder downgrade (no 500s)", async () => {
    const a = appWithEnv({ NODE_ENV: "test", PROOF_STRICT: "0", PREWARM_TOKEN: "" });
    const r = await a.post("/api/ai/one").send({ prompt: "light minimal page", sessionId: "chaos" });
    if (r.status !== 200 || r.body.ok !== true) throw new Error("ladder failed");
  });

  (globalThis as any).fetch = savedFetch;

  // 2) Readonly .cache
  await run("disk failure degrades gracefully", async () => {
    Object.defineProperty(process, "cwd", { value: () => "/root/readonly" });
    const a = appWithEnv({ NODE_ENV:"test", PREWARM_TOKEN:"" });
    const r = await a.get("/api/ai/metrics");
    if (r.status !== 200) throw new Error("metrics should still be ok");
  });
})();
import request from "supertest";
import express from "express";
import aiRouter from "../server/ai/router.ts";

async function run(name: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  try { await fn(); console.log(`✔ ${name} (${Date.now()-t0}ms)`); }
  catch (e:any) { console.error(`✖ ${name}:`, e?.message || e); process.exitCode = 1; }
}

function appWithEnv(env: Record<string,string>) {
  Object.assign(process.env, env);
  const app = express();
  app.set("trust proxy", true);
  app.use("/api/ai", aiRouter);
  return request(app);
}

(async () => {
  // 1) Fetch timeout / registry down
  // monkey-patch global fetch to simulate timeouts for this scope
  const savedFetch = globalThis.fetch!;
  (globalThis as any).fetch = (async (..._args:any[]) => {
    throw new Error("ECONNRESET: chaos fetch failure");
  }) as any;

  await run("cloud ladder downgrade (no 500s)", async () => {
    const a = appWithEnv({ NODE_ENV: "test", PROOF_STRICT: "0", PREWARM_TOKEN: "" });
    const r = await a.post("/api/ai/one").send({ prompt: "light minimal page", sessionId: "chaos" });
    if (r.status !== 200 || r.body.ok !== true) throw new Error("ladder failed");
  });

  (globalThis as any).fetch = savedFetch;

  // 2) Readonly .cache
  await run("disk failure degrades gracefully", async () => {
    Object.defineProperty(process, "cwd", { value: () => "/root/readonly" });
    const a = appWithEnv({ NODE_ENV:"test", PREWARM_TOKEN:"" });
    const r = await a.get("/api/ai/metrics");
    if (r.status !== 200) throw new Error("metrics should still be ok");
  });
})();

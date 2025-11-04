// tests/testServer.ts
import express from "express";
import request from "supertest";

// IMPORTANT: keep mount path as in prod
import aiRouter from "../server/ai/router.ts";

/**
 * Build an app wired like production:
 * - applies env overrides
 * - trusts proxy so x-forwarded-for works
 * - mounts the full AI router under /api/ai
 */
export function makeApp(env: Record<string, string | undefined> = {}) {
  // apply test-specific env vars
  Object.assign(process.env, env);

  const app = express();
  // trust proxy so x-forwarded-for works in quota tests
  app.set("trust proxy", true);

  // Mount the full AI router (includes metrics, guardrails, etc.)
  app.use("/api/ai", aiRouter);

  return app;
}

export function agent(env: Record<string, string | undefined> = {}) {
  return request(makeApp(env));
}

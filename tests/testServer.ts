// tests/testServer.ts
import express from "express";
import request from "supertest";
import { vi } from "vitest";

/**
 * Build an app wired like production, but with per-test env:
 * - applies env overrides
 * - resets module graph so router sees fresh env
 * - mounts the full AI router under /api/ai
 */
export function makeApp(env: Record<string, string | undefined> = {}) {
  // Make sure router.ts re-reads env for each test
  vi.resetModules();

  // Apply test-specific env vars
  Object.assign(process.env, env);

  const app = express();
  app.set("trust proxy", true);

  // Import router *after* env + reset, so it picks up test flags
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const aiRouterModule = require("../server/ai/router.ts");
  const aiRouter = aiRouterModule.default ?? aiRouterModule.aiRouter;

  app.use("/api/ai", aiRouter);

  return app;
}

export function agent(env: Record<string, string | undefined> = {}) {
  return request(makeApp(env));
}

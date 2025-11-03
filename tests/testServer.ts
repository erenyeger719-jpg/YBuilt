import express from "express";
import request from "supertest";

// IMPORTANT: keep mount path as in prod
import aiRouter from "../server/ai/router.ts";

export function makeApp(env: Record<string, string|undefined> = {}) {
  Object.assign(process.env, env);
  const app = express();
  // trust proxy so x-forwarded-for works in quota tests
  app.set("trust proxy", true);
  app.use("/api/ai", aiRouter);
  return app;
}

export function agent(env: Record<string,string|undefined> = {}) {
  return request(makeApp(env));
}

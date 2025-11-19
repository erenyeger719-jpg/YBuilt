// Property tests — inputs should never 5xx the brain.
import { describe, it, expect } from "vitest";
import express from "express";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import requestRaw from "supertest";
import fc from "fast-check";
import * as aiMod from "../ai/router";

// Resolve router from common export patterns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any =
  // @ts-ignore
  (aiMod as any).default ??
  // @ts-ignore
  (aiMod as any).router ??
  // @ts-ignore
  (aiMod as any).aiRouter ??
  aiMod;

const request: typeof requestRaw = (requestRaw as any).default ?? (requestRaw as any);

process.env.PROOF_STRICT = process.env.PROOF_STRICT ?? "0";
process.env.QA_DEVICE_SNAPSHOTS = process.env.QA_DEVICE_SNAPSHOTS ?? "0";
process.env.DEVICE_GATE = process.env.DEVICE_GATE ?? "on";

const app = express().use(express.json()).use("/api/ai", router);

describe("AI Router — property safety", () => {
  it("random chips never 5xx", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 64 }), async (chip) => {
        const r = await request(app)
          .post("/api/ai/chips/apply")
          .send({ sessionId: "p_chips", spec: {}, chip });
        expect([200, 400]).toContain(r.statusCode); // OK or graceful 4xx
      }),
      { numRuns: 25 }
    );
  });

  it("Accept-Language fuzzer never 5xx for /instant", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 16 }), async (lang) => {
        const r = await request(app)
          .post("/api/ai/instant")
          .set("accept-language", lang)
          .send({ prompt: "portfolio", sessionId: "p_locale" });
        expect([200, 400]).toContain(r.statusCode);
      }),
      { numRuns: 25 }
    );
  });
});

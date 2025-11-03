// tests/llm.registry.eval.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

import { chatJSON, maybeNightlyRoutingUpdate } from "../server/llm/registry";
import { setEvalConfig } from "../server/llm/eval.config";

const CACHE_DIR = ".cache";
const SHADOW_LOG = path.join(CACHE_DIR, "llm.shadow.jsonl");
const SHADOW_METRICS = path.join(CACHE_DIR, "shadow.metrics.json");
const ROUTING_FILE = path.join(CACHE_DIR, "llm.routing.json");

function cleanupFile(p: string) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

beforeEach(() => {
  // clean artifacts for deterministic tests
  cleanupFile(SHADOW_LOG);
  cleanupFile(SHADOW_METRICS);
  cleanupFile(ROUTING_FILE);

  // minimal env so providers don't throw on missing keys
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_MODEL = "gpt-4o-mini";

  process.env.GRANITE_API_KEY = "test-granite-key";
  process.env.GRANITE_API_URL = "https://granite.fake/v1/chat";
  process.env.GRANITE_MODEL = "granite-3.1-mini";

  // default: no explicit champion env override
  delete process.env.LLM_CHAMPION;

  // reset eval config to "off"
  setEvalConfig({
    primary: "main",
    challenger: null,
    mode: "off",
    sampleRate: 0,
  });

  // fake fetch so no real network calls
  (globalThis as any).fetch = async (url: string, init?: any) => {
    const body = init && typeof init.body === "string" ? JSON.parse(init.body) : {};
    const model = body.model || "unknown";

    const from =
      String(url).includes("openai.com") ? "openai" :
      String(url).includes("granite") ? "granite" :
      "other";

    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({ from, model }),
          },
        },
      ],
    };

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    } as any;
  };
});

describe("llm/registry – eval gate wiring", () => {
  it("runs only champion when eval mode is off", async () => {
    const res = await chatJSON({
      system: "You are a test system.",
      user: "test prompt",
      task: "unit-test",
    });

    // main response should come from champion (openai in our fake)
    expect(res.json.from).toBe("openai");

    // no shadow log should exist when mode = off and challenger = null
    const shadowLogExists = fs.existsSync(SHADOW_LOG);
    expect(shadowLogExists).toBe(false);
  });

  it("runs challenger in full shadow mode", async () => {
    // turn on Granite as challenger, full shadow
    setEvalConfig({
      challenger: "granite",
      mode: "shadow",
      sampleRate: 1,
    });

    const res = await chatJSON({
      system: "You are a test system.",
      user: "test prompt for shadow",
      task: "unit-test-shadow",
    });

    // champion still responds to user (openai in this setup)
    expect(res.json.from).toBe("openai");

    // give the async shadow call a moment to write logs
    await new Promise((resolve) => setTimeout(resolve, 20));

    const shadowLogExists = fs.existsSync(SHADOW_LOG);
    expect(shadowLogExists).toBe(true);

    const content = fs.readFileSync(SHADOW_LOG, "utf8").trim();
    expect(content.length).toBeGreaterThan(0);

    const lines = content.split("\n");
    const last = JSON.parse(lines[lines.length - 1]);

    // log should mention champion + shadow providers
    expect(last.champion).toBe("openai");
    expect(last.shadow).toBe("granite");
    expect(typeof last.ms).toBe("number");
  });

  it("promotes Granite shadow to champion when enough calls are recorded", () => {
    // pretend Granite has been used enough times in shadow
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      SHADOW_METRICS,
      JSON.stringify({ calls: 60, lastTs: Date.now() - 1000 })
    );

    // run the nightly routing update
    maybeNightlyRoutingUpdate();

    // routing file should now have Granite as champion
    expect(fs.existsSync(ROUTING_FILE)).toBe(true);
    const raw = fs.readFileSync(ROUTING_FILE, "utf8");
    const routing = JSON.parse(raw);

    expect(routing.champion).toBeDefined();
    expect(routing.champion.provider).toBe("granite");
    expect(routing.shadow).toBeDefined();
    expect(routing.shadow.provider).toBe("openai");
  });
});

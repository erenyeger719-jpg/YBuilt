// tests/execute.registry.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ExecRequest } from "../server/execute/types.ts";

// Hoisted mock: factory must not close over any top-level let/const.
vi.mock("../server/sandbox/index.ts", () => {
  return {
    runSandbox: vi.fn(async (_job: any) => {
      return {
        ok: true,
        reason: "ok_test",
        durationMs: 1,
        exitCode: 0,
        stdout: "",
        stderr: "",
      };
    }),
  };
});

// Import AFTER vi.mock so registry sees the mocked sandbox.
import { runInSandbox } from "../server/execute/registry.ts";
import { runSandbox } from "../server/sandbox/index.ts";

// Cast so we can use mock helpers without fighting TS.
const mockedRunSandbox = runSandbox as unknown as ReturnType<typeof vi.fn>;

describe("runInSandbox registry", () => {
  const baseJob: ExecRequest = {
    lang: "node",
    code: "console.log('hi from test')",
    args: [],
    timeoutMs: 500,
  };

  let prevImpl: string | undefined;

  beforeEach(() => {
    prevImpl = process.env.RUNNER_IMPL;
    mockedRunSandbox.mockClear();
  });

  afterEach(() => {
    if (prevImpl === undefined) {
      delete process.env.RUNNER_IMPL;
    } else {
      process.env.RUNNER_IMPL = prevImpl;
    }
    mockedRunSandbox.mockClear();
  });

  it("returns remote not-configured stub when RUNNER_IMPL=remote", async () => {
    process.env.RUNNER_IMPL = "remote";

    const res = await runInSandbox(baseJob);

    expect(res.ok).toBe(false);
    // @ts-expect-error - error exists on this union branch
    expect(res.error).toBe("remote_runner_not_configured");
    // @ts-expect-error - runnerType is always attached by registry
    expect(res.runnerType).toBe("remote");

    expect(mockedRunSandbox).toHaveBeenCalledTimes(0);
  });

  it("delegates to runSandbox when RUNNER_IMPL=local (default)", async () => {
    process.env.RUNNER_IMPL = "local";

    const res = await runInSandbox(baseJob);

    expect(res.ok).toBe(true);
    // @ts-expect-error - runnerType is always present at runtime
    expect(res.runnerType).toBe("local");
    expect(mockedRunSandbox).toHaveBeenCalledTimes(1);
  });

  it("falls back to local runner for unknown RUNNER_IMPL values", async () => {
    process.env.RUNNER_IMPL = "weird";

    const res = await runInSandbox(baseJob);

    expect(res.ok).toBe(true);
    // @ts-expect-error - runnerType is always present at runtime
    expect(res.runnerType).toBe("local");
    expect(mockedRunSandbox).toHaveBeenCalledTimes(1);
  });
});

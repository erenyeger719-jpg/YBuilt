// tests/supClient.spec.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { supPost } from "../client/src/lib/supClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("supPost", () => {
  it("returns ok and surfaces SUP headers on happy path", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-sup-mode" ? "allow" : null,
      },
      json: async () => ({
        ok: true,
        spec: { foo: "bar" },
        meta: { cost: { tokens: 10, cents: 1 } },
      }),
    } as any);

    const res = await supPost("/api/ai/instant", { prompt: "x" });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.supMode).toBe("allow");
    expect(res.body).toBeTruthy();
    expect((res.body as any).spec).toEqual({ foo: "bar" });
  });

  it("marks 422 sup_block as not ok and exposes reasons", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: {
        get: (name: string) => {
          const n = name.toLowerCase();
          if (n === "x-sup-mode") return "block";
          if (n === "x-sup-reasons") return "proof_gate_fail,perf_bad";
          return null;
        },
      },
      json: async () => ({
        ok: false,
        error: "sup_block",
      }),
    } as any);

    const res = await supPost("/api/ai/act", { prompt: "x" });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    expect(res.supMode).toBe("block");
    expect(res.supReasons).toContain("proof_gate_fail");
    expect(res.supReasons).toContain("perf_bad");
  });

  it("returns a network_error shape when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("boom"));

    const res = await supPost("/api/ai/instant", { prompt: "x" });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.supReasons).toBe("network_error");
    expect(res.body).toBeNull();
  });
});

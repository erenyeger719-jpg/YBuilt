// tests/device.sanity.spec.ts
import { describe, it, expect } from "vitest";
import {
  assessDeviceSnapshots,
  type DeviceSnapshot,
} from "../server/qa/device.sanity";

describe("qa/device.sanity – assessDeviceSnapshots", () => {
  it("passes when no snapshots or all devices are within budgets", () => {
    const resEmpty = assessDeviceSnapshots([]);
    expect(resEmpty.pass).toBe(true);
    expect(resEmpty.worstDevice).toBeNull();
    expect(resEmpty.reasons.length).toBe(0);

    const snaps: DeviceSnapshot[] = [
      {
        device: "mobile",
        cls: 0.1,
        lcpMs: 1800,
        hasOverlap: false,
        hasClip: false,
        a11yOk: true,
      },
      {
        device: "desktop",
        cls: 0.05,
        lcpMs: 900,
        hasOverlap: false,
        hasClip: false,
        a11yOk: true,
      },
    ];

    const res = assessDeviceSnapshots(snaps);
    expect(res.pass).toBe(true);
    expect(res.worstDevice).toBeNull();
    expect(res.reasons.length).toBe(0);
  });

  it("fails when CLS or LCP exceed budgets", () => {
    const snaps: DeviceSnapshot[] = [
      {
        device: "mobile",
        cls: 0.3,          // over CLS budget
        lcpMs: 2000,
        hasOverlap: false,
        hasClip: false,
        a11yOk: true,
      },
      {
        device: "desktop",
        cls: 0.1,
        lcpMs: 3000,       // over LCP budget
        hasOverlap: false,
        hasClip: false,
        a11yOk: true,
      },
    ];

    const res = assessDeviceSnapshots(snaps);
    expect(res.pass).toBe(false);

    expect(res.reasons.some((r) => r === "cls_high:mobile")).toBe(true);
    expect(res.reasons.some((r) => r === "lcp_slow:desktop")).toBe(true);

    // worstDevice should be one of the devices that actually failed
    expect(["mobile", "desktop"]).toContain(res.worstDevice);
  });

  it("flags overlap, clip, and a11y issues", () => {
    const snaps: DeviceSnapshot[] = [
      {
        device: "tablet",
        cls: 0.1,
        lcpMs: 1000,
        hasOverlap: true,
        hasClip: true,
        a11yOk: false,
      },
    ];

    const res = assessDeviceSnapshots(snaps);
    expect(res.pass).toBe(false);
    expect(res.reasons).toContain("overlap:tablet");
    expect(res.reasons).toContain("clip:tablet");
    expect(res.reasons).toContain("a11y_fail:tablet");
    expect(res.worstDevice).toBe("tablet");
  });
});

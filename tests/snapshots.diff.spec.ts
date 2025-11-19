// tests/snapshots.diff.spec.ts
import { describe, it, expect } from "vitest";
import {
  diffSnapshots,
  type SnapshotImage,
} from "../server/qa/snapshots.diff";

function makeSolidImage(
  width: number,
  height: number,
  rgba: [number, number, number, number]
): SnapshotImage {
  const [r, g, b, a] = rgba;
  const totalPixels = width * height;
  const data: number[] = new Array(totalPixels * 4);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  }

  return { width, height, data };
}

describe("qa/snapshots.diff – pixel diff engine", () => {
  it("returns zero diff for identical images", () => {
    const imgA = makeSolidImage(2, 2, [10, 20, 30, 255]);
    const imgB = makeSolidImage(2, 2, [10, 20, 30, 255]);

    const result = diffSnapshots(imgA, imgB, {
      perChannelThreshold: 0,
      maxDiffRatio: 0.01,
    });

    expect(result.totalPixels).toBe(4);
    expect(result.changedPixels).toBe(0);
    expect(result.changedRatio).toBe(0);
    expect(result.exceedsMaxDiffRatio).toBe(false);
  });

  it("detects changed pixels and flags regression when over the ratio", () => {
    const base = makeSolidImage(2, 2, [0, 0, 0, 255]);
    const modified = makeSolidImage(2, 2, [0, 0, 0, 255]);

    // Change exactly one pixel to white.
    const data = modified.data as number[];
    // Pixel index 1 -> RGBA indices 4..7
    data[4] = 255;
    data[5] = 255;
    data[6] = 255;
    data[7] = 255;

    const result = diffSnapshots(base, modified, {
      perChannelThreshold: 0,
      maxDiffRatio: 0.1, // 10% allowed, but 1/4 = 25%
    });

    expect(result.totalPixels).toBe(4);
    expect(result.changedPixels).toBe(1);
    expect(result.changedRatio).toBeCloseTo(0.25);
    expect(result.exceedsMaxDiffRatio).toBe(true);
  });

  it("throws when image sizes do not match", () => {
    const imgA = makeSolidImage(2, 2, [0, 0, 0, 255]);
    const imgB = makeSolidImage(3, 2, [0, 0, 0, 255]);

    expect(() => diffSnapshots(imgA, imgB)).toThrowError(
      "snapshot_size_mismatch"
    );
  });
});

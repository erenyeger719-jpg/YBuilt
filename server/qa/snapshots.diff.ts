// server/qa/snapshots.diff.ts

export interface SnapshotImage {
  width: number;
  height: number;
  // Flat RGBA array: length should be width * height * 4
  data: Uint8Array | number[];
}

export interface PixelDiffOptions {
  // Per-channel threshold (0–255) for considering a pixel changed.
  // If any channel differs more than this, we count that pixel as changed.
  perChannelThreshold?: number; // default 0

  // Max allowed ratio of changed pixels (0..1).
  // If changedRatio > maxDiffRatio => visual regression.
  maxDiffRatio?: number; // default 0.01 (1%)
}

export interface PixelDiffResult {
  totalPixels: number;
  changedPixels: number;
  changedRatio: number; // 0..1
  exceedsMaxDiffRatio: boolean;
}

/**
 * Compare two RGBA snapshots and compute how much changed.
 * Intended to be used by a visual regression snapshot pipeline.
 */
export function diffSnapshots(
  a: SnapshotImage,
  b: SnapshotImage,
  opts: PixelDiffOptions = {}
): PixelDiffResult {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error("snapshot_size_mismatch");
  }

  const perChannelThreshold =
    typeof opts.perChannelThreshold === "number" &&
    Number.isFinite(opts.perChannelThreshold)
      ? opts.perChannelThreshold
      : 0;

  const maxDiffRatio =
    typeof opts.maxDiffRatio === "number" &&
    Number.isFinite(opts.maxDiffRatio) &&
    opts.maxDiffRatio >= 0 &&
    opts.maxDiffRatio <= 1
      ? opts.maxDiffRatio
      : 0.01; // default: 1% pixels can change before we call it a regression

  const totalPixels = a.width * a.height;
  const dataA = a.data;
  const dataB = b.data;

  const maxLen = Math.min(
    dataA.length,
    dataB.length,
    totalPixels * 4
  );

  let changedPixels = 0;

  for (let i = 0; i < maxLen; i += 4) {
    const dr = Math.abs((dataA as any)[i] - (dataB as any)[i]);
    const dg = Math.abs((dataA as any)[i + 1] - (dataB as any)[i + 1]);
    const db = Math.abs((dataA as any)[i + 2] - (dataB as any)[i + 2]);
    const da = Math.abs((dataA as any)[i + 3] - (dataB as any)[i + 3]);

    if (
      dr > perChannelThreshold ||
      dg > perChannelThreshold ||
      db > perChannelThreshold ||
      da > perChannelThreshold
    ) {
      changedPixels++;
    }
  }

  const changedRatio =
    totalPixels > 0 ? changedPixels / totalPixels : 0;
  const exceedsMaxDiffRatio = changedRatio > maxDiffRatio;

  return {
    totalPixels,
    changedPixels,
    changedRatio,
    exceedsMaxDiffRatio,
  };
}

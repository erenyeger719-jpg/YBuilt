// server/qa/device.sanity.ts

// One snapshot per device / viewport
export type DeviceSnapshot = {
  device: string;        // e.g. "mobile", "desktop", "tablet"
  cls: number;           // cumulative layout shift, 0..1
  lcpMs: number;         // LCP estimate in milliseconds
  hasOverlap: boolean;   // any overlapping elements?
  hasClip: boolean;      // any clipped/hidden text?
  a11yOk?: boolean;      // optional: accessibility checks passed
};

export type DeviceSanityResult = {
  pass: boolean;          // true = all devices within budgets
  worstDevice: string | null;
  reasons: string[];      // e.g. ["cls_high:mobile", "lcp_slow:desktop"]
};

const CLS_BUDGET = 0.25;        // rough good CLS
const LCP_BUDGET_MS = 2500;     // rough LCP budget in ms

export function assessDeviceSnapshots(snaps: DeviceSnapshot[]): DeviceSanityResult {
  if (!Array.isArray(snaps) || snaps.length === 0) {
    // No data → treat as pass, let callers decide if they want stricter behavior.
    return { pass: true, worstDevice: null, reasons: [] };
  }

  let pass = true;
  const reasons: string[] = [];
  let worstDevice: string | null = null;
  let worstScore = -Infinity;

  for (const s of snaps) {
    const d = s.device || "unknown";
    const breachReasons: string[] = [];

    if (s.cls > CLS_BUDGET) {
      breachReasons.push("cls_high");
    }
    if (s.lcpMs > LCP_BUDGET_MS) {
      breachReasons.push("lcp_slow");
    }
    if (s.hasOverlap) {
      breachReasons.push("overlap");
    }
    if (s.hasClip) {
      breachReasons.push("clip");
    }
    if (s.a11yOk === false) {
      breachReasons.push("a11y_fail");
    }

    if (breachReasons.length > 0) {
      pass = false;

      for (const r of breachReasons) {
        reasons.push(`${r}:${d}`);
      }

      // Simple "badness" score: more issues = worse
      const score = breachReasons.length;
      if (score > worstScore) {
        worstScore = score;
        worstDevice = d;
      }
    }
  }

  return { pass, worstDevice, reasons };
}

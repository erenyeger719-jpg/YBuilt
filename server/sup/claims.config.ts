// server/sup/claims.config.ts
// Declarative claim policy config for SUP

export type ClaimKind =
  | "superlative"
  | "percent"
  | "multiplier"
  | "comparative"
  | "factual"
  | "testimonial";

export type ClaimBehavior = "allow" | "warn" | "block";

export type ClaimPolicy = {
  behavior: ClaimBehavior;
  requireEvidence: boolean;
};

// Single source of truth for how each claim type should behave.
// You can tune these later without touching the core logic.
export const CLAIM_POLICY: Record<ClaimKind, ClaimPolicy> = {
  superlative: {
    behavior: "block",       // "#1", "best", "leading"
    requireEvidence: true,
  },
  percent: {
    behavior: "block",       // "200%", "37 percent"
    requireEvidence: true,
  },
  multiplier: {
    behavior: "block",       // "3x faster"
    requireEvidence: true,
  },
  comparative: {
    behavior: "warn",        // "better", "cheaper"
    requireEvidence: false,
  },
  factual: {
    behavior: "warn",        // "according to a study..."
    requireEvidence: true,
  },
  testimonial: {
    behavior: "warn",        // "a customer said..."
    requireEvidence: false,
  },
};

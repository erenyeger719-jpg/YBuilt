// server/qa/failure.playbook.ts

export type FailureKind =
  | "sup_block"
  | "contracts_failed"
  | "quota_exceeded"
  | "body_too_large"
  | "abuse_detected"
  | "internal_error";

export type FailureContext = {
  kind: FailureKind | string; // allow unknowns, we’ll normalize
  route?: string;             // e.g. "/one", "/instant", "/media"
  reason?: string;            // freeform, e.g. "claims", "perf", "a11y"
  audience?: string;          // optional hint like "founder", "dev"
};

export type FailureFallback = {
  status: "fallback";
  code: string;         // stable identifier, e.g. "sup_block.generic"
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  retryable: boolean;
};

/**
 * Normalize kind to a known bucket so callers can pass through raw strings.
 */
function normalizeKind(kind: string): FailureKind | "unknown" {
  const k = String(kind || "").toLowerCase().trim();
  switch (k) {
    case "sup_block":
    case "sup-block":
      return "sup_block";
    case "contracts_failed":
    case "contracts-failed":
      return "contracts_failed";
    case "quota_exceeded":
    case "quota-exceeded":
    case "429":
      return "quota_exceeded";
    case "body_too_large":
    case "body-too-large":
    case "413":
      return "body_too_large";
    case "abuse_detected":
    case "abuse-detected":
      return "abuse_detected";
    case "internal_error":
    case "500":
      return "internal_error";
    default:
      return "unknown";
  }
}

/**
 * Very small, deterministic failure playbook:
 * - Map failure kind → safe, minimal fallback payload.
 * - No randomness, no LLM calls.
 */
export function pickFailureFallback(ctx: FailureContext): FailureFallback {
  const norm = normalizeKind(ctx.kind);
  const route = ctx.route || "";
  const reason = (ctx.reason || "").toLowerCase().trim();

  // Tiny helper to keep responses consistent
  const make = (
    code: string,
    title: string,
    body: string,
    retryable: boolean,
    ctaLabel?: string,
    ctaHref?: string
  ): FailureFallback => ({
    status: "fallback",
    code,
    title,
    body,
    retryable,
    ...(ctaLabel ? { ctaLabel } : {}),
    ...(ctaHref ? { ctaHref } : {}),
  });

  switch (norm) {
    case "sup_block": {
      const code = reason ? `sup_block.${reason}` : "sup_block.generic";
      return make(
        code,
        "We paused this draft",
        "This draft tripped one of our safety checks. Nothing was published, and no changes were applied.",
        false
      );
    }

    case "contracts_failed": {
      const code = "contracts_failed.generic";
      return make(
        code,
        "We couldn’t finalize this change",
        "The result didn’t meet the contracts we require for this route. We kept your live content as-is.",
        false
      );
    }

    case "quota_exceeded": {
      const code = "quota_exceeded.generic";
      return make(
        code,
        "Too many requests right now",
        "You’ve hit the current usage limit for this workspace. Try again in a bit, or upgrade your plan to get more headroom.",
        true,
        "Try again",
        route || undefined
      );
    }

    case "body_too_large": {
      const code = "body_too_large.generic";
      return make(
        code,
        "This request was too large",
        "The payload for this request was larger than we accept in one go. Try again with a smaller brief or fewer assets.",
        true
      );
    }

    case "abuse_detected": {
      const code = "abuse_detected.generic";
      return make(
        code,
        "We can’t help with that",
        "This request looks like something we’re not allowed to assist with. If you think this is a mistake, adjust the wording and try again.",
        false
      );
    }

    case "internal_error": {
      const code = "internal_error.generic";
      return make(
        code,
        "Something went wrong on our side",
        "We hit an internal error while trying to handle this request. Your live content is unchanged.",
        true,
        "Try again",
        route || undefined
      );
    }

    case "unknown":
    default: {
      const code = "unknown.generic";
      return make(
        code,
        "We couldn’t finish this request",
        "We weren’t able to complete this action. Nothing was changed on your live content.",
        true,
        "Try again",
        route || undefined
      );
    }
  }
}

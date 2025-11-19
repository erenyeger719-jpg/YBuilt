import { getLocaleLayoutPolicy } from "./locale.layout.policy.ts";

export function checkCopyReadability(copy: Record<string, any>) {
  return { score: 80, issues: [], copyPatch: {} };
}

// Locale-aware helper: wraps checkCopyReadability and adds layout policy info.
export function checkCopyReadabilityForLocale(
  copy: unknown,
  locale: string | null | undefined
) {
  // Keep the existing behavior:
  const baseResult: any = checkCopyReadability(copy as Record<string, any>);
  // Pull the layout/readability targets for this locale:
  const layoutPolicy = getLocaleLayoutPolicy(locale);

  return {
    ...baseResult,
    // Expose the policy so callers can tune layout/UX decisions.
    layoutPolicy,
  };
}

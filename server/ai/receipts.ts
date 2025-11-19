// server/ai/receipts.ts
// Build a short, plain-language receipt of what changed.

export type Patch = { sections?: string[]; copy?: Record<string, any>; brand?: Record<string, any> };

function changedKeys(before: Record<string, any> = {}, after: Record<string, any> = {}) {
  const keys = new Set<string>([...Object.keys(after), ...Object.keys(before)]);
  const changed: string[] = [];
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return changed;
}

function arrayEqual(a: any[] = [], b: any[] = []) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function extractFailures(prepared: any): string[] {
  const reasons: string[] = [];
  const budgetsOk = prepared?.budgets?.ok;
  const issues = prepared?.issues || prepared?.errors || prepared?.__errors || [];
  const failed = prepared?.__contracts?.failures || [];
  if (budgetsOk === false) reasons.push("budgets_not_ok");
  if (Array.isArray(issues)) reasons.push(...issues.map((x: any) => String(x)));
  if (Array.isArray(failed)) reasons.push(...failed.map((x: any) => String(x)));
  return reasons;
}

export function buildReceipt(before: any, patch: Patch, prepared: any) {
  const secBefore = Array.isArray(before?.sections) ? before.sections : [];
  const secAfter = Array.isArray(patch?.sections) ? patch.sections : secBefore;

  const secChanged = arrayEqual(secBefore, secAfter) ? 0 : 1; // v0: treat any order change as 1 change

  const copyBefore = (before?.copy as Record<string, any>) || {};
  const copyAfter = { ...copyBefore, ...(patch?.copy || {}) };
  const copyChanged = changedKeys(copyBefore, copyAfter);

  const brandBefore = (before?.brand as Record<string, any>) || {};
  const brandAfter = { ...brandBefore, ...(patch?.brand || {}) };
  const brandChanged = changedKeys(brandBefore, brandAfter);

  const failures = extractFailures(prepared);
  const budgetsOk = prepared?.budgets?.ok !== false && failures.length === 0;

  const parts: string[] = [];
  if (secChanged) parts.push(`reordered sections`);
  if (copyChanged.length) parts.push(`updated ${copyChanged.length} copy field${copyChanged.length > 1 ? "s" : ""}`);
  if (brandChanged.length) parts.push(`tuned ${brandChanged.length} brand field${brandChanged.length > 1 ? "s" : ""}`);

  const action = parts.length ? parts.join(", ") : "no visible changes";
  const tail = budgetsOk ? "budgets OK" : "contracts failed";
  const summary = `${action}; ${tail}.`;

  return {
    summary,
    details: {
      sectionsChanged: Boolean(secChanged),
      copyKeys: copyChanged,
      brandKeys: brandChanged,
      budgetsOk,
      failures: failures.slice(0, 8),
    },
  };
}

// server/intent/budget.ts

export type BudgetSession = { spentTokens?: number };

/**
 * Short-circuits when BUDGET_MAX_TOKENS is set and the session has spent >= cap.
 * Returns a test-friendly shape on block, otherwise runs `fn`.
 */
export async function runWithBudget<T>(
  session: BudgetSession | undefined,
  _action: any,
  fn: () => Promise<T>
): Promise<any> {
  const cap = Number(process.env.BUDGET_MAX_TOKENS || "0");
  const spent = Number(session?.spentTokens || 0);

  if (cap > 0 && spent >= cap) {
    // shape expected by tests: has `error` plus app-friendly hints
    return { ok: false, error: "budget", skipped: true, reason: "budget" };
  }
  return await fn();
}

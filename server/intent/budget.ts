// server/intent/budget.ts
export type BudgetSession = { spentTokens?: number };

/**
 * Short-circuits when (spent + pending) >= cap.
 * Returns a test-friendly envelope on block; otherwise runs `fn`.
 */
export async function runWithBudget<T>(
  session: BudgetSession | undefined,
  action: { cost_est?: number } | undefined,
  fn: () => Promise<T>
): Promise<any> {
  const cap = Number(process.env.BUDGET_MAX_TOKENS || "0");
  const spent = Number(session?.spentTokens || 0);
  const pending = Number(action?.cost_est || 0);

  if (cap > 0 && spent + pending >= cap) {
    return { ok: false, error: "budget", skipped: true, reason: "budget" };
  }
  return await fn();
}
